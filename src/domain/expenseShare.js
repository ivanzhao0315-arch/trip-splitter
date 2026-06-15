import { formatMoney, fromMinorUnits } from './money';

function memberName(member) {
  return member?.display_name ?? '未知成员';
}

export function formatExpenseShareText({ expense, project, members = [] }) {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const currency = project?.default_currency ?? expense?.project_currency ?? 'CNY';
  const participantIds = expense?.participant_member_ids ?? [];
  const payerName = memberName(memberById.get(expense?.payer_member_id));
  const participantNames = participantIds
    .map((memberId) => memberName(memberById.get(memberId)))
    .join('、');
  const amountLabel = formatMoney(fromMinorUnits(expense?.converted_amount_minor ?? 0), currency);
  const splitMinor = participantIds.length
    ? Math.round((expense?.converted_amount_minor ?? 0) / participantIds.length)
    : 0;
  const splitLabel = formatMoney(fromMinorUnits(splitMinor), currency);
  const description = expense?.description || '未命名账单';

  return [
    `账单：${description}`,
    `金额：${amountLabel}`,
    `付款人：${payerName}`,
    `参与人：${participantNames || '无'}`,
    `分摊：${participantIds.length}人平分，每人约 ${splitLabel}`,
  ].join('\n');
}
