import { createProjectCode, normalizeProjectCode } from '../domain/codes';
import { createCurrentPeriodLabel } from '../domain/periods';
import { requireSupabase } from './apiClient';

const MAX_CODE_ATTEMPTS = 5;

function isUniqueViolation(error) {
  return error?.code === '23505';
}

async function insertProjectWithCode({ client, name, defaultCurrency }) {
  let lastError = null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = createProjectCode();
    const { data, error } = await client
      .from('projects')
      .insert({ name, code, default_currency: defaultCurrency })
      .select()
      .single();

    if (!error) return data;
    if (!isUniqueViolation(error)) throw error;
    lastError = error;
  }

  throw lastError ?? new Error('项目码生成失败，请重试');
}

export async function createProject({ name, defaultCurrency = 'CNY', displayName }) {
  const client = requireSupabase();
  const project = await insertProjectWithCode({ client, name, defaultCurrency });

  try {
    const { data: period, error: periodError } = await client
      .from('settlement_periods')
      .insert({ project_id: project.id, label: createCurrentPeriodLabel() })
      .select()
      .single();

    if (periodError) throw periodError;

    const { error: updateError } = await client
      .from('projects')
      .update({ active_period_id: period.id })
      .eq('id', project.id);

    if (updateError) throw updateError;

    const member = await joinProject({ code: project.code, displayName });

    return {
      ...project,
      active_period_id: period.id,
      current_member_id: member.id,
    };
  } catch (error) {
    await client.from('projects').delete().eq('id', project.id);
    throw error;
  }
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

  const { data: member, error: memberError } = await client
    .from('members')
    .insert({ project_id: project.id, display_name: displayName })
    .select()
    .single();

  if (memberError) throw memberError;

  return { ...member, project };
}
