begin;

-- RLS selects rows; column privileges keep sensitive process changes in audited RPCs.
revoke insert on public.processes from public, authenticated;
drop policy processes_insert on public.processes;
revoke update on public.processes from public, authenticated;
grant update (
  company_id, business_unit_id, category_id, responsible_user_id, law_firm_id,
  subcategory, status, notes, tags, monitoring_enabled, monitoring_frequency
) on public.processes to authenticated;
drop policy processes_update on public.processes;
create policy processes_update on public.processes for update to authenticated
  using (public.has_permission('process.update') and (status <> 'archived' or public.has_permission('process.delete')))
  with check (public.has_permission('process.update') and (status <> 'archived' or public.has_permission('process.delete')));
revoke insert on public.process_risk_history, public.process_financial_history from public, authenticated;
drop policy risk_insert on public.process_risk_history;
drop policy financial_insert on public.process_financial_history;

revoke update on public.deadlines from public, authenticated;
drop policy deadlines_update on public.deadlines;
drop policy deadlines_insert on public.deadlines;
create policy deadlines_insert on public.deadlines for insert to authenticated with check (
  public.has_permission('deadline.create') and created_by = (select auth.uid())
  and (
    (status = 'pending_confirmation' and confirmed_by is null and confirmed_at is null)
    or (origin = 'manual' and status = 'confirmed' and public.has_permission('deadline.confirm')
        and confirmed_by = (select auth.uid()) and confirmed_at is not null)
  )
);

-- Document contents and processing state are written only by trusted server code.
revoke insert, update on public.documents, public.document_versions, public.document_chunks from public, authenticated;
drop policy document_insert on public.documents;
drop policy document_update on public.documents;
drop policy document_insert on public.document_versions;
drop policy document_update on public.document_versions;
drop policy document_insert on public.document_chunks;
drop policy document_update on public.document_chunks;

-- Approval is an administrative act; drafts may only set their content and owner.
revoke insert, update on public.knowledge_items from public, authenticated;
grant insert (title, type, content, category_id, tags, created_by) on public.knowledge_items to authenticated;
drop policy knowledge_update on public.knowledge_items;

revoke insert on public.audit_logs from public, authenticated;
drop policy audit_insert on public.audit_logs;

drop policy conversations_own on public.conversations;
create policy conversations_own on public.conversations for select to authenticated
  using (user_id = (select auth.uid()) and public.has_permission('ai.use'));
drop policy conversations_update_own on public.conversations;
create policy conversations_update_own on public.conversations for update to authenticated
  using (user_id = (select auth.uid()) and public.has_permission('ai.use'))
  with check (user_id = (select auth.uid()) and public.has_permission('ai.use'));
drop policy messages_own on public.messages;
create policy messages_own on public.messages for select to authenticated
  using (public.has_permission('ai.use') and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
  ));
drop policy message_sources_own on public.message_sources;
create policy message_sources_own on public.message_sources for select to authenticated
  using (public.has_permission('ai.use') and exists (
    select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.user_id = (select auth.uid())
  ));
drop policy message_sources_insert_own on public.message_sources;
create policy message_sources_insert_own on public.message_sources for insert to authenticated
  with check (public.has_permission('ai.use') and exists (
    select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.user_id = (select auth.uid())
  ));

drop policy notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
  ));
drop policy notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
  ))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
  ));

commit;
