import { describe, expect, it, vi } from 'vitest';

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
    expect(client.inserts).toEqual([
      {
        table: 'projects',
        row: {
          name: '北海道旅行',
          code: 'AB12',
          default_currency: 'JPY',
          project_type: 'trip',
        },
      },
      {
        table: 'settlement_periods',
        row: { project_id: 'new-project', label: expect.any(String) },
      },
      {
        table: 'members',
        row: { project_id: 'new-project', display_name: 'Ivan' },
      },
    ]);
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

  it('deletes a member when no expenses reference them', async () => {
    const project = { id: 'project-1', code: 'A7K2', name: '杭州周末游' };
    const existingMember = { id: 'member-1', project_id: project.id, display_name: '张三' };
    const client = createMockClient({ project, members: [existingMember] });
    mockState.client = client;

    await deleteProjectMember({ projectId: project.id, memberId: existingMember.id });

    expect(client.deletes).toEqual([
      { table: 'members', filters: { project_id: project.id, id: existingMember.id } },
    ]);
  });

  it('rejects deleting a member used by an expense participant list', async () => {
    const project = { id: 'project-1', code: 'A7K2', name: '杭州周末游' };
    const existingMember = { id: 'member-1', project_id: project.id, display_name: '张三' };
    const client = createMockClient({
      project,
      members: [existingMember],
      expenses: [
        {
          id: 'expense-1',
          project_id: project.id,
          payer_member_id: 'other-member',
          participant_member_ids: [existingMember.id],
        },
      ],
    });
    mockState.client = client;

    await expect(deleteProjectMember({
      projectId: project.id,
      memberId: existingMember.id,
    })).rejects.toThrow('该成员已有账单记录，不能删除');
    expect(client.deletes).toEqual([]);
  });
});
