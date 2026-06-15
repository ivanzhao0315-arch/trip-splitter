export function getBillMissingFields({ amount, description, payerMemberId, participantMemberIds }) {
  const missingFields = [];
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    missingFields.push('金额');
  }
  if (!String(description ?? '').trim()) {
    missingFields.push('描述');
  }
  if (!payerMemberId) {
    missingFields.push('付款人');
  }
  if (!participantMemberIds?.length) {
    missingFields.push('参与人');
  }

  return missingFields;
}
