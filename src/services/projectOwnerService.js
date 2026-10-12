import { requireSupabase } from './apiClient';

const key = (projectId) => `trip-splitter:owner:${projectId}`;

export function readOwnerToken(projectId) {
  try { return window.localStorage.getItem(key(projectId)) ?? ''; } catch { return ''; }
}

export function saveOwnerToken(projectId, token) {
  window.localStorage.setItem(key(projectId), token);
}

export function createOwnerToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyProjectOwner(projectId, token = readOwnerToken(projectId)) {
  if (!token) return false;
  const { data, error } = await requireSupabase().rpc('is_project_owner', { p_project_id: projectId, p_token: token });
  if (error) throw error;
  return data === true;
}
