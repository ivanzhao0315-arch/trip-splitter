function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function memberDisplayName(member) {
  return member?.display_name ?? '';
}

function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase();
}

function findMemberByName({ members, name }) {
  const target = normalizeName(name);
  if (!target) return null;
  return members.find((member) => normalizeName(memberDisplayName(member)) === target) ?? null;
}

function mentionedMembers({ members, text }) {
  const source = String(text ?? '');
  return members.filter((member) => {
    const name = memberDisplayName(member);
    return name && new RegExp(escapeRegExp(name), 'i').test(source);
  });
}

export function inferPayerMemberId({ members, text, payerName }) {
  const namedPayer = findMemberByName({ members, name: payerName });
  if (namedPayer) return namedPayer.id;

  const source = String(text ?? '');
  const paymentWords = '(已付|支付|付了|付款|垫付|paid|pay|付款人)';
  const namedPayment = source.match(/([\p{L}\p{N}_-]{1,24})\s*(?:已付|支付|付了|付款|垫付|paid|pay)/iu);
  const namedPaymentMember = findMemberByName({ members, name: namedPayment?.[1] });
  if (namedPaymentMember) return namedPaymentMember.id;

  const labeledPayer = source.match(/付款人[:：\s]*([\p{L}\p{N}_-]{1,24})/u);
  const labeledPayerMember = findMemberByName({ members, name: labeledPayer?.[1] });
  if (labeledPayerMember) return labeledPayerMember.id;

  const payerMatch = members.find((member) => {
    const name = memberDisplayName(member);
    if (!name) return false;
    return new RegExp(`${escapeRegExp(name)}\\s*.{0,6}\\s*${paymentWords}`, 'i').test(source);
  });
  if (payerMatch) return payerMatch.id;

  const exactMatch = mentionedMembers({ members, text: source })[0];
  if (exactMatch) return exactMatch.id;
  return members[0]?.id;
}

export function inferParticipantMemberIds({ members, text, participantNames = [], payerMemberId }) {
  const explicitParticipants = participantNames
    .map((name) => findMemberByName({ members, name }))
    .filter(Boolean);
  if (explicitParticipants.length) {
    return [...new Set(explicitParticipants.map((member) => member.id))];
  }

  const source = String(text ?? '');
  const excludedSegment = source.match(/(?:除|不含|除了)\s*([^。；;\n]+?)\s*(?:外|之外)/)?.[1];
  const excludedIds = new Set(mentionedMembers({ members, text: excludedSegment }).map((member) => member.id));
  if (excludedIds.size) {
    const included = members.filter((member) => !excludedIds.has(member.id));
    if (included.length) return included.map((member) => member.id);
  }

  const allWords = /(大家|全员|所有人|全部|全体|everyone|all)/i;
  if (allWords.test(source)) {
    return members.map((member) => member.id);
  }

  const participantSegment = source.match(/(?:参与人|参与|平分|均摊|分摊|AA|split|share|with)[:：]?\s*([^。；;\n]+)/i)?.[1];
  const segmentMentions = mentionedMembers({ members, text: participantSegment });
  if (segmentMentions.length) {
    return segmentMentions.map((member) => member.id);
  }

  const mentions = mentionedMembers({ members, text: source });
  if (mentions.length > 1) {
    return mentions.map((member) => member.id);
  }

  if (mentions.length === 1 && mentions[0].id !== payerMemberId) {
    return mentions.map((member) => member.id);
  }

  return members.map((member) => member.id);
}
