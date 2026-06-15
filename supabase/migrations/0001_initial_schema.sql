create extension if not exists pgcrypto;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  code text not null unique check (code ~ '^[A-Z0-9]{4}$'),
  default_currency text not null default 'CNY' check (default_currency ~ '^[A-Z]{3}$'),
  active_period_id uuid,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now()
);

create table public.settlement_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  status text not null default 'active' check (status in ('active', 'settled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  settled_at timestamptz
);

alter table public.projects
  add constraint projects_active_period_id_fkey
  foreign key (active_period_id)
  references public.settlement_periods(id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period_id uuid not null references public.settlement_periods(id) on delete restrict,
  original_amount_minor integer not null check (original_amount_minor >= 0),
  original_currency text not null check (original_currency ~ '^[A-Z]{3}$'),
  converted_amount_minor integer not null check (converted_amount_minor >= 0),
  project_currency text not null check (project_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(18, 8) not null default 1 check (exchange_rate > 0),
  exchange_rate_provider text not null default 'identity',
  exchange_rate_timestamp timestamptz not null default now(),
  description text not null default '',
  payer_member_id uuid not null references public.members(id) on delete restrict,
  participant_member_ids uuid[] not null,
  source_type text not null default 'manual' check (source_type in ('manual', 'photo', 'screenshot', 'text')),
  created_at timestamptz not null default now(),
  check (array_length(participant_member_ids, 1) >= 1)
);

create table public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check (source_type in ('photo', 'screenshot', 'text')),
  source_ref text,
  draft_payload jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);

create table public.settlement_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period_id uuid not null references public.settlement_periods(id) on delete restrict,
  project_currency text not null check (project_currency ~ '^[A-Z]{3}$'),
  included_expense_ids uuid[] not null,
  member_balance_payload jsonb not null,
  transfer_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index members_project_id_idx on public.members(project_id);
create index periods_project_id_status_idx on public.settlement_periods(project_id, status);
create index expenses_project_id_period_id_idx on public.expenses(project_id, period_id);
create index ai_drafts_project_id_idx on public.ai_drafts(project_id);
create index snapshots_project_id_idx on public.settlement_snapshots(project_id);
