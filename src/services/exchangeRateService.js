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
