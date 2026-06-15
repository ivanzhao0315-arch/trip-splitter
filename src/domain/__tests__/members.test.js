import { describe, expect, it } from 'vitest';
import { findMemberByDisplayName, normalizeMemberDisplayName, upsertMemberByIdentity } from '../members';

const members = [
  { id: 'chen', display_name: '小陈', color: '#22c55e' },
  { id: 'ivan', display_name: 'Ivan', color: '#e1e3e4' },
];

describe('member list helpers', () => {
  it('normalizes display names before comparison', () => {
    expect(normalizeMemberDisplayName('  张三  ')).toBe('张三');
    expect(findMemberByDisplayName(members, '  小陈  ')).toEqual(members[0]);
  });

  it('adds a new member when neither id nor display name exists', () => {
    const nextMembers = upsertMemberByIdentity(members, { id: 'zhang', display_name: '张三' });

    expect(nextMembers).toHaveLength(3);
    expect(nextMembers.at(-1)).toMatchObject({ id: 'zhang', display_name: '张三' });
  });

  it('updates an existing member instead of appending duplicate id', () => {
    const nextMembers = upsertMemberByIdentity(members, { id: 'ivan', display_name: 'Ivan', color: '#d6e0f3' });

    expect(nextMembers).toHaveLength(2);
    expect(nextMembers[1]).toMatchObject({ id: 'ivan', display_name: 'Ivan', color: '#d6e0f3' });
  });

  it('uses display name as identity when the backend returns an existing member', () => {
    const nextMembers = upsertMemberByIdentity(members, { id: 'server-chen', display_name: ' 小陈 ' });

    expect(nextMembers).toHaveLength(2);
    expect(nextMembers[0]).toMatchObject({ id: 'server-chen', display_name: '小陈' });
  });
});
