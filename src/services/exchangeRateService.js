export async function fetchExchangeRate({ fromCurrency, toCurrency }) {
  if (fromCurrency === toCurrency) {
    return {
      rate: 1,
      provider: 'identity',
      timestamp: new Date().toISOString(),
    };
  }

  const response = await fetch('/api/exchange-rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromCurrency, toCurrency }),
  });

  if (!response.ok) {
    throw new Error('汇率获取失败，请手动输入汇率');
  }

  return response.json();
}

export async function resolveExchangeRateWithFallback({
  fromCurrency,
  toCurrency,
  fallbackRates,
  fetchRate = fetchExchangeRate,
}) {
  if (fromCurrency === toCurrency) {
    return {
      rate: 1,
      provider: 'identity',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    return await fetchRate({ fromCurrency, toCurrency });
  } catch {
    return {
      rate: fallbackRates?.[fromCurrency]?.[toCurrency] ?? 1,
      provider: 'local-fallback',
      timestamp: new Date().toISOString(),
    };
  }
}
