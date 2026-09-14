# Arquitetura

```text
Browser → Next.js/Vercel → Supabase (Auth, Postgres, Storage, pgvector)
                         → Xiaomi MiMo
                         → MCP Gateway → mcp-juridico-brasil → DataJud/CNJ
Supabase pg_cron → job_queue → Worker → serviços acima
domain_events → Worker → webhook assinado opcional
```

Next.js executa autenticação, autorização, UI, APIs e processamento documental. RLS revalida acesso no banco. O gateway FastAPI é interno, usa Bearer secret, allowlist de rede/Host, limites e um cliente MCP stdio persistente. O worker reivindica jobs com `FOR UPDATE SKIP LOCKED`, aplica retry exponencial e preserva dados anteriores em falhas externas.

Dados judiciais são normalizados e deduplicados por `UNIQUE(process_id, content_hash)`. Arquivos ficam em bucket privado e são entregues por URL assinada curta. Eventos transacionais usam outbox PostgreSQL, sem broker adicional.
