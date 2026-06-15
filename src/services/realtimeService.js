import { supabase } from './apiClient';

const PROJECT_REALTIME_TABLES = [
  'members',
  'settlement_periods',
  'expenses',
  'settlement_snapshots',
];

export function subscribeProjectRealtime({ projectId, onChange, onStatusChange, client = supabase }) {
  if (!client || !projectId) return () => {};

  const channel = client
    .channel(`project:${projectId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` },
      onChange
    );

  PROJECT_REALTIME_TABLES.forEach((table) => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `project_id=eq.${projectId}` },
      onChange
    );
  });

  channel.subscribe(onStatusChange);

  return () => {
    if (typeof client.removeChannel === 'function') {
      client.removeChannel(channel);
      return;
    }

    if (typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
  };
}
