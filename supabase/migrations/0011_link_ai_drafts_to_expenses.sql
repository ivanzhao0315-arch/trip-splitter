alter table public.expenses
  add column if not exists ai_draft_id uuid references public.ai_drafts(id) on delete set null;

alter table public.ai_drafts
  add column if not exists confirmed_expense_id uuid references public.expenses(id) on delete set null;

create index if not exists expenses_ai_draft_id_idx
  on public.expenses(ai_draft_id);

create index if not exists ai_drafts_confirmed_expense_id_idx
  on public.ai_drafts(confirmed_expense_id);
