create index if not exists projects_active_period_id_idx
  on public.projects(active_period_id);

create index if not exists expenses_period_id_idx
  on public.expenses(period_id);

create index if not exists expenses_payer_member_id_idx
  on public.expenses(payer_member_id);

create index if not exists snapshots_period_id_idx
  on public.settlement_snapshots(period_id);
