# Segurança

- Sessão via Supabase Auth em cookies HttpOnly/Secure/SameSite; autorização server-side e RLS.
- APIs mutáveis cookie-auth usam validação estrita de Origin; Server Actions mantêm a proteção nativa do Next.js.
- CSP com nonce, frame deny, nosniff, Referrer/Permissions Policy e respostas privadas sem cache.
- Storage jurídico privado; upload por allowlist, assinatura binária, tamanho e antivírus obrigatório em produção; download por URL assinada de 60 segundos com auditoria.
- Secrets somente server-side. `NEXT_PUBLIC_*` contém apenas URL e anon key públicas.
- Rate limit em chat, upload, import, refresh, busca, downloads e exports.
- Gateway com Bearer timing-safe, Host/rede allowlist, corpo limitado, docs/OpenAPI desativados e usuário de container sem root.
- Prompt injection: documentos são dados; tools têm allowlist e validação; prazo automático nunca é definitivo.
- LGPD: minimização, CPF apenas mascarado/hash de busca quando necessário, soft delete, retenção configurável e rastreabilidade.

Antes de release: execute `npm audit --omit=dev`, scan de secrets, CI completa e teste RLS com perfis de cada papel. Chaves expostas devem ser revogadas, não apenas removidas do Git.

Incidentes: revogue chaves Supabase/MiMo/DataJud/MCP, invalide sessões, preserve audit logs, identifique `x-request-id`, contenha o serviço e siga o restore do runbook.
