import { toMinorUnits } from '../domain/money';
import { requireSupabase } from './apiClient';

async function normalizeExpenseMembers({ client, projectId, payerMemberId, participantMemberIds }) {
  const uniqueParticipantIds = [...new Set(participantMemberIds ?? [])];
  if (!payerMemberId || uniqueParticipantIds.length === 0) {
    throw new Error('账单必须包含付款人和至少一位参与人');
  }

  const candidateIds = [...new Set([payerMemberId, ...uniqueParticipantIds])];
  const { data: projectMembers, error } = await client
    .from('members')
    .select('id')
    .eq('project_id', projectId)
    .in('id', candidateIds);

  if (error) throw error;

  const validIds = new Set((projectMembers ?? []).map((member) => member.id));
  const invalidIds = candidateIds.filter((memberId) => !validIds.has(memberId));
  if (invalidIds.length) {
    throw new Error('付款人或参与人不属于当前项目');
  }

  return {
    payerMemberId,
    participantMemberIds: uniqueParticipantIds,
  };
}

export async function fetchProjectDetail(projectId) {
  const client = requireSupabase();

  const [{ data: project, error: projectError }, { data: members, error: membersError }] = await Promise.all([
    client.from('projects').select('*').eq('id', projectId).single(),
    client.from('members').select('*').eq('project_id', projectId).order('joined_at'),
  ]);

  if (projectError) throw projectError;
  if (membersError) throw membersError;

  const { data: activePeriod, error: periodError } = await client
    .from('settlement_periods')
    .select('*')
    .eq('id', project.active_period_id)
    .single();

  if (periodError) throw periodError;

  const { data: expenses, error: expensesError } = await client
    .from('expenses')
    .select('*')
    .eq('project_id', projectId)
    .eq('period_id', project.active_period_id)
    .order('created_at', { ascending: false });

  if (expensesError) throw expensesError;

  return { project, members, activePeriod, expenses };
}

export async function createExpense({
  project,
  amount,
  currency,
  convertedAmount,
  exchangeRate,
  exchangeRateProvider,
  exchangeRateTimestamp,
  description,
  payerMemberId,
  participantMemberIds,
  sourceType = 'manual',
  sourceName,
}) {
  const client = requireSupabase();
  const normalizedMembers = await normalizeExpenseMembers({
    client,
    projectId: project.id,
    payerMemberId,
    participantMemberIds,
  });

  const { data, error } = await client
    .from('expenses')
    .insert({
      project_id: project.id,
      period_id: project.active_period_id,
      original_amount_minor: toMinorUnits(amount),
      original_currency: currency,
      converted_amount_minor: toMinorUnits(convertedAmount),
      project_currency: project.default_currency,
      exchange_rate: exchangeRate,
      exchange_rate_provider: exchangeRateProvider,
      exchange_rate_timestamp: exchangeRateTimestamp,
      description,
      payer_member_id: normalizedMembers.payerMemberId,
      participant_member_ids: normalizedMembers.participantMemberIds,
      source_type: sourceType,
      source_name: sourceName ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
