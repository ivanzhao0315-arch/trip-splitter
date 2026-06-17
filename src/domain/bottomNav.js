export function createBottomNavItems({ onDetails, onStats, onSettings }) {
  return [
    { id: 'details', label: '明细', action: onDetails },
    { id: 'stats', label: '统计', action: onStats },
    { id: 'settings', label: '设置', action: onSettings },
  ];
}
