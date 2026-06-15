import { formatMoney, fromMinorUnits } from './money';

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
