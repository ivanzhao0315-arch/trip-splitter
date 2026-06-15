import { describe, expect, it } from 'vitest';
import { formatExpenseShareText } from '../expenseShare';

describe('expense share text', () => {
  it('formats a single expense summary for copying', () => {
    expect(formatExpenseShareText({
      project: { default_currency: 'CNY' },
      members: [
        { id: 'chen', display_name: '小陈' },
        { id: 'ivan', display_name: 'Ivan' },
      ],
      expense: {
        description: '晚餐',
        payer_member_id: 'chen',
        participant_member_ids: ['chen', 'ivan'],
        converted_amount_minor: 6000,
      },
    })).toBe([
      '账单：晚餐',
      '金额：¥60.00',
      '付款人：小陈',
      '参与人：小陈、Ivan',
      '分摊：2人平分，每人约 ¥30.00',
    ].join('\n'));
  });
});
