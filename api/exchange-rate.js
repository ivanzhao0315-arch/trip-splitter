import { json, readJson } from './lib/json.js';

export default async function handler(request) {
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

  const baseUrl = process.env.EXCHANGE_RATE_PROVIDER_URL;
  const apiKey = process.env.EXCHANGE_RATE_PROVIDER_KEY;

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
  const rate = Number(payload.rate ?? payload.result ?? payload.conversion_rate);

  if (!Number.isFinite(rate) || rate <= 0) {
    return json({ error: 'Exchange-rate response did not include a valid rate' }, 502);
  }

  return json({
    rate,
    provider: new URL(baseUrl).hostname,
    timestamp: new Date().toISOString(),
  });
}
