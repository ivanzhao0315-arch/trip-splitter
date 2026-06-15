import { describe, expect, it } from 'vitest';
import { parseExpenseText } from '../../src/domain/aiParser.js';

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
});
