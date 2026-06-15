import { toMinorUnits } from '../domain/money';
import { requireSupabase } from './apiClient';

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
}) {
  const client = requireSupabase();

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
      payer_member_id: payerMemberId,
      participant_member_ids: participantMemberIds,
      source_type: sourceType,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
