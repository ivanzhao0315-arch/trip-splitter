const CURRENCY_PATTERNS = [
  { currency: 'USD', regex: /\$\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'CNY', regex: /(?:¥|RMB|CNY)\s?(\d+(?:\.\d{1,2})?)/i },
  { currency: 'EUR', regex: /€\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'GBP', regex: /£\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'KRW', regex: /₩\s?(\d+(?:\.\d{1,2})?)/ },
];

export function parseExpenseText(text) {
  const source = String(text ?? '');
  const matched = CURRENCY_PATTERNS
    .map((pattern) => {
      const match = source.match(pattern.regex);
      return match ? { currency: pattern.currency, amount: Number(match[1]) } : null;
    })
    .find(Boolean);

  const genericAmount = source.match(/(\d+(?:\.\d{1,2})?)/);

  return {
    amount: matched?.amount ?? (genericAmount ? Number(genericAmount[1]) : 0),
    currency: matched?.currency ?? 'CNY',
    description: source.slice(0, 80) || '未命名账单',
    confidence: matched ? 0.82 : 0.42,
  };
}
