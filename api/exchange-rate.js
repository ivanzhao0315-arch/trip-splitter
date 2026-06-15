import { json, readJson } from './lib/json.js';

const DEFAULT_PROVIDER_ORIGIN = 'https://open.er-api.com';

function getRuntimeEnv(env) {
  return env ?? globalThis.process?.env ?? {};
}

function extractRate(payload, toCurrency) {
  const candidates = [
    payload?.rate,
    payload?.result,
    payload?.conversion_rate,
    payload?.rates?.[toCurrency],
    payload?.conversion_rates?.[toCurrency],
    payload?.data?.[toCurrency]?.value,
    payload?.data?.[toCurrency],
  ];

  for (const candidate of candidates) {
    const rate = Number(candidate);
    if (Number.isFinite(rate) && rate > 0) return rate;
  }

  return NaN;
}

function providerResponse(payload, rate, provider) {
  return json({
    rate,
    provider,
    timestamp: new Date().toISOString(),
  });
}

async function fetchConfiguredRate({ baseUrl, apiKey, fromCurrency, toCurrency }) {
  const url = new URL(baseUrl);
  url.searchParams.set('from', fromCurrency);
  url.searchParams.set('to', toCurrency);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    return json({ error: 'Exchange-rate provider failed' }, 502);
  }

  const payload = await response.json();
  const rate = extractRate(payload, toCurrency);

  if (!Number.isFinite(rate) || rate <= 0) {
    return json({ error: 'Exchange-rate response did not include a valid rate' }, 502);
  }

  return providerResponse(payload, rate, new URL(baseUrl).hostname);
}

async function fetchDefaultRate({ fromCurrency, toCurrency }) {
  const url = new URL(`/v6/latest/${fromCurrency}`, DEFAULT_PROVIDER_ORIGIN);
  const response = await fetch(url);

  if (!response.ok) {
    return json({ error: 'Default exchange-rate provider failed' }, 502);
  }

  const payload = await response.json();
  if (payload?.result && payload.result !== 'success') {
    return json({ error: 'Default exchange-rate provider returned an error' }, 502);
  }

  const rate = extractRate(payload, toCurrency);
  if (!Number.isFinite(rate) || rate <= 0) {
    return json({ error: 'Exchange-rate response did not include a valid rate' }, 502);
  }

  return providerResponse(payload, rate, new URL(DEFAULT_PROVIDER_ORIGIN).hostname);
}

export default async function handler(request, env) {
  const runtimeEnv = getRuntimeEnv(env);

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const { fromCurrency, toCurrency } = await readJson(request);

  if (!/^[A-Z]{3}$/.test(fromCurrency) || !/^[A-Z]{3}$/.test(toCurrency)) {
    return json({ error: 'Invalid currency code' }, 400);
  }

  if (fromCurrency === toCurrency) {
    return json({ rate: 1, provider: 'identity', timestamp: new Date().toISOString() });
  }

  const baseUrl = runtimeEnv.EXCHANGE_RATE_PROVIDER_URL;
  const apiKey = runtimeEnv.EXCHANGE_RATE_PROVIDER_KEY;

  if (baseUrl || apiKey) {
    if (!baseUrl || !apiKey) {
      return json({ error: 'Exchange-rate provider config is incomplete' }, 500);
    }

    return fetchConfiguredRate({ baseUrl, apiKey, fromCurrency, toCurrency });
  }

  return fetchDefaultRate({ fromCurrency, toCurrency });
}
