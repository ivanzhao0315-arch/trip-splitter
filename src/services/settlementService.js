import { buildSettlementSnapshot, createNextPeriodLabel } from '../domain/periods';
import { calculatePeriodBalances, simplifyTransfers } from '../domain/splitting';
import { requireSupabase } from './apiClient';

export function buildCurrentSettlement({ members, expenses }) {
  const balances = calculatePeriodBalances({
    members,
    expenses: expenses.map((expense) => ({
      payer_member_id: expense.payer_member_id,
      converted_amount_minor: expense.converted_amount_minor,
      participant_member_ids: expense.participant_member_ids,
    })),
  });
  const transfers = simplifyTransfers(balances);
  return { balances, transfers };
}

export async function settleActivePeriod({ project, period, members, expenses }) {
  const client = requireSupabase();
  const { balances, transfers } = buildCurrentSettlement({ members, expenses });
  const snapshotPayload = buildSettlementSnapshot({ project, period, expenses, balances, transfers });

  const { data: snapshot, error: snapshotError } = await client
    .from('settlement_snapshots')
    .insert(snapshotPayload)
    .select()
    .single();

  if (snapshotError) throw snapshotError;

  const now = new Date().toISOString();

  const { error: periodError } = await client
    .from('settlement_periods')
    .update({ status: 'settled', ended_at: now, settled_at: now })
    .eq('id', period.id);

  if (periodError) throw periodError;

  const { data: nextPeriod, error: nextError } = await client
    .from('settlement_periods')
    .insert({ project_id: project.id, label: createNextPeriodLabel(period.label) })
    .select()
    .single();

  if (nextError) throw nextError;

  const { error: projectError } = await client
    .from('projects')
    .update({ active_period_id: nextPeriod.id })
    .eq('id', project.id);

  if (projectError) throw projectError;

  return { snapshot, nextPeriod };
}

export async function fetchSettlementSnapshots(projectId) {
  const client = requireSupabase();

  const { data, error } = await client
    .from('settlement_snapshots')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
