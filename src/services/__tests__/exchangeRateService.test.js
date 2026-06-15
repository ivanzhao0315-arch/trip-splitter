import { describe, expect, it, vi } from 'vitest';
import { resolveExchangeRateWithFallback } from '../exchangeRateService';

const fallbackRates = {
  USD: { CNY: 7.25 },
};

describe('exchange rate resolution', () => {
  it('uses the server exchange-rate provider before local fallback', async () => {
    const fetchRate = vi.fn(async () => ({
      rate: 7.31,
      provider: 'live-provider',
      timestamp: '2026-06-15T10:00:00.000Z',
    }));

    await expect(resolveExchangeRateWithFallback({
      fromCurrency: 'USD',
      toCurrency: 'CNY',
      fallbackRates,
      fetchRate,
    })).resolves.toEqual({
      rate: 7.31,
      provider: 'live-provider',
      timestamp: '2026-06-15T10:00:00.000Z',
    });
    expect(fetchRate).toHaveBeenCalledWith({ fromCurrency: 'USD', toCurrency: 'CNY' });
  });

  it('falls back locally when the server exchange-rate provider fails', async () => {
    const fetchRate = vi.fn(async () => {
      throw new Error('provider unavailable');
    });

    const resolved = await resolveExchangeRateWithFallback({
      fromCurrency: 'USD',
      toCurrency: 'CNY',
      fallbackRates,
      fetchRate,
    });

    expect(resolved).toMatchObject({
      rate: 7.25,
      provider: 'local-fallback',
    });
  });

  it('does not call the provider for same-currency conversion', async () => {
    const fetchRate = vi.fn();

    const resolved = await resolveExchangeRateWithFallback({
      fromCurrency: 'CNY',
      toCurrency: 'CNY',
      fallbackRates,
      fetchRate,
    });

    expect(resolved).toMatchObject({
      rate: 1,
      provider: 'identity',
    });
    expect(fetchRate).not.toHaveBeenCalled();
  });
});
