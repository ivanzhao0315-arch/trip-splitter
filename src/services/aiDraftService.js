export async function createAiDraft({ projectId, sourceType, text, file }) {
  const formData = new FormData();
  formData.set('projectId', projectId);
  formData.set('sourceType', sourceType);
  if (text) formData.set('text', text);
  if (file) formData.set('file', file);

  const response = await fetch('/api/ai-drafts', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('AI 识别失败，请手动填写账单');
  }

  return response.json();
}

export async function discardAiDraft({ projectId, aiDraftId, supabase }) {
  if (!supabase || !projectId || !aiDraftId) return;

  const { error } = await supabase
    .from('ai_drafts')
    .update({ status: 'discarded' })
    .eq('project_id', projectId)
    .eq('id', aiDraftId)
    .eq('status', 'draft');

  if (error) throw error;
}
