function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function expenseTimestamp(expense) {
  const timestamp = new Date(expense.created_at ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function expenseAmount(expense) {
  const amount = Number(expense.converted_amount_minor ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sortFilteredExpenses(expenses, sort = 'newest') {
  return [...expenses].sort((a, b) => {
    if (sort === 'oldest') return expenseTimestamp(a) - expenseTimestamp(b);
    if (sort === 'amount_desc') return expenseAmount(b) - expenseAmount(a) || expenseTimestamp(b) - expenseTimestamp(a);
    if (sort === 'amount_asc') return expenseAmount(a) - expenseAmount(b) || expenseTimestamp(b) - expenseTimestamp(a);
    return expenseTimestamp(b) - expenseTimestamp(a);
  });
}

export function filterExpenses({ expenses, members = [], query = '', category = '全部', sort = 'newest' }) {
  const normalizedQuery = normalizeText(query);
  const normalizedCategory = normalizeText(category);
  const memberById = new Map(members.map((member) => [member.id, member]));

  const filtered = expenses.filter((expense) => {
    const expenseCategory = String(expense.category ?? '其他').trim() || '其他';
    if (normalizedCategory && normalizedCategory !== '全部' && normalizeText(expenseCategory) !== normalizedCategory) {
      return false;
    }

    if (!normalizedQuery) return true;

    const payer = memberById.get(expense.payer_member_id);
    const participantNames = (expense.participant_member_ids ?? [])
      .map((memberId) => memberById.get(memberId)?.display_name)
      .filter(Boolean);
    const searchable = [
      expense.description,
      expenseCategory,
      expense.notes,
      payer?.display_name,
      ...participantNames,
      expense.source_name,
    ]
      .map(normalizeText)
      .filter(Boolean)
      .join(' ');

    return searchable.includes(normalizedQuery);
  });

  return sortFilteredExpenses(filtered, sort);
}
