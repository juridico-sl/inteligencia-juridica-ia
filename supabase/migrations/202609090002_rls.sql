begin;

create function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    join public.permissions permission on permission.id = rp.permission_id
    where p.id = auth.uid() and p.active and permission.name = required_permission
  );
$$;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.active and r.name in ('SUPER_ADMIN','ADMIN_JURIDICO')
  );
$$;

revoke all on function public.claim_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_jobs(text, integer) to service_role;
grant execute on function public.has_permission(text), public.is_admin() to authenticated;
grant execute on function public.match_document_chunks(text, extensions.vector, integer, uuid, uuid) to authenticated;

do $$ declare table_name text; begin
  foreach table_name in array array[
    'roles','permissions','role_permissions','profiles','categories','companies','business_units','law_firms','processes','parties','process_parties',
    'process_movements','process_risk_history','process_financial_history','deadlines','tasks','alerts','knowledge_items','documents','document_versions',
    'document_chunks','notes','comments','conversations','messages','message_sources','saved_filters','notifications','notification_preferences','jobs',
    'job_queue','sync_logs','audit_logs','ai_usage_logs','system_settings','ai_prompt_versions','ai_feedback','ai_evaluation_cases','ai_insights','domain_events'
  ] loop execute format('alter table public.%I enable row level security', table_name); end loop;
end $$;

create policy reference_read on public.roles for select to authenticated using (true);
create policy reference_admin on public.roles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reference_read on public.permissions for select to authenticated using (true);
create policy reference_admin on public.permissions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reference_read on public.role_permissions for select to authenticated using (true);
create policy reference_admin on public.role_permissions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_read on public.profiles for select to authenticated using (public.has_permission('process.read') or id = auth.uid());
create policy profiles_admin on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy categories_read on public.categories for select to authenticated using (true);
create policy categories_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$ declare table_name text; begin
  foreach table_name in array array['companies','business_units','law_firms','parties'] loop
    execute format('create policy legal_read on public.%I for select to authenticated using (public.has_permission(''process.read''))', table_name);
    execute format('create policy legal_insert on public.%I for insert to authenticated with check (public.has_permission(''process.create''))', table_name);
    execute format('create policy legal_update on public.%I for update to authenticated using (public.has_permission(''process.update'')) with check (public.has_permission(''process.update''))', table_name);
  end loop;
end $$;

create policy processes_read on public.processes for select to authenticated using (public.has_permission('process.read'));
create policy processes_insert on public.processes for insert to authenticated with check (public.has_permission('process.create') and created_by = auth.uid());
create policy processes_update on public.processes for update to authenticated using (public.has_permission('process.update')) with check (public.has_permission('process.update'));

do $$ declare table_name text; begin
  foreach table_name in array array['process_parties','process_movements'] loop
    execute format('create policy process_child_read on public.%I for select to authenticated using (public.has_permission(''process.read''))', table_name);
    execute format('create policy process_child_insert on public.%I for insert to authenticated with check (public.has_permission(''process.update''))', table_name);
    execute format('create policy process_child_update on public.%I for update to authenticated using (public.has_permission(''process.update'')) with check (public.has_permission(''process.update''))', table_name);
  end loop;
end $$;

create policy notes_read on public.notes for select to authenticated using (public.has_permission('process.read'));
create policy notes_insert on public.notes for insert to authenticated with check (public.has_permission('process.update') and author_id = auth.uid());
create policy notes_update_own on public.notes for update to authenticated using (public.has_permission('process.update') and author_id = auth.uid()) with check (public.has_permission('process.update') and author_id = auth.uid());

create policy risk_read on public.process_risk_history for select to authenticated using (public.has_permission('risk.read'));
create policy risk_insert on public.process_risk_history for insert to authenticated with check (public.has_permission('risk.update') and changed_by = auth.uid());
create policy financial_read on public.process_financial_history for select to authenticated using (public.has_permission('risk.read'));
create policy financial_insert on public.process_financial_history for insert to authenticated with check (public.has_permission('risk.update') and changed_by = auth.uid());

