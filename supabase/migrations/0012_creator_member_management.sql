begin;

alter table public.members add column removed_at timestamptz;
create table public.project_owners (
  project_id uuid primary key references public.projects(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  token_hash bytea not null
);
alter table public.project_owners enable row level security;
revoke all on public.project_owners from public, anon, authenticated;

-- Only the owner RPC may remove members; project deletion must not bypass it by cascading.
revoke delete on public.members, public.projects from anon, authenticated;
revoke update on public.members from anon, authenticated;
grant update(display_name) on public.members to anon, authenticated;

create function public.is_project_owner(p_project_id uuid, p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.project_owners
    where project_id = p_project_id
      and token_hash = sha256(convert_to(p_token, 'UTF8')));
$$;

create function public.create_owned_project(
  p_name text, p_code text, p_currency text, p_type text,
  p_display_name text, p_period_label text, p_token text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.projects; period_id uuid; member_id uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid creator token';
  end if;
  insert into public.projects(name, code, default_currency, project_type)
    values(trim(p_name), p_code, p_currency, p_type) returning * into p;
  insert into public.settlement_periods(project_id, label)
    values(p.id, p_period_label) returning id into period_id;
  insert into public.members(project_id, display_name)
    values(p.id, trim(p_display_name)) returning id into member_id;
  insert into public.project_owners values(p.id, member_id, sha256(convert_to(p_token, 'UTF8')));
  update public.projects set active_period_id = period_id where id = p.id returning * into p;
  return to_jsonb(p) || jsonb_build_object('current_member_id', member_id);
end;
$$;

create function public.remove_project_member(p_project_id uuid, p_member_id uuid, p_token text)
returns public.members language plpgsql security definer set search_path = '' as $$
declare result public.members;
begin
  if not public.is_project_owner(p_project_id, p_token) then
    raise exception '只有项目创建者可以删除成员' using errcode = '42501';
  end if;
  if exists(select 1 from public.project_owners where project_id = p_project_id and member_id = p_member_id) then
    raise exception '不能删除项目创建者';
  end if;
  update public.members set removed_at = coalesce(removed_at, now())
    where project_id = p_project_id and id = p_member_id returning * into result;
  if not found then raise exception '成员不存在'; end if;
  return result;
end;
$$;

-- Old bills retain their original members; new assignments cannot include a removed member.
create function public.check_active_expense_members()
returns trigger language plpgsql set search_path = '' as $$
declare m public.members; previous_ids uuid[] := '{}'; candidate_ids uuid[];
begin
  if TG_OP = 'UPDATE' and old.project_id = new.project_id then
    previous_ids := old.participant_member_ids || old.payer_member_id;
  end if;
  candidate_ids := new.participant_member_ids || new.payer_member_id;
  for m in select * from public.members where id = any(candidate_ids) order by id for share loop
    if m.project_id <> new.project_id or (m.removed_at is not null and not m.id = any(previous_ids)) then
      raise exception '成员已移出项目或不属于当前项目';
    end if;
  end loop;
  if exists(select 1 from unnest(candidate_ids) as candidate(member_id)
    where not exists(select 1 from public.members existing_member where existing_member.id = candidate.member_id)) then
    raise exception '成员不存在';
  end if;
  return new;
end;
$$;
create trigger check_active_expense_members before insert or update on public.expenses
  for each row execute function public.check_active_expense_members();

revoke all on function public.is_project_owner(uuid, text),
  public.create_owned_project(text, text, text, text, text, text, text),
  public.remove_project_member(uuid, uuid, text) from public;
grant execute on function public.is_project_owner(uuid, text),
  public.create_owned_project(text, text, text, text, text, text, text),
  public.remove_project_member(uuid, uuid, text) to anon, authenticated;

commit;
