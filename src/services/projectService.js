import { createProjectCode, normalizeProjectCode } from '../domain/codes';
import { createCurrentPeriodLabel } from '../domain/periods';
import { requireSupabase } from './apiClient';
import { createOwnerToken, readOwnerToken, saveOwnerToken } from './projectOwnerService';

const MAX_CODE_ATTEMPTS = 5;

function isUniqueViolation(error) {
  return error?.code === '23505';
}

function normalizeDisplayName(displayName) {
  return String(displayName ?? '').trim();
}

async function findOrCreateMember({ client, projectId, displayName }) {
  const normalizedName = normalizeDisplayName(displayName);
  if (!normalizedName) {
    throw new Error('请输入昵称');
  }

  const { data: existingMember, error: existingError } = await client
    .from('members')
    .select('*')
    .eq('project_id', projectId)
    .eq('display_name', normalizedName)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingMember?.removed_at) throw new Error('该成员已被移出项目');
  if (existingMember) return existingMember;

  const { data: member, error: memberError } = await client
    .from('members')
    .insert({ project_id: projectId, display_name: normalizedName })
    .select()
    .single();

  if (!memberError) return member;
  if (!isUniqueViolation(memberError)) throw memberError;

  const { data: racedMember, error: racedError } = await client
    .from('members')
    .select('*')
    .eq('project_id', projectId)
    .eq('display_name', normalizedName)
    .single();

  if (racedError) throw racedError;
  if (racedMember?.removed_at) throw new Error('该成员已被移出项目');
  return racedMember;
}

export async function createProject({ name, defaultCurrency = 'CNY', displayName, projectType = 'trip', code }) {
  const client = requireSupabase();
  const token = createOwnerToken();
  // Persist before sending so a lost response cannot lose the creator credential.
  window.localStorage.setItem('trip-splitter:pending-owner', token);
  let lastError;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const nextCode = attempt === 0 && normalizeProjectCode(code).length === 4
      ? normalizeProjectCode(code) : createProjectCode();
    const { data, error } = await client.rpc('create_owned_project', {
      p_name: name, p_code: nextCode, p_currency: defaultCurrency,
      p_type: projectType, p_display_name: displayName,
      p_period_label: createCurrentPeriodLabel(), p_token: token,
    });
    if (!error) {
      saveOwnerToken(data.id, token);
      window.localStorage.removeItem('trip-splitter:pending-owner');
      return data;
    }
    if (!isUniqueViolation(error)) throw error;
    lastError = error;
  }
  throw lastError ?? new Error('项目码生成失败，请重试');
}

export async function joinProject({ code, displayName }) {
  const client = requireSupabase();
  const normalizedCode = normalizeProjectCode(code);

  if (normalizedCode.length !== 4) {
    throw new Error('请输入 4 位项目码');
  }

  const { data: project, error: projectError } = await client
    .from('projects')
    .select('*')
    .eq('code', normalizedCode)
    .single();

  if (projectError) throw new Error('项目码不存在');

  const member = await findOrCreateMember({ client, projectId: project.id, displayName });

  return { ...member, project };
}

export async function updateProjectMember({ projectId, memberId, displayName }) {
  const client = requireSupabase();
  const normalizedName = normalizeDisplayName(displayName);

  if (!normalizedName) {
    throw new Error('请输入成员昵称');
  }

  const { data, error } = await client
    .from('members')
    .update({ display_name: normalizedName })
    .eq('project_id', projectId)
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectMember({ projectId, memberId }) {
  const token = readOwnerToken(projectId);
  if (!token) throw new Error('只有项目创建者可以删除成员');
  const { data, error } = await requireSupabase().rpc('remove_project_member', {
    p_project_id: projectId, p_member_id: memberId, p_token: token,
  });
  if (error) throw error;
  return data;
}

export async function updateProjectSettings({ projectId, name }) {
  const client = requireSupabase();
  const normalizedName = String(name ?? '').trim();

  if (!normalizedName) {
    throw new Error('请输入项目名称');
  }

  const { data, error } = await client
    .from('projects')
    .update({
      name: normalizedName,
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
