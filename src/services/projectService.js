import { createProjectCode, normalizeProjectCode } from '../domain/codes';
import { toMinorUnits } from '../domain/money';
import { createCurrentPeriodLabel } from '../domain/periods';
import { requireSupabase } from './apiClient';

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
  return racedMember;
}

async function insertProjectWithCode({ client, name, defaultCurrency, projectType, budgetAmount, preferredCode }) {
  let lastError = null;
  const normalizedPreferredCode = normalizeProjectCode(preferredCode);
  const attemptedCodes = new Set();
  let attempts = 0;

  while (attempts < MAX_CODE_ATTEMPTS) {
    const code = attempts === 0 && normalizedPreferredCode.length === 4
      ? normalizedPreferredCode
      : createProjectCode();

    if (attemptedCodes.has(code)) {
      attempts += 1;
      continue;
    }
    attemptedCodes.add(code);
    attempts += 1;

    const { data, error } = await client
      .from('projects')
      .insert({
        name,
        code,
        default_currency: defaultCurrency,
        project_type: projectType,
        budget_amount_minor: budgetAmount ? toMinorUnits(budgetAmount) : null,
      })
      .select()
      .single();

    if (!error) return data;
    if (!isUniqueViolation(error)) throw error;
    lastError = error;
  }

  throw lastError ?? new Error('项目码生成失败，请重试');
}

export async function createProject({ name, defaultCurrency = 'CNY', displayName, projectType = 'trip', budgetAmount = '', code }) {
  const client = requireSupabase();
  const project = await insertProjectWithCode({
    client,
    name,
    defaultCurrency,
    projectType,
    budgetAmount,
    preferredCode: code,
  });

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
  const client = requireSupabase();

  const [
    { data: payerExpenses, error: payerError },
    { data: participantExpenses, error: participantError },
  ] = await Promise.all([
    client
      .from('expenses')
      .select('id, description')
      .eq('project_id', projectId)
      .eq('payer_member_id', memberId)
      .limit(1),
    client
      .from('expenses')
      .select('id, description')
      .eq('project_id', projectId)
      .contains('participant_member_ids', [memberId])
      .limit(1),
  ]);

  if (payerError) throw payerError;
  if (participantError) throw participantError;

  if (payerExpenses?.length || participantExpenses?.length) {
    throw new Error('该成员已有账单记录，不能删除');
  }

  const { error } = await client
    .from('members')
    .delete()
    .eq('project_id', projectId)
    .eq('id', memberId);

  if (error) throw error;
}

export async function updateProjectSettings({ projectId, name, budgetAmount = '' }) {
  const client = requireSupabase();
  const normalizedName = String(name ?? '').trim();
  const normalizedBudget = String(budgetAmount ?? '').trim();

  if (!normalizedName) {
    throw new Error('请输入项目名称');
  }

  const parsedBudget = Number(normalizedBudget);
  if (normalizedBudget && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
    throw new Error('请输入有效预算');
  }

  const { data, error } = await client
    .from('projects')
    .update({
      name: normalizedName,
      budget_amount_minor: normalizedBudget ? toMinorUnits(parsedBudget) : null,
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
