import { describe, expect, it } from 'vitest';
import { buildSettlementShareText, summarizeTransfers } from '../settlementShare';

describe('settlement share text', () => {
  it('formats transfer instructions for Chinese group chats', () => {
    expect(buildSettlementShareText({
      project: { name: '杭州周末游' },
      period: { label: '2026-06' },
      currency: 'CNY',
      transfers: [
        { from_name: '张三', to_name: '小陈', amount_minor: 9600 },
        { from_name: 'Ivan', to_name: '小陈', amount_minor: 7400 },
      ],
    })).toBe([
      '杭州周末游 2026-06 结算方案',
      '1. 张三 给 小陈 ¥96.00',
      '2. Ivan 给 小陈 ¥74.00',
    ].join('\n'));
  });

  it('formats an empty settlement message', () => {
    expect(buildSettlementShareText({
      project: { name: '合租账本' },
      period: { label: '2026-06' },
      currency: 'CNY',
      transfers: [],
    })).toBe([
      '合租账本 2026-06 结算方案',
      '当前没有需要互相转账的余额。',
    ].join('\n'));
  });

  it('summarizes settlement history transfers compactly', () => {
    expect(summarizeTransfers([
      { from_name: '张三', to_name: '小陈', amount_minor: 9600 },
    ], 'CNY')).toBe('张三给小陈 ¥96.00');

    expect(summarizeTransfers([
      { from_name: '张三', to_name: '小陈', amount_minor: 9600 },
      { from_name: 'Ivan', to_name: '小陈', amount_minor: 7400 },
    ], 'CNY')).toBe('张三给小陈 ¥96.00 等 2 笔');

    expect(summarizeTransfers([], 'CNY')).toBe('无需转账');
  });
});
