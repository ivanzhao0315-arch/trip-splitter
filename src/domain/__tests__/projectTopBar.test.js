import { describe, expect, it } from 'vitest';
import { createProjectTopBarModel } from '../projectTopBar';

describe('project top bar', () => {
  it('models a shared project switcher for project pages', () => {
    expect(createProjectTopBarModel({
      project: { name: '东京五日游', code: 'a7k2' },
    })).toEqual({
      title: '东京五日游',
      contextLabel: '当前项目',
      switchLabel: '切换项目',
      switchHint: '项目列表',
    });
  });
});
