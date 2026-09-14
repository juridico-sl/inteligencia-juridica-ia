begin;

create function public.retry_job(job_id uuid, error_message text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare job public.job_queue;
begin
  select * into job from public.job_queue where id = job_id for update;
  if job.id is null then raise exception 'job_not_found'; end if;
  update public.job_queue set
    status = case when attempts >= max_attempts then 'dead'::public.job_status else 'failed'::public.job_status end,
    scheduled_at = case when attempts >= max_attempts then scheduled_at else now() + make_interval(secs => least(3600, power(2, attempts)::integer * 30)) end,
    last_error = left(error_message, 1000), locked_by = null, locked_at = null,
    finished_at = case when attempts >= max_attempts then now() else null end
  where id = job_id;
end $$;

create function public.complete_job(job_id uuid)
returns void language sql volatile security definer set search_path = public as $$
  update public.job_queue set status='completed', finished_at=now(), locked_by=null, locked_at=null, last_error=null where id=job_id;
$$;

create function public.enqueue_monitored_processes()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare queued integer;
begin
  insert into public.job_queue(type,payload,idempotency_key,scheduled_at)
  select 'sync_process', jsonb_build_object('process_id',p.id), 'scheduled-sync:'||p.id||':'||to_char(now() at time zone 'UTC','YYYYMMDDHH24'), now()
  from public.processes p where p.monitoring_enabled and p.deleted_at is null
    and (split_part(p.monitoring_frequency,' ',2)='*' or extract(hour from now() at time zone 'America/Sao_Paulo')::text=any(string_to_array(split_part(p.monitoring_frequency,' ',2),',')))
  on conflict (idempotency_key) do nothing;
  get diagnostics queued = row_count; return queued;
end $$;

create function public.enqueue_daily_operations()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare queued integer := 0; added integer;
begin
  insert into public.job_queue(type,payload,idempotency_key)
  values('scan_deadlines','{}','scan-deadlines:'||to_char(now() at time zone 'UTC','YYYYMMDDHH24')) on conflict do nothing;
  get diagnostics added = row_count; queued := queued + added;
  insert into public.job_queue(type,payload,idempotency_key)
  values('send_notifications','{}','notifications:'||to_char(now() at time zone 'UTC','YYYYMMDDHH24MI')) on conflict do nothing;
  get diagnostics added = row_count; queued := queued + added;
  insert into public.job_queue(type,payload,idempotency_key)
  values('process_outbox','{}','outbox:'||to_char(now() at time zone 'UTC','YYYYMMDDHH24MI')) on conflict do nothing;
  get diagnostics added = row_count; return queued + added;
end $$;

create function public.create_alert_notifications() returns trigger language plpgsql security definer set search_path = public as $$
declare target_user uuid; channels text[]; channel_name text;
begin
  target_user := new.assigned_to;
  if target_user is null and new.process_id is not null then select responsible_user_id into target_user from public.processes where id=new.process_id; end if;
  if target_user is not null then
    select case new.severity when 'urgent' then urgent_channels when 'attention' then attention_channels else informative_channels end
      into channels from public.notification_preferences where user_id=target_user;
    channels := coalesce(channels, case when new.severity='urgent' then array['in_app','email'] else array['in_app'] end);
    foreach channel_name in array channels loop
      insert into public.notifications(user_id,alert_id,channel,title,body)
      values(target_user,new.id,channel_name,new.title,coalesce(new.description,''));
    end loop;
  end if;
  return new;
end $$;
create trigger alert_notification after insert on public.alerts for each row execute function public.create_alert_notifications();

create function public.create_mention_notifications() returns trigger language plpgsql security definer set search_path = public as $$
declare mentioned_user uuid;
begin
  foreach mentioned_user in array new.mentions loop
    if mentioned_user <> new.author_id and exists(select 1 from public.profiles where id=mentioned_user and active) then
      insert into public.notifications(user_id,channel,title,body)
      values(mentioned_user,'in_app','Você foi mencionado em comentário',left(new.content,300));
    end if;
  end loop;
  return new;
end $$;
create trigger comment_mentions after insert on public.comments for each row execute function public.create_mention_notifications();
create trigger note_mentions after insert on public.notes for each row execute function public.create_mention_notifications();

create function public.publish_domain_event() returns trigger language plpgsql security definer set search_path = public as $$
declare event_name text; aggregate uuid;
begin
  event_name := case tg_table_name when 'process_movements' then 'process.movement.created' when 'deadlines' then 'deadline.created' when 'alerts' then case when new.severity='urgent' then 'alert.urgent' else 'alert.created' end when 'documents' then 'document.created' else tg_table_name||'.created' end;
  aggregate := case when tg_table_name in ('process_movements','deadlines','alerts','documents') then (to_jsonb(new)->>'process_id')::uuid else null end;
  insert into public.domain_events(event_type,aggregate_type,aggregate_id,payload)
  values(event_name,tg_table_name,aggregate,jsonb_build_object('id',to_jsonb(new)->>'id'));
  return new;
end $$;
do $$ declare table_name text; begin
  foreach table_name in array array['process_movements','deadlines','alerts','documents'] loop execute format('create trigger outbox_%I after insert on public.%I for each row execute function public.publish_domain_event()',table_name,table_name); end loop;
end $$;

insert into public.jobs(name,type,schedule,payload) values
('Sincronização processual','enqueue_process_sync','0 6,10,14,18 * * *','{}'),
('Verificação operacional','scan_operations','*/15 * * * *','{}'),
('Resumo diário','daily_report','0 7 * * 1-5','{}'),
('Resumo semanal','weekly_report','0 7 * * 1','{}'),
('Relatório mensal','monthly_report','0 7 1 * *','{}')
on conflict(name) do nothing;

revoke all on function public.retry_job(uuid,text), public.complete_job(uuid), public.enqueue_monitored_processes(), public.enqueue_daily_operations() from public,anon,authenticated;
grant execute on function public.retry_job(uuid,text), public.complete_job(uuid), public.enqueue_monitored_processes(), public.enqueue_daily_operations() to service_role;

commit;
