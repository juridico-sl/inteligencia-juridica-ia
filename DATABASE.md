# Banco de dados

As migrations em `supabase/migrations` criam extensões, enums, domínio jurídico, RBAC/RLS, fila, auditoria, relatórios, pg_cron e funções atômicas. A ordem é obrigatória; aplique com `supabase db reset` localmente e `supabase db push --linked` nos ambientes.

Funções críticas: `create_process_with_sync`, `import_processes`, `enqueue_process_sync`, `claim_jobs`, `retry_job`, `confirm_deadline`, `update_process_risk`, `update_process_financial`, `match_document_chunks`, `find_similar_processes`, `dashboard_metrics` e `activate_ai_prompt`.

RLS está ativa em todas as tabelas de negócio. `service_role` fica restrito a rotas/worker server-side. Exclusões de conteúdo jurídico são lógicas; limpeza física limitada por retenção ocorre no worker para auditoria e conversas.

O seed contém apenas empresa e unidade fictícias. Nunca use dados pessoais reais em desenvolvimento.
