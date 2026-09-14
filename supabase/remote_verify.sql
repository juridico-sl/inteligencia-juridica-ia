select jsonb_object_agg(name, passed order by name) as checks
from (values
  ('documents_rls', (select relrowsecurity from pg_class where oid='public.documents'::regclass)),
  ('processes_rls', (select relrowsecurity from pg_class where oid='public.processes'::regclass)),
  ('staging_rls', (select relrowsecurity from pg_class where oid='public.document_chunk_staging'::regclass)),
  ('storage_private', coalesce((select not public from storage.buckets where id='legal-documents'),false)),
  ('process_policies', (select count(*)=3 from pg_policies where schemaname='public' and tablename='processes')),
  ('movement_dedupe', exists(select 1 from pg_indexes where schemaname='public' and tablename='process_movements' and indexdef ilike '%process_id%content_hash%')),
  ('anon_claim_denied', not has_function_privilege('anon','public.claim_jobs(text,integer)','execute')),
  ('user_finalize_denied', not has_function_privilege('authenticated','public.finalize_document_chunks(uuid,uuid,text,text,jsonb)','execute')),
  ('ai_persistence_allowed', has_function_privilege('authenticated','public.persist_ai_answer(uuid,text,jsonb,jsonb,text,jsonb,integer,integer)','execute')),
  ('full_process_allowed', has_function_privilege('authenticated','public.create_full_process(jsonb)','execute')),
  ('process_view_invoker', (select reloptions @> array['security_invoker=true'] from pg_class where oid='public.process_list'::regclass)),
  ('deadline_pending', (select column_default='''pending_confirmation''::deadline_status' from information_schema.columns where table_schema='public' and table_name='deadlines' and column_name='status'))
) checks(name,passed);
