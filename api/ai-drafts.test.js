import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './ai-drafts.js';

async function postAiDraft(formData) {
  return handler(new Request('http://localhost/api/ai-drafts', {
    method: 'POST',
    body: formData,
  }));
}

function disableSupabasePersistence() {
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  vi.stubEnv('SUPABASE_ANON_KEY', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
}

describe('ai draft endpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns a normalized draft for text input', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    disableSupabasePersistence();

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

  it('persists text drafts to Supabase when backend credentials are configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      expect(String(url)).toBe('https://example.supabase.co/rest/v1/ai_drafts');
      expect(options.headers.apikey).toBe('anon-key');
      expect(options.headers.Authorization).toBe('Bearer anon-key');
      expect(options.headers.Prefer).toBe('return=representation');
      expect(JSON.parse(options.body)).toMatchObject({
        project_id: 'project-1',
        source_type: 'text',
        source_ref: '东京便利店 JPY 1280 Ivan 已付',
        status: 'draft',
        draft_payload: {
          amount: 1280,
          currency: 'JPY',
        },
      });

      return new Response(JSON.stringify([{ id: 'draft-1' }]), { status: 201 });
    }));

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('sourceType', 'text');
    formData.set('text', '东京便利店 JPY 1280 Ivan 已付');

    const response = await postAiDraft(formData);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      aiDraftId: 'draft-1',
      persisted: true,
      draft: {
        amount: 1280,
        currency: 'JPY',
      },
    });
  });

  it('keeps returning a draft when Supabase persistence fails', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('failed', { status: 500 })));

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('sourceType', 'text');
    formData.set('text', '晚餐 ¥88 Ivan 已付');

    const response = await postAiDraft(formData);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      persisted: false,
      draft: {
        amount: 88,
        currency: 'CNY',
      },
    });
  });

  it('uses OpenAI structured parsing for text input when configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    disableSupabasePersistence();
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
    disableSupabasePersistence();
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
    disableSupabasePersistence();

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
    disableSupabasePersistence();
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
