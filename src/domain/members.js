export function normalizeMemberDisplayName(displayName) {
  return String(displayName ?? '').trim();
}

export function findMemberByDisplayName(members, displayName) {
  const normalizedName = normalizeMemberDisplayName(displayName);
  return members.find((member) => normalizeMemberDisplayName(member.display_name) === normalizedName) ?? null;
}

export function upsertMemberByIdentity(members, member) {
  if (!member?.id) return members;

  const normalizedName = normalizeMemberDisplayName(member.display_name);
  const normalizedMember = { ...member, display_name: normalizedName };
  const existingIndex = members.findIndex((item) => (
    item.id === member.id || normalizeMemberDisplayName(item.display_name) === normalizedName
  ));

  if (existingIndex === -1) {
    return [...members, normalizedMember];
  }

  return members.map((item, index) => (index === existingIndex ? { ...item, ...normalizedMember } : item));
}
