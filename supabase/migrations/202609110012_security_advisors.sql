begin;

alter function public.set_updated_at() set search_path = public;
alter function public.match_document_chunks(text,extensions.vector,integer,uuid,uuid) set search_path = public, extensions;

revoke all on function public.set_updated_at(), public.handle_new_user(), public.audit_row_change(), public.create_alert_notifications(), public.create_mention_notifications(), public.publish_domain_event() from public, anon, authenticated;
revoke all on function public.has_permission(text), public.is_admin(), public.match_document_chunks(text,extensions.vector,integer,uuid,uuid) from public, anon;
grant execute on function public.has_permission(text), public.is_admin(), public.match_document_chunks(text,extensions.vector,integer,uuid,uuid) to authenticated;

do $$
declare policy record; statement text;
begin
  for policy in
    select schemaname,tablename,policyname,qual,with_check
    from pg_policies
    where schemaname='public' and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')
  loop
    statement:=format('alter policy %I on %I.%I',policy.policyname,policy.schemaname,policy.tablename);
    if policy.qual is not null then statement:=statement||' using ('||replace(policy.qual,'auth.uid()','(select auth.uid())')||')'; end if;
    if policy.with_check is not null then statement:=statement||' with check ('||replace(policy.with_check,'auth.uid()','(select auth.uid())')||')'; end if;
    execute statement;
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['roles','permissions','role_permissions'] loop
    execute format('drop policy reference_admin on public.%I',table_name);
    execute format('create policy reference_insert on public.%I for insert to authenticated with check (public.is_admin())',table_name);
    execute format('create policy reference_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',table_name);
    execute format('create policy reference_delete on public.%I for delete to authenticated using (public.is_admin())',table_name);
  end loop;

  drop policy categories_admin on public.categories;
  create policy categories_insert on public.categories for insert to authenticated with check (public.is_admin());
  create policy categories_update on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
  create policy categories_delete on public.categories for delete to authenticated using (public.is_admin());

  foreach table_name in array array['jobs','job_queue','sync_logs','system_settings','ai_prompt_versions','ai_evaluation_cases','domain_events'] loop
    execute format('drop policy admin_write on public.%I',table_name);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin())',table_name);
    execute format('create policy admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',table_name);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.is_admin())',table_name);
  end loop;
end $$;

commit;
