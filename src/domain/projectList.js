import { normalizeProjectCode } from './codes';

export function rememberProjectListItem(projects, { project, username, mode, now = new Date().toISOString() }) {
  if (!project?.id || !project?.code || !username) return Array.isArray(projects) ? projects : [];

  const item = {
    id: project.id,
    code: normalizeProjectCode(project.code),
    name: project.name,
    username,
    mode,
    updatedAt: now,
  };
  const currentProjects = Array.isArray(projects) ? projects : [];
  const existing = currentProjects.filter((current) => current.id !== item.id && normalizeProjectCode(current.code) !== item.code);
  return [item, ...existing];
}

export function forgetProjectListItem(projects, projectId) {
  if (!projectId) return Array.isArray(projects) ? projects : [];
  return (Array.isArray(projects) ? projects : []).filter((project) => project.id !== projectId);
}
