import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  const values = new Map();
  vi.stubGlobal('window', { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } });
});

const mockState = vi.hoisted(() => ({ client: null }));

vi.mock('../apiClient', () => ({
  requireSupabase: () => mockState.client,
}));

const {
  createProject,
  deleteProjectMember,
  joinProject,
  updateProjectMember,
  updateProjectSettings,
} = await import('../projectService');

function createMockClient({ project, members = [], expenses = [] }) {
  const inserts = [];
  const updates = [];
  const deletes = [];
  let currentProject = project;

  function findMember(filters) {
    return members.find((member) => {
      if (filters.id && member.id !== filters.id) return false;
      if (filters.project_id && member.project_id !== filters.project_id) return false;
      if (filters.display_name && member.display_name !== filters.display_name) return false;
      return true;
    });
  }

  return {
    inserts,
    updates,
    deletes,
    rpc: vi.fn(async (name, args) => ({ data: { id: 'new-project', code: args.p_code, active_period_id: 'new-period', current_member_id: 'new-member' }, error: null })),
    from(table) {
      const filters = {};
      let updateRow = null;
      let deleteRequested = false;
      let containsFilter = null;

      return {
        select() {
          return this;
        },
        update(row) {
          updateRow = row;
          return this;
        },
        delete() {
          deleteRequested = true;
          return this;
        },
        contains(field, value) {
          containsFilter = { field, value };
          return this;
        },
        limit() {
          return this;
        },
        eq(field, value) {
          filters[field] = value;
          if (deleteRequested && table === 'members' && filters.project_id && filters.id) {
            deletes.push({ table, filters: { ...filters } });
            return { error: null };
          }
          return this;
        },
        maybeSingle: async () => {
          if (table === 'members') {
            return { data: findMember(filters) ?? null, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (table === 'projects') {
            if (updateRow) {
              const data = { ...currentProject, ...updateRow };
              currentProject = data;
              updates.push({ table, row: updateRow, filters: { ...filters } });
              return { data, error: null };
            }
            return currentProject?.code === filters.code
              ? { data: currentProject, error: null }
              : { data: null, error: { message: 'not found' } };
          }
          if (table === 'members') {
            const member = findMember(filters);
            if (updateRow) {
              const data = { ...member, ...updateRow };
              updates.push({ table, row: updateRow, filters: { ...filters } });
              return { data, error: null };
            }
            return { data: member, error: null };
          }
          return { data: null, error: null };
        },
        insert(row) {
          inserts.push({ table, row });
          let data = { id: 'new-member', joined_at: new Date(0).toISOString(), ...row };
          if (table === 'projects') {
            data = { id: 'new-project', created_at: new Date(0).toISOString(), ...row };
            currentProject = data;
          }
          if (table === 'settlement_periods') {
            data = { id: 'new-period', status: 'active', started_at: new Date(0).toISOString(), ...row };
          }
          return {
            select() {
              return {
                single: async () => ({ data, error: null }),
              };
            },
          };
        },
        then(resolve) {
          if (updateRow && table === 'projects' && filters.id) {
            currentProject = { ...currentProject, ...updateRow };
            updates.push({ table, row: updateRow, filters: { ...filters } });
            resolve({ error: null });
            return;
          }

          if (table === 'expenses') {
            let data = expenses.filter((expense) => (
              (!filters.project_id || expense.project_id === filters.project_id)
              && (!filters.payer_member_id || expense.payer_member_id === filters.payer_member_id)
            ));

            if (containsFilter) {
              data = data.filter((expense) => {
                const values = expense[containsFilter.field] ?? [];
                return containsFilter.value.every((value) => values.includes(value));
              });
            }

            resolve({ data: data.slice(0, 1), error: null });
            return;
          }

          resolve({ data: null, error: null });
        },
      };
    },
  };
}

describe('project service member joins', () => {
  it('uses the preferred create code as the persisted project code', async () => {
    const client = createMockClient({ project: null });
    mockState.client = client;

    const project = await createProject({
      name: '北海道旅行',
      defaultCurrency: 'JPY',
      displayName: 'Ivan',
      projectType: 'trip',
      code: 'ab12',
    });

    expect(project).toMatchObject({
      id: 'new-project',
      code: 'AB12',
      active_period_id: 'new-period',
      current_member_id: 'new-member',
    });
    expect(client.rpc).toHaveBeenCalledWith('create_owned_project', {
      p_name: '北海道旅行', p_code: 'AB12', p_currency: 'JPY', p_type: 'trip',
      p_display_name: 'Ivan', p_period_label: expect.any(String), p_token: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(window.localStorage.getItem('trip-splitter:owner:new-project')).toHaveLength(64);
  });

  it('reuses an existing member when joining with the same nickname', async () => {
    const project = { id: 'project-1', code: 'A7K2', name: '杭州周末游' };
    const existingMember = { id: 'member-1', project_id: project.id, display_name: 'Ivan' };
    const client = createMockClient({ project, members: [existingMember] });
    mockState.client = client;

    const member = await joinProject({ code: 'a7k2', displayName: 'Ivan' });

    expect(member).toMatchObject({ id: 'member-1', project });
    expect(client.inserts).toEqual([]);
  });

  it('updates project name', async () => {
    const project = { id: 'project-1', code: 'A7K2', name: '杭州周末游' };
    const client = createMockClient({ project });
    mockState.client = client;

    const updated = await updateProjectSettings({
      projectId: project.id,
      name: ' 东京五日游 ',
    });

    expect(updated).toMatchObject({ name: '东京五日游' });
    expect(client.updates).toEqual([
      {
        table: 'projects',
        row: { name: '东京五日游' },
        filters: { id: project.id },
      },
    ]);
  });

  it('updates a member nickname within the current project', async () => {
    const project = { id: 'project-1', code: 'A7K2', name: '杭州周末游' };
    const existingMember = { id: 'member-1', project_id: project.id, display_name: '张三' };
    const client = createMockClient({ project, members: [existingMember] });
    mockState.client = client;

    const updated = await updateProjectMember({
      projectId: project.id,
      memberId: existingMember.id,
      displayName: ' 李四 ',
    });

    expect(updated).toMatchObject({ id: existingMember.id, display_name: '李四' });
    expect(client.updates).toEqual([
      {
        table: 'members',
        row: { display_name: '李四' },
        filters: { project_id: project.id, id: existingMember.id },
      },
    ]);
  });

  it('requires a creator credential before attempting member removal', async () => {
    const client = createMockClient({ project: null });
    mockState.client = client;
    await expect(deleteProjectMember({ projectId: 'p', memberId: 'm' })).rejects.toThrow('只有项目创建者');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('uses the protected RPC and returns the archived member without deleting bills', async () => {
    const client = createMockClient({ project: null });
    mockState.client = client;
    const member = { id: 'm', removed_at: '2026-10-12T00:00:00Z' };
    client.rpc.mockResolvedValue({ data: member, error: null });
    window.localStorage.setItem('trip-splitter:owner:p', 'secret');
    await expect(deleteProjectMember({ projectId: 'p', memberId: 'm' })).resolves.toEqual(member);
    expect(client.rpc).toHaveBeenCalledWith('remove_project_member', { p_project_id: 'p', p_member_id: 'm', p_token: 'secret' });
    expect(client.deletes).toEqual([]);
  });

  it('propagates server-side permission denial even with a stored credential', async () => {
    const client = createMockClient({ project: null });
    mockState.client = client;
    client.rpc.mockResolvedValue({ data: null, error: new Error('只有项目创建者可以删除成员') });
    window.localStorage.setItem('trip-splitter:owner:p', 'forged');
    await expect(deleteProjectMember({ projectId: 'p', memberId: 'm' })).rejects.toThrow('只有项目创建者');
  });

  it('does not rejoin or recreate a removed member with the same nickname', async () => {
    const project = { id: 'p', code: 'AB12' };
    const client = createMockClient({ project, members: [{ id: 'm', project_id: 'p', display_name: 'laoma', removed_at: '2026-10-12' }] });
    mockState.client = client;
    await expect(joinProject({ code: 'AB12', displayName: 'laoma' })).rejects.toThrow('已被移出');
    expect(client.inserts).toEqual([]);
  });
});
