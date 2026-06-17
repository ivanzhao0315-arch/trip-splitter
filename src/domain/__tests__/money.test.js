import { describe, expect, it } from 'vitest';
import { currencySymbol, formatMoney } from '../money';

describe('money formatting', () => {
  it('formats Armenian dram amounts', () => {
    expect(currencySymbol('AMD')).toBe('֏');
    expect(formatMoney(1234.5, 'AMD')).toBe('֏1,234.50');
  });
});
