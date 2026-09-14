# MCP e DataJud

O navegador nunca executa MCP. O serviço `services/legal-mcp-gateway` mantém `mcp-juridico-brasil` via stdio e expõe apenas rotas internas validadas: tribunais, detalhes, movimentos, resumo, monitoramento e cálculo de prazo.

Produção exige `MCP_INTERNAL_SECRET` com pelo menos 32 caracteres, `DATAJUD_API_KEY`, `MCP_ALLOWED_HOSTS` e, quando aplicável, `MCP_ALLOWED_NETWORKS`. Implante o Dockerfile em serviço com rede privada e execute o worker como processo separado com a mesma imagem (`python -m app.worker`).

O worker persiste primeiro no Supabase, deduplica e só então agenda análise. Uma falha grava `sync_logs`/`last_sync_error`, aciona retry e nunca remove movimentações existentes.
