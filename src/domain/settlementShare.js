import { formatMoney, fromMinorUnits } from './money';

export function summarizeTransfers(transfers, currency = 'CNY') {
  if (!transfers?.length) return '无需转账';

  const [firstTransfer] = transfers;
  const firstLine = `${firstTransfer.from_name}给${firstTransfer.to_name} ${formatMoney(fromMinorUnits(firstTransfer.amount_minor), currency)}`;

  if (transfers.length === 1) return firstLine;
  return `${firstLine} 等 ${transfers.length} 笔`;
}

export function buildSettlementShareText({ project, period, transfers, currency }) {
  const projectName = project?.name ?? '共享账本';
  const periodLabel = period?.label ?? '当前周期';
  const lines = [`${projectName} ${periodLabel} 结算方案`];

  if (!transfers?.length) {
    lines.push('当前没有需要互相转账的余额。');
    return lines.join('\n');
  }

  transfers.forEach((transfer, index) => {
    lines.push(`${index + 1}. ${transfer.from_name} 给 ${transfer.to_name} ${formatMoney(fromMinorUnits(transfer.amount_minor), currency)}`);
  });

  return lines.join('\n');
}
