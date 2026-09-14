begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);

select has_table('public','processes','processes existe');
select has_table('public','document_chunks','chunks existem');
select has_view('public','law_firm_metrics','indicadores de escritórios existem');
select has_column('public','law_firms','responsible_user_id','escritório possui responsável');
select ok((select relrowsecurity from pg_class where oid='public.processes'::regclass),'RLS em processos');
select ok((select relrowsecurity from pg_class where oid='public.documents'::regclass),'RLS em documentos');
select ok((select relrowsecurity from pg_class where oid='public.document_chunk_staging'::regclass),'RLS no staging documental');
select is((select public from storage.buckets where id='legal-documents'),false,'Storage jurídico privado');
select is((select count(*)::integer from pg_policies where schemaname='public' and tablename='processes'),3,'políticas de processos completas');
select ok(not has_function_privilege('anon','public.claim_jobs(text,integer)','execute'),'anon não executa claim_jobs');
select ok(not has_function_privilege('anon','public.audit_row_change()','execute'),'anon não executa função de auditoria');
select ok(not has_function_privilege('authenticated','public.publish_domain_event()','execute'),'usuário não chama trigger de outbox');
select ok(not has_function_privilege('authenticated','public.finalize_document_chunks(uuid,uuid,text,text,jsonb)','execute'),'usuário não finaliza chunks');
select ok(has_function_privilege('authenticated','public.persist_ai_answer(uuid,text,jsonb,jsonb,text,jsonb,integer,integer)','execute'),'usuário persiste resposta IA autorizada');
select ok(has_function_privilege('authenticated','public.create_full_process(jsonb)','execute'),'usuário autorizado acessa cadastro transacional');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.process_list'::regclass),'view respeita RLS do invocador');
select is((select column_default from information_schema.columns where table_schema='public' and table_name='deadlines' and column_name='status'),'''pending_confirmation''::deadline_status','prazo nasce pendente');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='process_movements' and indexdef ilike '%process_id%content_hash%'),'movimentação deduplicada');

set local role anon;
select is((select count(*)::bigint from public.roles),0::bigint,'anon não lê referência jurídica');
reset role;

select * from finish();
rollback;
