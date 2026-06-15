grant delete on public.expenses to anon, authenticated;

create policy "public mvp expenses delete"
  on public.expenses for delete
  to anon, authenticated
  using (true);
