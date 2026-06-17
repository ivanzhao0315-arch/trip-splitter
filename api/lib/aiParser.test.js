import { describe, expect, it } from 'vitest';
import { parseExpenseText } from '../../src/domain/aiParser.js';

function localIso(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

describe('parseExpenseText', () => {
  it('extracts USD amounts', () => {
    expect(parseExpenseText('Starbucks $40.00')).toMatchObject({
      amount: 40,
      currency: 'USD',
      confidence: 0.82,
    });
  });

  it('defaults ambiguous currency to CNY', () => {
    expect(parseExpenseText('晚餐 286')).toMatchObject({
      amount: 286,
      currency: 'CNY',
      confidence: 0.42,
    });
  });

  it('extracts JPY amounts from travel text', () => {
    expect(parseExpenseText('东京便利店 JPY 1280 Ivan 已付')).toMatchObject({
      amount: 1280,
      currency: 'JPY',
      category: '餐饮',
      confidence: 0.82,
    });
  });

  it('extracts Armenian dram amounts', () => {
    expect(parseExpenseText('Yerevan dinner AMD 12000 Ivan 已付')).toMatchObject({
      amount: 12000,
      currency: 'AMD',
      confidence: 0.82,
    });
  });

  it('infers expense categories from common text hints', () => {
    expect(parseExpenseText('滴滴打车 ¥96 张三 已付')).toMatchObject({ category: '交通' });
    expect(parseExpenseText('民宿房费 ¥1200 Ivan 已付')).toMatchObject({ category: '住宿' });
    expect(parseExpenseText('水电网费 ¥300 大家平分')).toMatchObject({ category: '水电' });
  });

  it('extracts Chinese month-day and time without treating date numbers as amount', () => {
    const draft = parseExpenseText('6月12日 20:30 晚餐 88 Ivan 已付', new Date('2026-06-15T08:00:00.000Z'));

    expect(draft).toMatchObject({
      amount: 88,
      currency: 'CNY',
    });
    expect(draft.createdAt).toBe(localIso(2026, 6, 12, 20, 30));
  });

  it('extracts relative dates with time', () => {
    const draft = parseExpenseText('昨天 19:45 夜宵 ¥66', new Date('2026-06-15T08:00:00.000Z'));

    expect(draft).toMatchObject({
      amount: 66,
      currency: 'CNY',
      createdAt: localIso(2026, 6, 14, 19, 45),
    });
  });
});
