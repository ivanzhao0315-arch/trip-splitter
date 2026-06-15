const CURRENCY_PATTERNS = [
  { currency: 'USD', regex: /\$\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'CNY', regex: /(?:¥|RMB|CNY)\s?(\d+(?:\.\d{1,2})?)/i },
  { currency: 'JPY', regex: /(?:JPY|日元)\s?(\d+(?:\.\d{1,2})?)/i },
  { currency: 'EUR', regex: /€\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'HKD', regex: /(?:HKD|港币)\s?(\d+(?:\.\d{1,2})?)/i },
  { currency: 'GBP', regex: /£\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'KRW', regex: /₩\s?(\d+(?:\.\d{1,2})?)/ },
];

const CATEGORY_PATTERNS = [
  { category: '餐饮', regex: /餐|饭|晚餐|午餐|早餐|夜宵|咖啡|奶茶|火锅|烧烤|食堂|餐厅|便利店|Starbucks|coffee/i },
  { category: '交通', regex: /打车|出租|地铁|公交|高铁|火车|机票|航班|滴滴|Uber|taxi|车费/i },
  { category: '住宿', regex: /酒店|民宿|住宿|房费|Airbnb|hotel/i },
  { category: '购物', regex: /购物|超市|商场|衣服|鞋|包|免税|买了/i },
  { category: '门票', regex: /门票|票|景区|博物馆|演唱会|电影|展览/i },
  { category: '日用品', regex: /日用品|纸巾|洗衣|清洁|牙膏|洗发|沐浴|用品/i },
  { category: '房租', regex: /房租|租金|rent/i },
  { category: '水电', regex: /水电|电费|水费|燃气|煤气|网费|宽带|物业/i },
];

function inferCategory(source) {
  const text = String(source ?? '');
  return CATEGORY_PATTERNS.find((item) => item.regex.test(text))?.category ?? '其他';
}

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
    category: inferCategory(source),
    confidence: matched ? 0.82 : 0.42,
    createdAt,
  };
}
