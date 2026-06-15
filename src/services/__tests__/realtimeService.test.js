import { describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({ client: null }));

vi.mock('../apiClient', () => ({
  supabase: mockState.client,
}));

const { subscribeProjectRealtime } = await import('../realtimeService');

function createRealtimeClient() {
  const handlers = [];
  const channel = {
    on: vi.fn((event, options, callback) => {
      handlers.push({ event, options, callback });
      return channel;
    }),
    subscribe: vi.fn(() => channel),
    unsubscribe: vi.fn(),
  };
  return {
    channel,
    handlers,
    client: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
}

describe('realtime project subscription', () => {
  it('subscribes to the current project tables with scoped filters', () => {
    const realtime = createRealtimeClient();
    const onChange = vi.fn();
    const onStatusChange = vi.fn();

    const unsubscribe = subscribeProjectRealtime({
      projectId: 'project-1',
      onChange,
      onStatusChange,
      client: realtime.client,
    });

    expect(realtime.client.channel).toHaveBeenCalledWith('project:project-1');
    expect(realtime.channel.subscribe).toHaveBeenCalledWith(onStatusChange);
    expect(realtime.handlers.map((handler) => handler.options)).toEqual([
      { event: '*', schema: 'public', table: 'projects', filter: 'id=eq.project-1' },
      { event: '*', schema: 'public', table: 'members', filter: 'project_id=eq.project-1' },
      { event: '*', schema: 'public', table: 'settlement_periods', filter: 'project_id=eq.project-1' },
      { event: '*', schema: 'public', table: 'expenses', filter: 'project_id=eq.project-1' },
      { event: '*', schema: 'public', table: 'settlement_snapshots', filter: 'project_id=eq.project-1' },
    ]);

    realtime.handlers[0].callback({ eventType: 'UPDATE' });
    expect(onChange).toHaveBeenCalledWith({ eventType: 'UPDATE' });

    unsubscribe();
    expect(realtime.client.removeChannel).toHaveBeenCalledWith(realtime.channel);
  });

  it('returns a no-op cleanup when realtime is unavailable', () => {
    expect(() => subscribeProjectRealtime({ projectId: 'project-1', onChange: vi.fn(), client: null })()).not.toThrow();
    expect(() => subscribeProjectRealtime({ projectId: '', onChange: vi.fn(), client: {} })()).not.toThrow();
  });
});
