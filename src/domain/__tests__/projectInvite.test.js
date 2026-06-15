import { describe, expect, it } from 'vitest';
import { buildProjectInviteText } from '../projectInvite';

describe('project invite text', () => {
  it('formats a group-chat friendly project invite', () => {
    expect(buildProjectInviteText({
      projectName: '东京五日游',
      code: 'a7k2',
    })).toBe([
      '我创建了「东京五日游」分账项目',
      '项目码：A7K2',
      '打开分账助手，输入项目码即可加入记账和结算。',
    ].join('\n'));
  });

  it('uses a generic name when the project name is missing', () => {
    expect(buildProjectInviteText({ code: 'Q6Z8' })).toContain('「共享账本」');
  });

  it('includes a direct join link when appUrl is provided', () => {
    expect(buildProjectInviteText({
      projectName: '东京五日游',
      code: 'a7k2',
      appUrl: 'https://trip-splitter.pages.dev/?code=A7K2',
    })).toBe([
      '我创建了「东京五日游」分账项目',
      '项目码：A7K2',
      '加入链接：https://trip-splitter.pages.dev/?code=A7K2',
      '打开链接后输入昵称即可加入记账和结算。',
    ].join('\n'));
  });
});
