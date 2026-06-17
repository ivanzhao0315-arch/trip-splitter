import { describe, expect, it } from 'vitest';
import { createBottomNavItems } from '../bottomNav';

describe('bottom navigation', () => {
  it('uses project list as the third tab', () => {
    const items = createBottomNavItems({});

    expect(items.map((item) => ({ id: item.id, label: item.label }))).toEqual([
      { id: 'details', label: '明细' },
      { id: 'stats', label: '统计' },
      { id: 'projects', label: '项目' },
      { id: 'settings', label: '设置' },
    ]);
  });
});
