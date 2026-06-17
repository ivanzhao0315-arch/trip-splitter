import { describe, expect, it } from 'vitest';
import { forgetProjectListItem, rememberProjectListItem } from '../projectList';

const baseTime = '2026-06-17T10:00:00.000Z';

describe('project list helpers', () => {
  it('keeps multiple projects for the same person', () => {
    const firstProject = { id: 'project-1', code: 'A7K2', name: '东京五日游' };
    const secondProject = { id: 'project-2', code: 'B8M4', name: '合租账本' };

    const firstList = rememberProjectListItem([], {
      project: firstProject,
      username: 'Ivan',
      mode: 'backend',
      now: baseTime,
    });
    const nextList = rememberProjectListItem(firstList, {
      project: secondProject,
      username: 'Ivan',
      mode: 'backend',
      now: baseTime,
    });

    expect(nextList).toHaveLength(2);
    expect(nextList.map((item) => item.id)).toEqual(['project-2', 'project-1']);
  });

  it('moves an existing project to the top without duplicating it', () => {
    const list = [
      { id: 'project-1', code: 'A7K2', name: '东京五日游', username: 'Ivan', mode: 'backend', updatedAt: baseTime },
      { id: 'project-2', code: 'B8M4', name: '合租账本', username: 'Ivan', mode: 'backend', updatedAt: baseTime },
    ];

    const nextList = rememberProjectListItem(list, {
      project: { id: 'project-1', code: 'A7K2', name: '东京五日游 2026' },
      username: 'Ivan',
      mode: 'backend',
      now: '2026-06-17T11:00:00.000Z',
    });

    expect(nextList).toEqual([
      {
        id: 'project-1',
        code: 'A7K2',
        name: '东京五日游 2026',
        username: 'Ivan',
        mode: 'backend',
        updatedAt: '2026-06-17T11:00:00.000Z',
      },
      list[1],
    ]);
  });

  it('removes only the selected project from the list', () => {
    const list = [
      { id: 'project-1', code: 'A7K2', name: '东京五日游', username: 'Ivan', mode: 'backend', updatedAt: baseTime },
      { id: 'project-2', code: 'B8M4', name: '合租账本', username: 'Ivan', mode: 'backend', updatedAt: baseTime },
    ];

    expect(forgetProjectListItem(list, 'project-1')).toEqual([list[1]]);
  });
});
