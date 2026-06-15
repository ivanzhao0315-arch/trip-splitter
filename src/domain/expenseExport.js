import { formatMoney, fromMinorUnits } from './money';

function csvCell(value) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function memberName(member) {
  return member?.display_name ?? '未知成员';
}

export function buildExpenseCsv({ project, period, members = [], expenses = [] }) {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const rows = [
    ['项目', project?.name ?? '共享账本'],
    ['周期', period?.label ?? '当前周期'],
    [],
    ['账单时间', '分类', '描述', '付款人', '参与人', '原始金额', '原始币种', '折算金额', '结算币种', '备注'],
    ...expenses.map((expense) => {
      const payer = memberById.get(expense.payer_member_id);
      const participants = (expense.participant_member_ids ?? [])
        .map((memberId) => memberName(memberById.get(memberId)))
        .join(' / ');

      return [
        new Date(expense.created_at).toLocaleString('zh-CN'),
        expense.category ?? '其他',
        expense.description,
        memberName(payer),
        participants,
        formatMoney(fromMinorUnits(expense.original_amount_minor ?? expense.converted_amount_minor), expense.original_currency ?? project.default_currency),
        expense.original_currency ?? project.default_currency,
        formatMoney(fromMinorUnits(expense.converted_amount_minor), project.default_currency),
        project.default_currency,
        expense.notes ?? '',
      ];
    }),
  ];

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export function createExpenseExportFilename({ project, period }) {
  const projectName = String(project?.name ?? 'shared-expenses')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'shared-expenses';
  const periodLabel = String(period?.label ?? 'current').replace(/[\\/:*?"<>|]+/g, '-');

  return `${projectName}-${periodLabel}-expenses.csv`;
}

export function buildSettlementHistoryCsv({ project, settlementHistory = [] }) {
  const rows = [
    ['项目', project?.name ?? '共享账本'],
    ['结算币种', project?.default_currency ?? 'CNY'],
    [],
    ['周期', '归档时间', '总金额', '账单数', '成员', '已付', '应摊', '净额', '转账方案'],
  ];

  for (const snapshot of settlementHistory) {
    const currency = snapshot.project_currency ?? project?.default_currency ?? 'CNY';
    const balances = snapshot.member_balance_payload ?? [];
    const transfers = snapshot.transfer_payload ?? [];
    const totalMinor = balances.reduce((sum, balance) => sum + Number(balance.paid_minor ?? 0), 0);
    const transferText = transfers.length
      ? transfers
        .map((transfer) => `${transfer.from_name} -> ${transfer.to_name} ${formatMoney(fromMinorUnits(transfer.amount_minor), currency)}`)
        .join(' / ')
      : '无需转账';

    if (!balances.length) {
      rows.push([
        snapshot.period_label ?? '历史周期',
        snapshot.created_at ? new Date(snapshot.created_at).toLocaleString('zh-CN') : '',
        formatMoney(fromMinorUnits(totalMinor), currency),
        snapshot.included_expense_ids?.length ?? 0,
        '',
        '',
        '',
        '',
        transferText,
      ]);
      continue;
    }

    for (const balance of balances) {
      rows.push([
        snapshot.period_label ?? '历史周期',
        snapshot.created_at ? new Date(snapshot.created_at).toLocaleString('zh-CN') : '',
        formatMoney(fromMinorUnits(totalMinor), currency),
        snapshot.included_expense_ids?.length ?? 0,
        balance.display_name ?? '未知成员',
        formatMoney(fromMinorUnits(balance.paid_minor ?? 0), currency),
        formatMoney(fromMinorUnits(balance.owed_minor ?? 0), currency),
        `${Number(balance.net_minor ?? 0) >= 0 ? '+' : '-'}${formatMoney(fromMinorUnits(Math.abs(Number(balance.net_minor ?? 0))), currency)}`,
        transferText,
      ]);
    }
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export function createSettlementHistoryExportFilename({ project }) {
  const projectName = String(project?.name ?? 'shared-expenses')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'shared-expenses';

  return `${projectName}-settlement-history.csv`;
}
