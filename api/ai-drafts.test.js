import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './ai-drafts.js';

async function postAiDraft(formData) {
  return handler(new Request('http://localhost/api/ai-drafts', {
    method: 'POST',
    body: formData,
  }));
}

describe('ai draft endpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns a normalized draft for text input', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('sourceType', 'text');
    formData.set('text', '东京便利店 JPY 1280 Ivan 已付');

    const response = await postAiDraft(formData);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      sourceType: 'text',
      status: 'draft',
      draft: {
        amount: 1280,
        currency: 'JPY',
      },
    });
  });

  it('uses OpenAI structured parsing for text input when configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      const schema = body.text.format.schema;
      const prompt = body.input[0].content[0].text;

      expect(prompt).toContain('账单文字');
      expect(prompt).toContain('张三 已付');
      expect(schema.required).toContain('payerName');
      expect(schema.required).toContain('participantNames');

      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          amount: 96,
          currency: 'CNY',
          description: '打车',
          payerName: '张三',
          participantNames: ['小陈', 'Ivan'],
          confidence: 0.9,
        }),
      }), { status: 200 });
    }));

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('sourceType', 'text');
    formData.set('text', '张三 已付 打车 ¥96，平分 小陈 Ivan');

    const response = await postAiDraft(formData);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.draft).toMatchObject({
      amount: 96,
      currency: 'CNY',
      description: '打车',
      payerName: '张三',
      participantNames: ['小陈', 'Ivan'],
    });
  });

  it('falls back to deterministic text parsing when OpenAI text parsing fails', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('failed', { status: 500 })));

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('sourceType', 'text');
    formData.set('text', '东京便利店 JPY 1280 Ivan 已付');

    const response = await postAiDraft(formData);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.draft).toMatchObject({
      amount: 1280,
      currency: 'JPY',
    });
  });

  it('returns an empty manual draft for images without an AI provider', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('sourceType', 'screenshot');
    formData.set('file', new File(['fake-image'], 'wechat-pay.png', { type: 'image/png' }));

    const response = await postAiDraft(formData);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      sourceType: 'screenshot',
      status: 'draft',
      draft: {
        amount: 0,
        currency: 'CNY',
        description: '',
        payerName: '',
        participantNames: [],
        confidence: 0,
      },
    });
  });

  it('asks OpenAI image parsing for payer and participant names', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      const schema = body.text.format.schema;

      expect(schema.required).toContain('payerName');
      expect(schema.required).toContain('participantNames');
      expect(schema.properties.participantNames.type).toBe('array');

      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          amount: 88,
          currency: 'CNY',
          description: '微信支付晚餐',
          payerName: '张三',
          participantNames: ['张三', 'Ivan'],
          confidence: 0.91,
        }),
      }), { status: 200 });
    }));

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('sourceType', 'screenshot');
    formData.set('file', new File(['fake-image'], 'wechat-pay.png', { type: 'image/png' }));

    const response = await postAiDraft(formData);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.draft).toMatchObject({
      amount: 88,
      currency: 'CNY',
      payerName: '张三',
      participantNames: ['张三', 'Ivan'],
      confidence: 0.91,
    });
  });
});
