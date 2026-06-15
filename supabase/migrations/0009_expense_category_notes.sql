alter table public.expenses
  add column if not exists category text not null default '其他',
  add column if not exists notes text not null default '';
