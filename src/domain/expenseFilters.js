function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function filterExpenses({ expenses, members = [], query = '', category = '全部' }) {
  const normalizedQuery = normalizeText(query);
  const normalizedCategory = normalizeText(category);
  const memberById = new Map(members.map((member) => [member.id, member]));

  return expenses.filter((expense) => {
    const expenseCategory = String(expense.category ?? '其他').trim() || '其他';
    if (normalizedCategory && normalizedCategory !== '全部' && normalizeText(expenseCategory) !== normalizedCategory) {
      return false;
    }

    if (!normalizedQuery) return true;

    const payer = memberById.get(expense.payer_member_id);
    const searchable = [
      expense.description,
      expenseCategory,
      expense.notes,
      payer?.display_name,
      expense.source_name,
    ]
      .map(normalizeText)
      .filter(Boolean)
      .join(' ');

    return searchable.includes(normalizedQuery);
  });
}
