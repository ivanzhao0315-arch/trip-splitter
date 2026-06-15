import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './exchange-rate.js';

function postExchangeRate(body) {
  return handler(new Request('http://localhost/api/exchange-rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('exchange-rate endpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns identity rates without provider config for same-currency conversion', async () => {
    const response = await postExchangeRate({ fromCurrency: 'CNY', toCurrency: 'CNY' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ rate: 1, provider: 'identity' });
  });

  it('rejects invalid currency codes', async () => {
    const response = await postExchangeRate({ fromCurrency: 'usd', toCurrency: 'CNY' });

    expect(response.status).toBe(400);
  });

  it('requires provider config for cross-currency conversion', async () => {
    vi.stubEnv('EXCHANGE_RATE_PROVIDER_URL', '');
    vi.stubEnv('EXCHANGE_RATE_PROVIDER_KEY', '');

    const response = await postExchangeRate({ fromCurrency: 'USD', toCurrency: 'CNY' });

    expect(response.status).toBe(500);
  });

  it('reads pair conversion responses from provider payloads', async () => {
    vi.stubEnv('EXCHANGE_RATE_PROVIDER_URL', 'https://rates.example/latest');
    vi.stubEnv('EXCHANGE_RATE_PROVIDER_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const requestUrl = new URL(url);

      expect(requestUrl.searchParams.get('from')).toBe('USD');
      expect(requestUrl.searchParams.get('to')).toBe('CNY');
      expect(requestUrl.searchParams.get('apikey')).toBe('test-key');

      return new Response(JSON.stringify({ conversion_rate: 7.31 }), { status: 200 });
    }));

    const response = await postExchangeRate({ fromCurrency: 'USD', toCurrency: 'CNY' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      rate: 7.31,
      provider: 'rates.example',
    });
  });

  it('reads table-based rate responses from provider payloads', async () => {
    vi.stubEnv('EXCHANGE_RATE_PROVIDER_URL', 'https://rates.example/latest');
    vi.stubEnv('EXCHANGE_RATE_PROVIDER_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => (
      new Response(JSON.stringify({ rates: { CNY: 7.29 } }), { status: 200 })
    )));

    const response = await postExchangeRate({ fromCurrency: 'USD', toCurrency: 'CNY' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rate).toBe(7.29);
  });

  it('rejects provider responses without a usable rate', async () => {
    vi.stubEnv('EXCHANGE_RATE_PROVIDER_URL', 'https://rates.example/latest');
    vi.stubEnv('EXCHANGE_RATE_PROVIDER_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => (
      new Response(JSON.stringify({ rates: { EUR: 0.92 } }), { status: 200 })
    )));

    const response = await postExchangeRate({ fromCurrency: 'USD', toCurrency: 'CNY' });

    expect(response.status).toBe(502);
  });
});
