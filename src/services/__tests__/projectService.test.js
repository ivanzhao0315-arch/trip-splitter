import { describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({ client: null }));

vi.mock('../apiClient', () => ({
  requireSupabase: () => mockState.client,
}));

const { addProjectMember, joinProject } = await import('../projectService');

function createMockClient({ project, members = [] }) {
  const inserts = [];

  function findMember(filters) {
    return members.find((member) => (
      member.project_id === filters.project_id
      && member.display_name === filters.display_name
    ));
  }

  return {
    inserts,
    from(table) {
      const filters = {};

      return {
        select() {
          return this;
        },
        eq(field, value) {
          filters[field] = value;
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
            return project.code === filters.code
              ? { data: project, error: null }
              : { data: null, error: { message: 'not found' } };
          }
          if (table === 'members') {
            return { data: findMember(filters), error: null };
          }
          return { data: null, error: null };
        },
        insert(row) {
          inserts.push({ table, row });
          const data = { id: 'new-member', joined_at: new Date(0).toISOString(), ...row };
          return {
            select() {
              return {
                single: async () => ({ data, error: null }),
              };
            },
          };
        },
      };
    },
  };
}

describe('project service member joins', () => {
  it('reuses an existing member when joining with the same nickname', async () => {
    const project = { id: 'project-1', code: 'A7K2', name: '杭州周末游' };
    const existingMember = { id: 'member-1', project_id: project.id, display_name: 'Ivan' };
    const client = createMockClient({ project, members: [existingMember] });
    mockState.client = client;

    const member = await joinProject({ code: 'a7k2', displayName: 'Ivan' });

    expect(member).toMatchObject({ id: 'member-1', project });
    expect(client.inserts).toEqual([]);
  });

  it('trims and creates a member when the nickname is new', async () => {
    const project = { id: 'project-1', code: 'A7K2', name: '杭州周末游' };
    const client = createMockClient({ project });
    mockState.client = client;

    const member = await addProjectMember({ projectId: project.id, displayName: ' 张三 ' });

    expect(member).toMatchObject({ id: 'new-member', display_name: '张三' });
    expect(client.inserts).toEqual([
      { table: 'members', row: { project_id: project.id, display_name: '张三' } },
    ]);
  });
});
