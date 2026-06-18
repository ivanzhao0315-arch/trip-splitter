export function createProjectTopBarModel({ project }) {
  return {
    title: project?.name ?? '未命名项目',
    contextLabel: '当前项目',
    switchLabel: '切换项目',
    switchHint: '项目列表',
  };
}
