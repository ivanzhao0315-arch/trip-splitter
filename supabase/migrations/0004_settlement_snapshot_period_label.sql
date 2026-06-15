alter table public.settlement_snapshots
  add column period_label text;

update public.settlement_snapshots snapshots
set period_label = periods.label
from public.settlement_periods periods
where snapshots.period_id = periods.id
  and snapshots.period_label is null;

alter table public.settlement_snapshots
  alter column period_label set not null;
