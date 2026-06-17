import { normalizeProjectCode } from './codes';

export function createProjectTopBarModel({ project }) {
  return {
    title: project?.name ?? '未命名项目',
    code: normalizeProjectCode(project?.code),
    switchLabel: '切换项目',
    createLabel: '创建项目',
  };
}
