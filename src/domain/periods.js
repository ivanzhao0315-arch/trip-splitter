export function createCurrentPeriodLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function createNextPeriodLabel(currentLabel, date = new Date()) {
  const baseLabel = createCurrentPeriodLabel(date);
  const source = String(currentLabel ?? '');

  if (!source.startsWith(baseLabel)) {
    return baseLabel;
  }

  const sequence = source.match(/#(\d+)$/)?.[1];
  return `${baseLabel} #${sequence ? Number(sequence) + 1 : 2}`;
}

export function buildSettlementSnapshot({ project, period, expenses, balances, transfers }) {
  return {
    project_id: project.id,
    period_id: period.id,
    period_label: period.label,
    project_currency: project.default_currency,
    included_expense_ids: expenses.map((expense) => expense.id),
    member_balance_payload: balances,
    transfer_payload: transfers,
  };
}
