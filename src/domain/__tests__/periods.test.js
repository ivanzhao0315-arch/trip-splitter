import { describe, expect, it } from 'vitest';
import { buildSettlementSnapshot, createCurrentPeriodLabel, createNextPeriodLabel } from '../periods';

describe('period labels', () => {
  it('formats the current monthly period', () => {
    expect(createCurrentPeriodLabel(new Date('2026-06-15T10:00:00Z'))).toBe('2026-06');
  });

  it('increments a same-month settlement sequence', () => {
    const date = new Date('2026-06-15T10:00:00Z');

    expect(createNextPeriodLabel('2026-06', date)).toBe('2026-06 #2');
    expect(createNextPeriodLabel('2026-06 #2', date)).toBe('2026-06 #3');
  });

  it('uses the new month when the current date has moved on', () => {
    expect(createNextPeriodLabel('2026-06 #3', new Date('2026-07-01T00:00:00Z'))).toBe('2026-07');
  });

  it('stores the settled period label in snapshots', () => {
    expect(buildSettlementSnapshot({
      project: { id: 'project-1', default_currency: 'CNY' },
      period: { id: 'period-1', label: '2026-06 #2' },
      expenses: [{ id: 'expense-1' }],
      balances: [],
      transfers: [],
    })).toMatchObject({
      project_id: 'project-1',
      period_id: 'period-1',
      period_label: '2026-06 #2',
    });
  });
});
