import { describe, expect, it } from 'vitest';
import { createProjectTopBarModel } from '../projectTopBar';

describe('project top bar', () => {
  it('models a shared project switcher and create action for project pages', () => {
    expect(createProjectTopBarModel({
      project: { name: '东京五日游', code: 'a7k2' },
    })).toEqual({
      title: '东京五日游',
      code: 'A7K2',
      switchLabel: '切换项目',
      createLabel: '创建项目',
    });
  });
});
