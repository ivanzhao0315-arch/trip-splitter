import { describe, expect, it } from 'vitest';
import { inferPayerMemberId, inferParticipantMemberIds } from '../memberInference';

const members = [
  { id: 'chen', display_name: '小陈' },
  { id: 'zhang', display_name: '张三' },
  { id: 'ivan', display_name: 'Ivan' },
];

describe('member inference', () => {
  it('detects payer from payment words', () => {
    expect(inferPayerMemberId({ members, text: '张三 已付 晚餐 ¥300，大家平分' })).toBe('zhang');
  });

  it('detects payer from a labeled payer phrase', () => {
    expect(inferPayerMemberId({ members, text: '付款人：小陈 金额 ¥120 参与人 Ivan 张三' })).toBe('chen');
  });

  it('uses explicit participant names from AI draft', () => {
    expect(inferParticipantMemberIds({
      members,
      participantNames: ['小陈', 'Ivan'],
      payerMemberId: 'zhang',
    })).toEqual(['chen', 'ivan']);
  });

  it('detects participant segment from Chinese split text', () => {
    expect(inferParticipantMemberIds({
      members,
      text: '张三 已付 打车 ¥96，平分 小陈 Ivan',
      payerMemberId: 'zhang',
    })).toEqual(['chen', 'ivan']);
  });

  it('defaults everyone when text says everyone splits', () => {
    expect(inferParticipantMemberIds({
      members,
      text: '小陈 paid Starbucks $40.00 大家平分',
      payerMemberId: 'chen',
    })).toEqual(['chen', 'zhang', 'ivan']);
  });

  it('excludes named members before applying everyone wording', () => {
    expect(inferParticipantMemberIds({
      members,
      text: 'Ivan 已付日用品 ¥90，除张三外大家平分',
      payerMemberId: 'ivan',
    })).toEqual(['chen', 'ivan']);
  });
});
