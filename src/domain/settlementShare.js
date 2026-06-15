import { formatMoney, fromMinorUnits } from './money';

export function summarizeTransfers(transfers, currency = 'CNY') {
  if (!transfers?.length) return '无需转账';

  const [firstTransfer] = transfers;
  const firstLine = formatTransferInstruction(firstTransfer, currency, { compact: true });

  if (transfers.length === 1) return firstLine;
  return `${firstLine} 等 ${transfers.length} 笔`;
}

export function formatTransferInstruction(transfer, currency = 'CNY', { compact = false } = {}) {
  const separator = compact ? '给' : ' 给 ';
  return `${transfer.from_name}${separator}${transfer.to_name} ${formatMoney(fromMinorUnits(transfer.amount_minor), currency)}`;
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
    lines.push(`${index + 1}. ${formatTransferInstruction(transfer, currency)}`);
  });

  return lines.join('\n');
}
