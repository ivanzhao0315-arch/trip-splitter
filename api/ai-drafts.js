import { parseExpenseText } from './lib/aiParser.js';
import { json } from './lib/json.js';

const SUPPORTED_CURRENCIES = new Set(['CNY', 'USD', 'JPY', 'EUR', 'HKD', 'GBP', 'KRW']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function expenseDraftSchema() {
  return {
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
  };
}

function expenseDraftPrompt(sourceType) {
  return [
    '你是中文共享记账工具的账单识别器。',
    '请识别一笔最主要的共同支出。',
    '如果来源是聊天记录，请结合上下文判断金额、币种、描述、付款人和参与人。',
    '如果写了“大家平分”“全员”“所有人”，participantNames 可以为空数组，让前端按当前项目全员处理。',
    '只返回 JSON，不要解释。字段：amount 数字；currency 三位大写币种；description 简短中文或原文商户描述；payerName 付款人昵称或空字符串；participantNames 参与人昵称数组；confidence 0 到 1。',
    `来源类型：${sourceType}`,
  ].join('\n');
}

function getRuntimeEnv(env) {
  return env ?? globalThis.process?.env ?? {};
}

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

async function requestOpenAiDraft(input, env) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
      input,
      text: {
        format: {
          type: 'json_schema',
          name: 'expense_draft',
          schema: expenseDraftSchema(),
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error('OpenAI draft parsing failed');
  }

  return normalizeDraft(extractResponseJson(await response.json()));
}

async function parseTextWithOpenAI({ text, sourceType, env }) {
  return requestOpenAiDraft([
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `${expenseDraftPrompt(sourceType)}\n\n账单文字：\n${text}`,
        },
      ],
    },
  ], env);
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function fileToDataUrl(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null;
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large');
  }

  const mimeType = file.type || 'image/jpeg';
  return `data:${mimeType};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;
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

async function parseImageWithOpenAI({ file, sourceType, env }) {
  const imageUrl = await fileToDataUrl(file);
  if (!imageUrl) {
    throw new Error('Missing image file');
  }

  return requestOpenAiDraft([
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: expenseDraftPrompt(sourceType),
        },
        {
          type: 'input_image',
          image_url: imageUrl,
        },
      ],
    },
  ], env);
}

export default async function handler(request, env) {
  const runtimeEnv = getRuntimeEnv(env);

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
    if (runtimeEnv.OPENAI_API_KEY) {
      try {
        return json({
          sourceType,
          draft: await parseTextWithOpenAI({ text, sourceType, env: runtimeEnv }),
          status: 'draft',
        });
      } catch {
        // Fall through to deterministic parsing so text entry remains usable.
      }
    }

    return json({
      sourceType,
      draft: normalizeDraft(parseExpenseText(text)),
      status: 'draft',
    });
  }

  if (file && runtimeEnv.OPENAI_API_KEY) {
    try {
      return json({
        sourceType,
        draft: await parseImageWithOpenAI({ file, sourceType, env: runtimeEnv }),
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
