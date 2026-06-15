import { json, readJson } from './lib/json.js';

function getRuntimeEnv(env) {
  return env ?? globalThis.process?.env ?? {};
}

function extractRate(payload, toCurrency) {
  const directRate = payload?.rate ?? payload?.result ?? payload?.conversion_rate;
  const tableRate = payload?.rates?.[toCurrency] ?? payload?.conversion_rates?.[toCurrency];
  const nestedRate = payload?.data?.[toCurrency]?.value ?? payload?.data?.[toCurrency];
  return Number(directRate ?? tableRate ?? nestedRate);
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

  if (!baseUrl || !apiKey) {
    return json({ error: 'Exchange-rate provider is not configured' }, 500);
  }

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

  return json({
    rate,
    provider: new URL(baseUrl).hostname,
    timestamp: new Date().toISOString(),
  });
}
