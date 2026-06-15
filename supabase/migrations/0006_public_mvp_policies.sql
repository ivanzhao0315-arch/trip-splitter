-- Public MVP access model:
-- The current product intentionally has no login. Anyone with the 4-character
-- project code can join and collaborate, so the browser uses the Supabase anon
-- role directly. RLS is enabled explicitly to avoid unmanaged public-table
-- defaults, then scoped to the operations this MVP performs.

alter table public.projects enable row level security;
alter table public.members enable row level security;
alter table public.settlement_periods enable row level security;
alter table public.expenses enable row level security;
alter table public.ai_drafts enable row level security;
alter table public.settlement_snapshots enable row level security;

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.projects to anon, authenticated;
grant select, insert, update, delete on public.members to anon, authenticated;
grant select, insert, update on public.settlement_periods to anon, authenticated;
grant select, insert, update on public.expenses to anon, authenticated;
grant select, insert, update on public.ai_drafts to anon, authenticated;
grant select, insert on public.settlement_snapshots to anon, authenticated;

create policy "public mvp projects select"
  on public.projects for select
  to anon, authenticated
  using (true);

create policy "public mvp projects insert"
  on public.projects for insert
  to anon, authenticated
  with check (true);

create policy "public mvp projects update"
  on public.projects for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public mvp projects delete"
  on public.projects for delete
  to anon, authenticated
  using (true);

create policy "public mvp members select"
  on public.members for select
  to anon, authenticated
  using (true);

create policy "public mvp members insert"
  on public.members for insert
  to anon, authenticated
  with check (true);

create policy "public mvp members update"
  on public.members for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public mvp members delete"
  on public.members for delete
  to anon, authenticated
  using (true);

create policy "public mvp periods select"
  on public.settlement_periods for select
  to anon, authenticated
  using (true);

create policy "public mvp periods insert"
  on public.settlement_periods for insert
  to anon, authenticated
  with check (true);

create policy "public mvp periods update"
  on public.settlement_periods for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public mvp expenses select"
  on public.expenses for select
  to anon, authenticated
  using (true);

create policy "public mvp expenses insert"
  on public.expenses for insert
  to anon, authenticated
  with check (true);

create policy "public mvp expenses update"
  on public.expenses for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public mvp ai drafts select"
  on public.ai_drafts for select
  to anon, authenticated
  using (true);

create policy "public mvp ai drafts insert"
  on public.ai_drafts for insert
  to anon, authenticated
  with check (true);

create policy "public mvp ai drafts update"
  on public.ai_drafts for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "public mvp snapshots select"
  on public.settlement_snapshots for select
  to anon, authenticated
  using (true);

create policy "public mvp snapshots insert"
  on public.settlement_snapshots for insert
  to anon, authenticated
  with check (true);
