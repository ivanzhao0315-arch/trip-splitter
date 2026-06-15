import { describe, expect, it } from 'vitest';
import { getBillMissingFields } from '../billValidation';

describe('bill confirmation validation', () => {
  it('requires a positive amount and description', () => {
    expect(getBillMissingFields({
      amount: 0,
      description: '  ',
      payerMemberId: 'chen',
      participantMemberIds: ['chen'],
    })).toEqual(['金额', '描述']);
  });

  it('requires payer and at least one participant', () => {
    expect(getBillMissingFields({
      amount: 100,
      description: '晚餐',
      payerMemberId: '',
      participantMemberIds: [],
    })).toEqual(['付款人', '参与人']);
  });

  it('passes complete confirmed bill fields', () => {
    expect(getBillMissingFields({
      amount: '88.5',
      description: '咖啡',
      payerMemberId: 'chen',
      participantMemberIds: ['chen', 'zhang'],
    })).toEqual([]);
  });
});
