export function createBottomNavItems({ onDetails, onStats, onProjects, onSettings }) {
  return [
    { id: 'details', label: '明细', action: onDetails },
    { id: 'stats', label: '统计', action: onStats },
    { id: 'projects', label: '项目', action: onProjects },
    { id: 'settings', label: '设置', action: onSettings },
  ];
}
