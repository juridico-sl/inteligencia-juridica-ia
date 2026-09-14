begin;

create table public.rate_limits (
  actor_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (actor_id, bucket)
);
alter table public.rate_limits enable row level security;

create function public.consume_rate_limit(bucket_name text, window_seconds integer, max_requests integer)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare current_actor uuid := auth.uid(); allowed boolean;
begin
  if current_actor is null or window_seconds < 1 or max_requests < 1 then return false; end if;
  insert into public.rate_limits(actor_id, bucket, window_start, request_count)
  values (current_actor, bucket_name, now(), 1)
  on conflict (actor_id, bucket) do update set
    window_start = case when public.rate_limits.window_start <= now() - make_interval(secs => window_seconds) then now() else public.rate_limits.window_start end,
    request_count = case when public.rate_limits.window_start <= now() - make_interval(secs => window_seconds) then 1 else public.rate_limits.request_count + 1 end
  returning request_count <= max_requests into allowed;
  return allowed;
end $$;

create function public.create_process_with_sync(
  input_process_number text,
  input_company_id uuid default null,
  input_business_unit_id uuid default null,
  input_category_id uuid default null,
  input_responsible_user_id uuid default null,
  input_law_firm_id uuid default null
) returns uuid language plpgsql volatile security definer set search_path = public as $$
declare process_id uuid;
begin
  if not public.has_permission('process.create') then raise exception 'access_denied' using errcode = '42501'; end if;
  if input_process_number !~ '^\d{20}$' then raise exception 'invalid_cnj' using errcode = '22023'; end if;
  insert into public.processes(process_number, company_id, business_unit_id, category_id, responsible_user_id, law_firm_id, created_by)
  values(input_process_number, input_company_id, input_business_unit_id, input_category_id, input_responsible_user_id, input_law_firm_id, auth.uid())
  returning id into process_id;
  insert into public.job_queue(type, payload, idempotency_key)
  values('sync_process', jsonb_build_object('process_id', process_id), 'initial-sync:' || process_id);
  return process_id;
end $$;

create function public.import_processes(input_rows jsonb)
returns jsonb language plpgsql volatile security definer set search_path=public as $$
declare item jsonb; process_id uuid; imported integer:=0; duplicates integer:=0;
begin
  if not public.has_permission('process.create') then raise exception 'access_denied' using errcode='42501'; end if;
  if jsonb_typeof(input_rows)<>'array' or jsonb_array_length(input_rows)>1000 then raise exception 'invalid_batch' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(input_rows) loop
    process_id:=null;
    insert into public.processes(process_number,category_id,responsible_user_id,created_by)
    values(item->>'process_number',(item->>'category_id')::uuid,(item->>'responsible_user_id')::uuid,auth.uid())
    on conflict(process_number) do nothing returning id into process_id;
    if process_id is null then duplicates:=duplicates+1; else
      imported:=imported+1;
      insert into public.job_queue(type,payload,idempotency_key) values('sync_process',jsonb_build_object('process_id',process_id),'initial-sync:'||process_id);
    end if;
  end loop;
  return jsonb_build_object('imported',imported,'duplicates',duplicates);
end $$;

create function public.confirm_deadline(deadline_id uuid)
returns public.deadlines language plpgsql volatile security definer set search_path = public as $$
declare result public.deadlines;
begin
  if not public.has_permission('deadline.confirm') then raise exception 'access_denied' using errcode = '42501'; end if;
  update public.deadlines set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  where id = deadline_id and deleted_at is null and status = 'pending_confirmation'
  returning * into result;
  if result.id is null then raise exception 'deadline_not_pending' using errcode = '22023'; end if;
  return result;
end $$;

