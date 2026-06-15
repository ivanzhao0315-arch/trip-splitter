const CURRENCY_PATTERNS = [
  { currency: 'USD', regex: /\$\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'CNY', regex: /(?:¥|RMB|CNY)\s?(\d+(?:\.\d{1,2})?)/i },
  { currency: 'JPY', regex: /(?:JPY|日元)\s?(\d+(?:\.\d{1,2})?)/i },
  { currency: 'EUR', regex: /€\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'HKD', regex: /(?:HKD|港币)\s?(\d+(?:\.\d{1,2})?)/i },
  { currency: 'GBP', regex: /£\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'KRW', regex: /₩\s?(\d+(?:\.\d{1,2})?)/ },
];

function toIsoAtLocalTime({ year, month, day, hour = 12, minute = 0 }) {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function extractExpenseDate(source, now = new Date()) {
  const text = String(source ?? '');
  const baseDate = Number.isNaN(now.getTime()) ? new Date() : now;
  const timeMatch = text.match(/(?:^|[^\d])([01]?\d|2[0-3])[:：]([0-5]\d)(?:[^\d]|$)/);
  const hour = timeMatch ? Number(timeMatch[1]) : 12;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  const isoDate = text.match(/\b(20\d{2})[-/.](1[0-2]|0?[1-9])[-/.](3[01]|[12]\d|0?[1-9])\b/);
  if (isoDate) {
    return toIsoAtLocalTime({
      year: Number(isoDate[1]),
      month: Number(isoDate[2]),
      day: Number(isoDate[3]),
      hour,
      minute,
    });
  }

  const chineseDate = text.match(/(?:(20\d{2})年)?(1[0-2]|0?[1-9])月(3[01]|[12]\d|0?[1-9])日?/);
  if (chineseDate) {
    return toIsoAtLocalTime({
      year: chineseDate[1] ? Number(chineseDate[1]) : baseDate.getFullYear(),
      month: Number(chineseDate[2]),
      day: Number(chineseDate[3]),
      hour,
      minute,
    });
  }

  const relativeDays = [
    { regex: /前天/, offset: -2 },
    { regex: /昨天|昨日/, offset: -1 },
    { regex: /今天|今日/, offset: 0 },
  ];
  const relativeDay = relativeDays.find((item) => item.regex.test(text));
  if (relativeDay) {
    const date = new Date(baseDate);
    date.setHours(hour, minute, 0, 0);
    date.setDate(date.getDate() + relativeDay.offset);
    return date.toISOString();
  }

  if (timeMatch) {
    const date = new Date(baseDate);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  }

  return '';
}

function extractGenericAmount(source) {
  const text = String(source ?? '');
  const amountMatches = [...text.matchAll(/(\d+(?:\.\d{1,2})?)/g)]
    .filter((match) => {
      const previous = text.slice(Math.max(0, match.index - 2), match.index);
      const next = text.slice(match.index + match[0].length, match.index + match[0].length + 2);
      return !/[年月日:/：.-]/.test(previous + next);
    });

  return amountMatches.at(-1)?.[1];
}

export function parseExpenseText(text, now = new Date()) {
  const source = String(text ?? '');
  const matched = CURRENCY_PATTERNS
    .map((pattern) => {
      const match = source.match(pattern.regex);
      return match ? { currency: pattern.currency, amount: Number(match[1]) } : null;
    })
    .find(Boolean);

  const genericAmount = extractGenericAmount(source);
  const createdAt = extractExpenseDate(source, now);

  return {
    amount: matched?.amount ?? (genericAmount ? Number(genericAmount) : 0),
    currency: matched?.currency ?? 'CNY',
    description: source.slice(0, 80) || '未命名账单',
    confidence: matched ? 0.82 : 0.42,
    createdAt,
  };
}
