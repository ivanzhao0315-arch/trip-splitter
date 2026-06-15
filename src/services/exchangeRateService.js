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

function resolveLocalFallbackRate({ fromCurrency, toCurrency, fallbackRates }) {
  const directRate = fallbackRates?.[fromCurrency]?.[toCurrency];
  if (directRate) return directRate;

  const inverseRate = fallbackRates?.[toCurrency]?.[fromCurrency];
  if (inverseRate) return 1 / inverseRate;

  const fromToCny = fallbackRates?.[fromCurrency]?.CNY;
  const cnyToTarget = fallbackRates?.CNY?.[toCurrency];
  if (fromToCny && cnyToTarget) return fromToCny * cnyToTarget;

  const cnyToFrom = fallbackRates?.CNY?.[fromCurrency];
  const targetToCny = fallbackRates?.[toCurrency]?.CNY;
  if (cnyToFrom && targetToCny) return (1 / cnyToFrom) * (1 / targetToCny);

  throw new Error('缺少本地兜底汇率');
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
      rate: resolveLocalFallbackRate({ fromCurrency, toCurrency, fallbackRates }),
      provider: 'local-fallback',
      timestamp: new Date().toISOString(),
    };
  }
}
