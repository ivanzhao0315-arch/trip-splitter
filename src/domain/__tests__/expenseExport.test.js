import { describe, expect, it } from 'vitest';
import { buildExpenseCsv, createExpenseExportFilename } from '../expenseExport';

const project = { name: '杭州周末游', default_currency: 'CNY' };
const period = { label: '2026-06' };
const members = [
  { id: 'chen', display_name: '小陈' },
  { id: 'ivan', display_name: 'Ivan' },
];

describe('expense export', () => {
  it('builds a csv with escaped bill details and member names', () => {
    const csv = buildExpenseCsv({
      project,
      period,
      members,
      expenses: [
        {
          created_at: '2026-06-15T10:30:00.000Z',
          category: '餐饮',
          description: 'Dinner, coffee',
          payer_member_id: 'chen',
          participant_member_ids: ['chen', 'ivan'],
          original_amount_minor: 12345,
          original_currency: 'CNY',
          converted_amount_minor: 12345,
          notes: 'He said "ok"',
        },
      ],
    });

    expect(csv).toContain('项目,杭州周末游');
    expect(csv).toContain('周期,2026-06');
    expect(csv).toContain('"Dinner, coffee"');
    expect(csv).toContain('小陈 / Ivan');
    expect(csv).toContain('"He said ""ok"""');
    expect(csv).toContain('¥123.45');
  });

  it('creates a filesystem-friendly filename', () => {
    expect(createExpenseExportFilename({
      project: { name: 'Trip / June' },
      period,
    })).toBe('Trip---June-2026-06-expenses.csv');
  });
});
