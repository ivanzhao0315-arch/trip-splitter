import { describe, expect, it } from 'vitest';
import {
  buildExpenseCsv,
  buildSettlementHistoryCsv,
  createExpenseExportFilename,
  createSettlementHistoryExportFilename,
} from '../expenseExport';

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

  it('builds a settlement history csv with balances and transfers', () => {
    const csv = buildSettlementHistoryCsv({
      project,
      settlementHistory: [
        {
          period_label: '2026-06 #2',
          project_currency: 'CNY',
          created_at: '2026-06-15T12:00:00.000Z',
          included_expense_ids: ['e1', 'e2'],
          member_balance_payload: [
            {
              display_name: '小陈',
              paid_minor: 30000,
              owed_minor: 20000,
              net_minor: 10000,
            },
            {
              display_name: 'Ivan',
              paid_minor: 10000,
              owed_minor: 20000,
              net_minor: -10000,
            },
          ],
          transfer_payload: [
            {
              from_name: 'Ivan',
              to_name: '小陈',
              amount_minor: 10000,
            },
          ],
        },
      ],
    });

    expect(csv).toContain('项目,杭州周末游');
    expect(csv).toContain('周期,归档时间,总金额,账单数,成员,已付,应摊,净额,转账方案');
    expect(csv).toContain('2026-06 #2');
    expect(csv).toContain('¥400.00,2,小陈,¥300.00,¥200.00,+¥100.00');
    expect(csv).toContain('Ivan -> 小陈 ¥100.00');
  });

  it('creates a settlement history export filename', () => {
    expect(createSettlementHistoryExportFilename({
      project: { name: 'Trip / June' },
    })).toBe('Trip---June-settlement-history.csv');
  });
});
