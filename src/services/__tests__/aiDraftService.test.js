import { describe, expect, it, vi } from 'vitest';

const { discardAiDraft } = await import('../aiDraftService');

function createMockSupabase() {
  const updates = [];

  return {
    updates,
    from(table) {
      const filters = {};
      let updateRow = null;

      return {
        update(row) {
          updateRow = row;
          return this;
        },
        eq(field, value) {
          filters[field] = value;
          return this;
        },
        then(resolve) {
          updates.push({ table, row: updateRow, filters: { ...filters } });
          return Promise.resolve(resolve({ error: null }));
        },
      };
    },
  };
}

describe('AI draft service', () => {
  it('marks a project-scoped draft as discarded only while it is still a draft', async () => {
    const supabase = createMockSupabase();

    await discardAiDraft({
      projectId: 'project-1',
      aiDraftId: 'draft-1',
      supabase,
    });

    expect(supabase.updates).toEqual([
      {
        table: 'ai_drafts',
        row: { status: 'discarded' },
        filters: {
          project_id: 'project-1',
          id: 'draft-1',
          status: 'draft',
        },
      },
    ]);
  });

  it('does nothing when required discard inputs are missing', async () => {
    const supabase = createMockSupabase();

    await discardAiDraft({ projectId: '', aiDraftId: 'draft-1', supabase });
    await discardAiDraft({ projectId: 'project-1', aiDraftId: '', supabase });
    await discardAiDraft({ projectId: 'project-1', aiDraftId: 'draft-1', supabase: null });

    expect(supabase.updates).toEqual([]);
  });

  it('surfaces Supabase discard errors', async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve) => Promise.resolve(resolve({ error: new Error('failed') })),
      })),
    };

    await expect(discardAiDraft({
      projectId: 'project-1',
      aiDraftId: 'draft-1',
      supabase,
    })).rejects.toThrow('failed');
  });
});
