alter table public.projects
  add column project_type text not null default 'trip' check (project_type in ('trip', 'roommate')),
  add column budget_amount_minor integer check (budget_amount_minor is null or budget_amount_minor >= 0);
