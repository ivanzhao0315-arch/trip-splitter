import { describe, expect, it } from 'vitest';
import { calculatePeriodBalances, createEqualSplits, simplifyTransfers, summarizeExpensesByCategory } from '../splitting';

const members = [
  { id: 'chen', display_name: '小陈' },
  { id: 'zhang', display_name: '张三' },
  { id: 'ivan', display_name: 'Ivan' },
];

describe('equal splitting', () => {
  it('splits cents evenly and assigns remainder cents deterministically', () => {
    const splits = createEqualSplits({
      amountMinor: 10000,
      participantIds: ['chen', 'zhang', 'ivan'],
    });

    expect(splits).toEqual([
      { member_id: 'chen', owed_minor: 3334 },
      { member_id: 'zhang', owed_minor: 3333 },
      { member_id: 'ivan', owed_minor: 3333 },
    ]);
  });

  it('calculates net balances for a period', () => {
    const expenses = [
      { payer_member_id: 'chen', converted_amount_minor: 40000, participant_member_ids: ['chen', 'zhang', 'ivan'] },
      { payer_member_id: 'zhang', converted_amount_minor: 8650, participant_member_ids: ['chen', 'zhang'] },
    ];

    const balances = calculatePeriodBalances({ members, expenses });

    expect(balances).toEqual([
      { member_id: 'chen', display_name: '小陈', paid_minor: 40000, owed_minor: 17659, net_minor: 22341 },
      { member_id: 'zhang', display_name: '张三', paid_minor: 8650, owed_minor: 17658, net_minor: -9008 },
      { member_id: 'ivan', display_name: 'Ivan', paid_minor: 0, owed_minor: 13333, net_minor: -13333 },
    ]);
  });

  it('simplifies debtor-to-creditor transfers', () => {
    const transfers = simplifyTransfers([
      { member_id: 'chen', display_name: '小陈', net_minor: 17000 },
      { member_id: 'zhang', display_name: '张三', net_minor: -9600 },
      { member_id: 'ivan', display_name: 'Ivan', net_minor: -7400 },
    ]);

    expect(transfers).toEqual([
      { from_member_id: 'zhang', from_name: '张三', to_member_id: 'chen', to_name: '小陈', amount_minor: 9600 },
      { from_member_id: 'ivan', from_name: 'Ivan', to_member_id: 'chen', to_name: '小陈', amount_minor: 7400 },
    ]);
  });

  it('summarizes expenses by category', () => {
    const summary = summarizeExpensesByCategory([
      { converted_amount_minor: 12000, category: '住宿' },
      { converted_amount_minor: 3000, category: '交通' },
      { converted_amount_minor: 6000, category: '住宿' },
      { converted_amount_minor: 2000, category: '' },
    ]);

    expect(summary).toEqual([
      { category: '住宿', amount_minor: 18000, count: 2, percentage: 78 },
      { category: '交通', amount_minor: 3000, count: 1, percentage: 13 },
      { category: '其他', amount_minor: 2000, count: 1, percentage: 9 },
    ]);
  });
});
