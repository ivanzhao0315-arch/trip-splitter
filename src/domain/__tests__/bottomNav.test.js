import { describe, expect, it } from 'vitest';
import { createBottomNavItems } from '../bottomNav';

describe('bottom navigation', () => {
  it('keeps only project-internal sections in the bottom tabs', () => {
    const items = createBottomNavItems({});

    expect(items.map((item) => ({ id: item.id, label: item.label }))).toEqual([
      { id: 'details', label: '明细' },
      { id: 'stats', label: '统计' },
      { id: 'settings', label: '设置' },
    ]);
  });
});
