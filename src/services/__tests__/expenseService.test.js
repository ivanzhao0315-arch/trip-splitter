import { describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({ client: null }));

vi.mock('../apiClient', () => ({
  requireSupabase: () => mockState.client,
}));

const { createExpense, deleteExpense } = await import('../expenseService');

function createMockClient({ members = [] } = {}) {
  const inserts = [];
  const deletes = [];

  return {
    inserts,
    deletes,
    from(table) {
      const filters = {};
      let deleteRequested = false;

      return {
        select() {
          return this;
        },
        delete() {
          deleteRequested = true;
          return this;
        },
        eq(field, value) {
          filters[field] = value;
          if (deleteRequested && filters.project_id && filters.id) {
            deletes.push({ table, filters: { ...filters } });
          }
          return this;
        },
        in(field, values) {
          filters[field] = values;
          return this;
        },
        then(resolve) {
          if (table === 'members') {
            const data = members.filter((member) => (
              member.project_id === filters.project_id
              && filters.id.includes(member.id)
            )).map((member) => ({ id: member.id }));
            return Promise.resolve(resolve({ data, error: null }));
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        },
        insert(row) {
          inserts.push({ table, row });
          return {
            select() {
              return {
                single: async () => ({ data: { id: 'expense-1', ...row }, error: null }),
              };
            },
          };
        },
      };
    },
  };
}

const baseExpense = {
  project: {
    id: 'project-1',
    active_period_id: 'period-1',
    default_currency: 'CNY',
  },
  amount: 90,
  currency: 'CNY',
  convertedAmount: 90,
  exchangeRate: 1,
  exchangeRateProvider: 'identity',
  exchangeRateTimestamp: '2026-06-15T10:00:00.000Z',
  description: '晚餐',
  payerMemberId: 'ivan',
  participantMemberIds: ['ivan', 'chen', 'chen'],
  sourceType: 'screenshot',
  sourceName: 'wechat-pay.png',
};

describe('expense service member validation', () => {
  it('deduplicates participants before saving a valid expense', async () => {
    const client = createMockClient({
      members: [
        { id: 'ivan', project_id: 'project-1' },
        { id: 'chen', project_id: 'project-1' },
      ],
    });
    mockState.client = client;

    const expense = await createExpense(baseExpense);

    expect(expense.participant_member_ids).toEqual(['ivan', 'chen']);
    expect(client.inserts[0].row).toMatchObject({
      payer_member_id: 'ivan',
      participant_member_ids: ['ivan', 'chen'],
      source_type: 'screenshot',
      source_name: 'wechat-pay.png',
    });
  });

  it('rejects payer or participant ids outside the project', async () => {
    const client = createMockClient({
      members: [
        { id: 'ivan', project_id: 'project-1' },
      ],
    });
    mockState.client = client;

    await expect(createExpense({
      ...baseExpense,
      participantMemberIds: ['ivan', 'external-member'],
    })).rejects.toThrow('付款人或参与人不属于当前项目');

    expect(client.inserts).toEqual([]);
  });

  it('deletes an expense scoped to the current project', async () => {
    const client = createMockClient();
    mockState.client = client;

    await deleteExpense({ projectId: 'project-1', expenseId: 'expense-1' });

    expect(client.deletes).toEqual([
      { table: 'expenses', filters: { project_id: 'project-1', id: 'expense-1' } },
    ]);
  });
});
