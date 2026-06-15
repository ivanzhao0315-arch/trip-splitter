import { parseExpenseText } from './lib/aiParser.js';
import { json } from './lib/json.js';

const SUPPORTED_CURRENCIES = new Set(['CNY', 'USD', 'JPY', 'EUR', 'HKD', 'GBP', 'KRW']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function normalizeDraft(draft, fallback = {}) {
  const amount = Number(draft?.amount);
  const currency = String(draft?.currency ?? fallback.currency ?? 'CNY').toUpperCase();
  const description = String(draft?.description ?? fallback.description ?? '').trim();
  const confidence = Number(draft?.confidence);

  return {
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    currency: SUPPORTED_CURRENCIES.has(currency) ? currency : 'CNY',
    description: description.slice(0, 80) || '未命名账单',
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    payerName: String(draft?.payerName ?? '').trim(),
    participantNames: Array.isArray(draft?.participantNames)
      ? draft.participantNames.map((name) => String(name).trim()).filter(Boolean)
      : [],
  };
}

async function fileToDataUrl(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null;
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'image/jpeg';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function extractResponseJson(payload) {
  const outputText = payload.output_text
    ?? payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? '')
      .join('');

  if (!outputText) {
    throw new Error('AI response did not include text output');
  }

  return JSON.parse(outputText);
}

async function parseImageWithOpenAI({ file, sourceType }) {
  const imageUrl = await fileToDataUrl(file);
  if (!imageUrl) {
    throw new Error('Missing image file');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                '你是中文共享记账工具的账单识别器。',
                '请从收据、微信支付、支付宝、银行卡或聊天账单截图中识别一笔最主要的支出。',
                '只返回 JSON，不要解释。字段：amount 数字；currency 三位大写币种；description 简短中文或原文商户描述；payerName 付款人昵称或空字符串；participantNames 参与人昵称数组；confidence 0 到 1。',
                `来源类型：${sourceType}`,
              ].join('\n'),
            },
            {
              type: 'input_image',
              image_url: imageUrl,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'expense_draft',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['amount', 'currency', 'description', 'payerName', 'participantNames', 'confidence'],
            properties: {
              amount: { type: 'number', minimum: 0 },
              currency: { type: 'string', enum: Array.from(SUPPORTED_CURRENCIES) },
              description: { type: 'string' },
              payerName: { type: 'string' },
              participantNames: {
                type: 'array',
                items: { type: 'string' },
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error('OpenAI image parsing failed');
  }

  return normalizeDraft(extractResponseJson(await response.json()));
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const formData = await request.formData();
  const projectId = formData.get('projectId');
  const sourceType = formData.get('sourceType');
  const text = formData.get('text');
  const file = formData.get('file');

  if (!projectId || !sourceType) {
    return json({ error: 'Missing projectId or sourceType' }, 400);
  }

  if (sourceType === 'text') {
    return json({
      sourceType,
      draft: normalizeDraft(parseExpenseText(text)),
      status: 'draft',
    });
  }

  if (file && process.env.OPENAI_API_KEY) {
    try {
      return json({
        sourceType,
        draft: await parseImageWithOpenAI({ file, sourceType }),
        status: 'draft',
      });
    } catch (error) {
      return json({ error: error.message || 'Image parsing failed' }, 502);
    }
  }

  return json({
    sourceType,
    draft: {
      amount: 0,
      currency: 'CNY',
      description: '',
      payerName: '',
      participantNames: [],
      confidence: 0,
    },
    status: 'draft',
    note: 'No AI provider configured; user must complete the draft manually.',
  });
}
