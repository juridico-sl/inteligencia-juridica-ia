# Plataforma de Inteligência e Operações Jurídicas com IA

Aplicação corporativa completa para processos, prazos, tarefas, documentos, risco, financeiro, relatórios e IA jurídica rastreável. O Supabase é a fonte permanente; DataJud é somente fonte de sincronização.

## Execução local

Requisitos: Node.js 22+, Docker, Supabase CLI e Python 3.13.

1. Copie `.env.example` para `.env.local` e preencha valores locais.
2. Execute `supabase start` e `supabase db reset`.
3. Execute `npm ci` e `npm run dev`.
4. No gateway: `python -m venv .venv`, ative-o, instale `pip install -r requirements.txt -r requirements-dev.txt` e rode `uvicorn app.main:app --port 8080`.
5. Em outro terminal do gateway, execute `python -m app.worker`.

Checks completos: `npm run check`, `npm run test:e2e` e `python -m pytest -q` em `services/legal-mcp-gateway`.

## Documentação

- [Arquitetura](ARCHITECTURE.md)
- [Banco](DATABASE.md)
- [IA e RAG](AI.md)
- [MCP/DataJud](MCP.md)
- [Segurança](SECURITY.md)
- [Deploy](DEPLOYMENT.md)
- [Runbook](RUNBOOK.md)
- [Guia do usuário](docs/USER_GUIDE.md)

O plano de produto e Definition of Done está em `ultra-plan.md — Plataforma Completa de Inteligência Jurídica com IA.md`.