create policy deadlines_read on public.deadlines for select to authenticated using (public.has_permission('deadline.read'));
create policy deadlines_insert on public.deadlines for insert to authenticated with check (public.has_permission('deadline.create') and created_by = auth.uid());
create policy deadlines_update on public.deadlines for update to authenticated using (public.has_permission('deadline.create')) with check (
  public.has_permission('deadline.create') and (status <> 'confirmed' or public.has_permission('deadline.confirm'))
);

create policy tasks_read on public.tasks for select to authenticated using (public.has_permission('task.read'));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.has_permission('task.create') and created_by = auth.uid());
create policy tasks_update on public.tasks for update to authenticated using (public.has_permission('task.update')) with check (public.has_permission('task.update'));

create policy alerts_read on public.alerts for select to authenticated using (public.has_permission('alert.read'));
create policy alerts_update on public.alerts for update to authenticated using (public.has_permission('alert.read')) with check (public.has_permission('alert.read'));

create policy knowledge_read on public.knowledge_items for select to authenticated using (public.has_permission('document.read'));
create policy knowledge_insert on public.knowledge_items for insert to authenticated with check (public.has_permission('document.upload') and created_by = auth.uid());
create policy knowledge_update on public.knowledge_items for update to authenticated using (public.has_permission('document.upload')) with check (public.has_permission('document.upload'));

do $$ declare table_name text; begin
  foreach table_name in array array['documents','document_versions','document_chunks'] loop
    execute format('create policy document_read on public.%I for select to authenticated using (public.has_permission(''document.read''))', table_name);
    execute format('create policy document_insert on public.%I for insert to authenticated with check (public.has_permission(''document.upload''))', table_name);
    execute format('create policy document_update on public.%I for update to authenticated using (public.has_permission(''document.upload'')) with check (public.has_permission(''document.upload''))', table_name);
  end loop;
end $$;

create policy comments_read on public.comments for select to authenticated using (public.has_permission('task.read') or public.has_permission('document.read'));
create policy comments_insert on public.comments for insert to authenticated with check (author_id = auth.uid() and (public.has_permission('task.update') or public.has_permission('document.upload')));
create policy comments_update_own on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy conversations_own on public.conversations for select to authenticated using (user_id = auth.uid());
create policy conversations_insert_own on public.conversations for insert to authenticated with check (user_id = auth.uid() and public.has_permission('ai.use'));
create policy conversations_update_own on public.conversations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_own on public.messages for select to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy messages_insert_own on public.messages for insert to authenticated with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()) and public.has_permission('ai.use'));
create policy message_sources_own on public.message_sources for select to authenticated using (exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = message_id and c.user_id = auth.uid()));
create policy message_sources_insert_own on public.message_sources for insert to authenticated with check (exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = message_id and c.user_id = auth.uid()));

create policy saved_filters_own on public.saved_filters for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy preferences_own on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$ declare table_name text; begin
  foreach table_name in array array['jobs','job_queue','sync_logs','system_settings','ai_prompt_versions','ai_evaluation_cases','domain_events'] loop
    execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())', table_name);
    execute format('create policy admin_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', table_name);
  end loop;
end $$;

create policy audit_read on public.audit_logs for select to authenticated using (public.has_permission('audit.read'));
create policy audit_insert on public.audit_logs for insert to authenticated with check (user_id = auth.uid());
create policy ai_usage_admin_read on public.ai_usage_logs for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy ai_usage_own_insert on public.ai_usage_logs for insert to authenticated with check (user_id = auth.uid());
create policy ai_feedback_own on public.ai_feedback for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy ai_feedback_insert on public.ai_feedback for insert to authenticated with check (user_id = auth.uid());
create policy ai_feedback_update on public.ai_feedback for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_insights_read on public.ai_insights for select to authenticated using (public.has_permission('risk.read'));
create policy ai_insights_update on public.ai_insights for update to authenticated using (public.has_permission('risk.update')) with check (public.has_permission('risk.update'));

-- No direct policies for legal-documents: uploads/downloads use authenticated server routes and short-lived signed URLs.

commit;
