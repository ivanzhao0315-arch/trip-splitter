import { describe, expect, it } from 'vitest';
import { filterExpenses } from '../expenseFilters';

const members = [
  { id: 'chen', display_name: '小陈' },
  { id: 'ivan', display_name: 'Ivan' },
  { id: 'zhang', display_name: '张三' },
];

const expenses = [
  {
    id: 'e1',
    description: 'Dinner',
    category: '餐饮',
    notes: 'birthday',
    payer_member_id: 'chen',
    participant_member_ids: ['chen', 'zhang'],
    source_name: 'receipt.jpg',
    converted_amount_minor: 6000,
    created_at: '2026-06-15T08:00:00.000Z',
  },
  {
    id: 'e2',
    description: 'Taxi',
    category: '交通',
    notes: '',
    payer_member_id: 'ivan',
    participant_member_ids: ['ivan'],
    converted_amount_minor: 2500,
    created_at: '2026-06-15T10:00:00.000Z',
  },
  {
    id: 'e3',
    description: 'Hotel',
    category: '',
    notes: 'lake view',
    payer_member_id: 'chen',
    participant_member_ids: ['chen'],
    converted_amount_minor: 12000,
    created_at: '2026-06-14T22:00:00.000Z',
  },
];

describe('expense filters', () => {
  it('filters expenses by category', () => {
    const filtered = filterExpenses({ expenses, members, category: '餐饮' });

    expect(filtered.map((expense) => expense.id)).toEqual(['e1']);
  });

  it('searches description, notes, payer name, participant name, source, and normalized category', () => {
    expect(filterExpenses({ expenses, members, query: 'dinner' }).map((expense) => expense.id)).toEqual(['e1']);
    expect(filterExpenses({ expenses, members, query: 'birthday' }).map((expense) => expense.id)).toEqual(['e1']);
    expect(filterExpenses({ expenses, members, query: 'ivan' }).map((expense) => expense.id)).toEqual(['e2']);
    expect(filterExpenses({ expenses, members, query: '张三' }).map((expense) => expense.id)).toEqual(['e1']);
    expect(filterExpenses({ expenses, members, query: 'receipt' }).map((expense) => expense.id)).toEqual(['e1']);
    expect(filterExpenses({ expenses, members, query: '其他' }).map((expense) => expense.id)).toEqual(['e3']);
  });

  it('combines search and category filters', () => {
    const filtered = filterExpenses({ expenses, members, query: 'taxi', category: '餐饮' });

    expect(filtered).toEqual([]);
  });

  it('sorts filtered expenses without mutating the input list', () => {
    const sortedByNewest = filterExpenses({ expenses, members });
    const sortedByAmount = filterExpenses({ expenses, members, sort: 'amount_desc' });

    expect(sortedByNewest.map((expense) => expense.id)).toEqual(['e2', 'e1', 'e3']);
    expect(sortedByAmount.map((expense) => expense.id)).toEqual(['e3', 'e1', 'e2']);
    expect(expenses.map((expense) => expense.id)).toEqual(['e1', 'e2', 'e3']);
  });
});
