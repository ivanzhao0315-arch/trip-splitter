export function createEqualSplits({ amountMinor, participantIds }) {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error('amountMinor must be a non-negative integer');
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new Error('participantIds must contain at least one member');
  }

  const base = Math.floor(amountMinor / participantIds.length);
  const remainder = amountMinor % participantIds.length;

  return participantIds.map((memberId, index) => ({
    member_id: memberId,
    owed_minor: base + (index < remainder ? 1 : 0),
  }));
}

export function calculatePeriodBalances({ members, expenses }) {
  const memberMap = new Map(
    members.map((member) => [
      member.id,
      {
        member_id: member.id,
        display_name: member.display_name,
        paid_minor: 0,
        owed_minor: 0,
        net_minor: 0,
      },
    ]),
  );

  for (const expense of expenses) {
    const amountMinor = expense.converted_amount_minor;
    const splits = createEqualSplits({
      amountMinor,
      participantIds: expense.participant_member_ids,
    });

    const payer = memberMap.get(expense.payer_member_id);
    if (!payer) {
      throw new Error(`Unknown payer member: ${expense.payer_member_id}`);
    }
    payer.paid_minor += amountMinor;

    for (const split of splits) {
      const member = memberMap.get(split.member_id);
      if (!member) {
        throw new Error(`Unknown participant member: ${split.member_id}`);
      }
      member.owed_minor += split.owed_minor;
    }
  }

  return Array.from(memberMap.values()).map((balance) => ({
    ...balance,
    net_minor: balance.paid_minor - balance.owed_minor,
  }));
}

export function simplifyTransfers(balances) {
  const creditors = balances
    .filter((balance) => balance.net_minor > 0)
    .map((balance) => ({ ...balance }))
    .sort((a, b) => b.net_minor - a.net_minor);

  const debtors = balances
    .filter((balance) => balance.net_minor < 0)
    .map((balance) => ({ ...balance, debt_minor: Math.abs(balance.net_minor) }))
    .sort((a, b) => b.debt_minor - a.debt_minor);

  const transfers = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountMinor = Math.min(creditor.net_minor, debtor.debt_minor);

    if (amountMinor > 0) {
      transfers.push({
        from_member_id: debtor.member_id,
        from_name: debtor.display_name,
        to_member_id: creditor.member_id,
        to_name: creditor.display_name,
        amount_minor: amountMinor,
      });
    }

    creditor.net_minor -= amountMinor;
    debtor.debt_minor -= amountMinor;

    if (creditor.net_minor === 0) creditorIndex += 1;
    if (debtor.debt_minor === 0) debtorIndex += 1;
  }

  return transfers;
}
