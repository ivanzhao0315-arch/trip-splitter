-- Run after migration in a transaction; all fixtures are rolled back.
do $$
declare p jsonb; m uuid; test_code text;
begin
  loop
    test_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists(select 1 from public.projects where projects.code = test_code);
  end loop;
  p := public.create_owned_project('Permission test', test_code, 'CNY', 'trip', 'Owner', 'Test', repeat('a',64));
  insert into public.members(project_id, display_name) values((p->>'id')::uuid, 'Guest') returning id into m;
  perform set_config('test.project',p->>'id',true);
  perform set_config('test.member',m::text,true);
  perform set_config('test.owner',p->>'current_member_id',true);
  insert into public.expenses(project_id,period_id,original_amount_minor,original_currency,converted_amount_minor,project_currency,payer_member_id,participant_member_ids)
    values((p->>'id')::uuid,(p->>'active_period_id')::uuid,100,'CNY',100,'CNY',m,array[m,(p->>'current_member_id')::uuid]);
end;
$$;
set local role anon;
do $$
declare p uuid := current_setting('test.project')::uuid;
  m uuid := current_setting('test.member')::uuid; result public.members; before_bill jsonb;
begin
  select to_jsonb(e) into before_bill from public.expenses e where project_id = p;
  if public.is_project_owner(p, repeat('b',64)) then raise exception 'Forged owner accepted'; end if;
  begin
    perform public.remove_project_member(p,m,repeat('b',64));
    raise exception 'Forged token removed member';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.members where id = m;
    raise exception 'Direct deletion allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.members set removed_at = now() where id = m;
    raise exception 'Direct archival allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.projects where id = p;
    raise exception 'Cascade bypass allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.project_owners;
    raise exception 'Owner credentials exposed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.remove_project_member(p,current_setting('test.owner')::uuid,repeat('a',64));
    raise exception 'Owner removed';
  exception when raise_exception then
    if sqlerrm <> '不能删除项目创建者' then raise; end if;
  end;
  select * into result from public.remove_project_member(p,m,repeat('a',64));
  if result.removed_at is null then raise exception 'Removal failed'; end if;
  if (select to_jsonb(e) from public.expenses e where project_id = p) <> before_bill then
    raise exception 'Historical bill changed';
  end if;
  begin
    insert into public.expenses(project_id,period_id,original_amount_minor,original_currency,converted_amount_minor,project_currency,payer_member_id,participant_member_ids)
      select project_id,period_id,original_amount_minor,original_currency,converted_amount_minor,project_currency,payer_member_id,participant_member_ids from public.expenses where project_id=p;
    raise exception 'Removed member accepted on new bill';
  exception when raise_exception then
    if sqlerrm <> '成员已移出项目或不属于当前项目' then raise; end if;
  end;
  update public.expenses set description = 'Old bill still editable' where project_id=p;
end;
$$;
reset role;
rollback;