create function public.enqueue_process_sync(process_id uuid, request_key text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare job_id uuid;
begin
  if not public.has_permission('process.update') then raise exception 'access_denied' using errcode = '42501'; end if;
  if not exists(select 1 from public.processes where id=process_id and deleted_at is null) then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.job_queue(type,payload,idempotency_key)
  values('sync_process',jsonb_build_object('process_id',process_id),left(request_key,200))
  on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning id into job_id;
  return job_id;
end $$;

create function public.update_process_risk(process_id uuid, level public.risk_level, probability_value numeric, impact_value numeric, change_reason text)
returns public.processes language plpgsql volatile security definer set search_path = public as $$
declare previous public.processes; result public.processes;
begin
  if not public.has_permission('risk.update') then raise exception 'access_denied' using errcode = '42501'; end if;
  if trim(change_reason) = '' then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into previous from public.processes where id = process_id and deleted_at is null for update;
  if previous.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.processes set risk_level = level, probability = probability_value, impact = impact_value
  where id = process_id returning * into result;
  insert into public.process_risk_history(process_id, previous_level, new_level, previous_probability, new_probability, previous_impact, new_impact, reason, changed_by)
  values(process_id, previous.risk_level, level, previous.probability, probability_value, previous.impact, impact_value, change_reason, auth.uid());
  return result;
end $$;

create function public.audit_row_change() returns trigger language plpgsql security definer set search_path = public as $$
declare resource text; actor uuid := auth.uid(); row_data jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  resource := coalesce(row_data->>'id', row_data->>'role_id', '');
  insert into public.audit_logs(user_id, action, resource_type, resource_id, metadata)
  values(actor, lower(tg_op), tg_table_name, resource, jsonb_build_object('database_trigger', true));
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create function public.update_process_financial(process_id uuid, field_name text, amount numeric, change_reason text)
returns public.processes language plpgsql volatile security definer set search_path=public as $$
declare previous public.processes; old_amount numeric; result public.processes;
begin
  if not public.has_permission('risk.update') then raise exception 'access_denied' using errcode='42501'; end if;
  if field_name not in ('claim_value','estimated_exposure','provision','settlement_value','paid_value','recovered_value') or amount<0 or trim(change_reason)='' then raise exception 'invalid_financial_change' using errcode='22023'; end if;
  select * into previous from public.processes where id=process_id and deleted_at is null for update;
  if previous.id is null then raise exception 'not_found' using errcode='P0002'; end if;
  old_amount := case field_name when 'claim_value' then previous.claim_value when 'estimated_exposure' then previous.estimated_exposure when 'provision' then previous.provision when 'settlement_value' then previous.settlement_value when 'paid_value' then previous.paid_value else previous.recovered_value end;
  execute format('update public.processes set %I=$1 where id=$2 returning *',field_name) into result using amount,process_id;
  insert into public.process_financial_history(process_id,field,previous_value,new_value,reason,changed_by) values(process_id,field_name,old_amount,amount,change_reason,auth.uid());
  return result;
end $$;

create function public.activate_ai_prompt(prompt_content text)
returns uuid language plpgsql volatile security definer set search_path=public as $$
declare prompt_id uuid; next_version integer;
begin
  if not public.has_permission('admin.settings') then raise exception 'access denied'; end if;
  if length(trim(prompt_content)) < 100 or length(prompt_content) > 30000 then raise exception 'invalid prompt'; end if;
  perform pg_advisory_xact_lock(hashtext('legal_assistant'));
  select coalesce(max(version),0)+1 into next_version from public.ai_prompt_versions where name='legal_assistant';
  update public.ai_prompt_versions set active=false where name='legal_assistant' and active;
  insert into public.ai_prompt_versions(name,version,content,active,created_by)
  values('legal_assistant',next_version,prompt_content,true,auth.uid()) returning id into prompt_id;
  return prompt_id;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','companies','business_units','law_firms','processes','deadlines','tasks','documents','knowledge_items','notes','comments','system_settings','role_permissions'] loop
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', table_name, table_name);
  end loop;
end $$;

revoke all on table public.rate_limits from anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer), public.create_process_with_sync(text, uuid, uuid, uuid, uuid, uuid), public.import_processes(jsonb), public.confirm_deadline(uuid), public.enqueue_process_sync(uuid,text), public.update_process_risk(uuid, public.risk_level, numeric, numeric, text), public.update_process_financial(uuid,text,numeric,text), public.activate_ai_prompt(text) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer), public.create_process_with_sync(text, uuid, uuid, uuid, uuid, uuid), public.import_processes(jsonb), public.confirm_deadline(uuid), public.enqueue_process_sync(uuid,text), public.update_process_risk(uuid, public.risk_level, numeric, numeric, text), public.update_process_financial(uuid,text,numeric,text), public.activate_ai_prompt(text) to authenticated;

commit;
