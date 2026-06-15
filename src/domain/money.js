const SYMBOLS = {
  CNY: '¥',
  USD: '$',
  JPY: '¥',
  EUR: '€',
  HKD: 'HK$',
  TWD: 'NT$',
  SGD: 'S$',
  KRW: '₩',
  GBP: '£',
};

export function currencySymbol(currency) {
  return SYMBOLS[currency] ?? currency;
}

export function toMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}

export function fromMinorUnits(minorUnits) {
  return Number((minorUnits / 100).toFixed(2));
}

export function formatMoney(amount, currency = 'CNY') {
  const symbol = currencySymbol(currency);
  return `${symbol}${Number(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
