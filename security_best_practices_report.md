# Verificação de segurança — jurídico SL

Data: 17/09/2026. Escopo: código Next.js 16/React 19, migrações Supabase e gateway/worker FastAPI. A análise é estática; **não confirma que as migrações locais sejam idênticas às de produção**.

## Resumo executivo

O projeto já tem controles relevantes: autenticação Supabase, RLS, bucket privado, verificação de origem em APIs mutáveis, CSP, upload com allowlist e antivírus obrigatório em produção. Porém, as permissões de atualização no banco permitem contornar regras de negócio e trilhas de auditoria por acesso direto à API Supabase. Para dados jurídicos em produção, os achados **S-01 a S-03 devem ser corrigidos com prioridade**. Há também um bloqueio provável do processamento documental interno e uma lacuna de revogação de acesso a conversas após desativação de usuário.

`npm audit --omit=dev --json` e `pip-audit -r services/legal-mcp-gateway/requirements.txt` em 17/09/2026: **0 alertas conhecidos** nas dependências resolvidas. Isso não cobre serviços externos, configuração publicada nem vulnerabilidades ainda não divulgadas.

## Correções preparadas no repositório

- A migração `supabase/migrations/202609170001_security_hardening.sql` restringe gravações diretas em processos, históricos, prazos, documentos, modelos aprovados e auditoria; exige perfil ativo para ler conversas e notificações.
- A aplicação preserva arquivamento, aprovação e reprocessamento por operações autenticadas no servidor. O Proxy permite a rota interna protegida por Bearer e cria um novo ID por requisição; a auditoria verifica falhas de inserção.
- O workflow `.github/workflows/deploy.yml` agora exige publicação `web` antes de `database`, com confirmação do deploy entre as duas etapas, para evitar aplicar a restrição SQL enquanto a versão antiga ainda grava diretamente nessas tabelas.
- `npm run check` passou (lint com 10 avisos antigos, sem erros); testes JavaScript: 17/17. Testes Python do gateway: 3/3. Os testes SQL foram ampliados, mas **não puderam ser executados** sem uma instância Supabase local ou remota acessível.
- **Vercel em produção atualizada em 17/09/2026:** deployment `dpl_BdURGvasqvSFUGquahEanXhHUoc8`, domínio `juridico-sl.vercel.app`. Saúde respondeu `200` e rota interna sem credencial respondeu `401` após corrigir o empacotamento do parser PDF. O deployment anterior respondia `500` nessa rota porque o trace não incluía `@napi-rs/canvas`. `NEXT_PUBLIC_APP_URL` foi configurada em produção para o domínio ativo.
- **Supabase ainda não atualizado.** A migração precisa ser aplicada e seus privilégios testados no banco remoto; até lá, os achados de acesso direto ao banco continuam abertos. O plugin Supabase não está instalado nesta sessão, não há CLI autenticada nem senha de banco disponível. Não foi possível executar os testes SQL.
- Em 17/09/2026, o deployment original da Vercel foi confirmado como `source=cli` com commit `e86f6b9`, igual ao checkout local. O `master` do GitHub estava no commit inicial `e3c125c`; este checkout contém nove commits posteriores e as correções ainda não foram enviadas ao GitHub. O workflow `database` depende de um checkout GitHub que ainda não contém a migração.

## Alta prioridade

### S-01 — Edição direta de risco e valores sem histórico obrigatório

- **Regra:** autorização por operação e por coluna, não apenas por linha. **Gravidade: Alta.**
- **Local/evidência:** `supabase/migrations/202609090002_rls.sql:57` concede `UPDATE` de `processes` a quem tem `process.update`; a tabela contém `risk_level`, `claim_value`, `estimated_exposure` e `provision` em `supabase/migrations/202609090001_core.sql:109-114`. As funções que exigem `risk.update`, motivo e registram histórico estão em `supabase/migrations/202609090003_domain_functions.sql:90-127` e `supabase/migrations/202609090007_static_financial_update.sql:4-27`. O papel `ADVOGADO`/`ANALISTA` tem `process.update` e `risk.update`, mas a separação continua relevante para outros papéis e para a exigência de histórico.
- **Impacto:** um usuário autenticado com `process.update` pode atualizar valores e risco pela API de dados do Supabase sem informar motivo nem gerar as linhas de histórico esperadas. Uma conta comprometida pode adulterar contingências silenciosamente; o trigger genérico registra apenas a operação, não os valores anteriores/novos.
- **Correção:** revogar o `UPDATE` de tabela para `authenticated` em `processes`; conceder apenas colunas comuns de edição e manter valores/risco nas RPCs controladas. Verificar grants efetivos no banco publicado. Alternativamente, um trigger obrigatório pode impor histórico e permissão sobre toda alteração desses campos.
- **Mitigação temporária:** revisar alterações recentes de risco/valores que não tenham histórico correspondente e restringir os papéis com `process.update`.
- **Confirmação:** depende dos privilégios SQL efetivos de produção; o repositório não contém um `REVOKE UPDATE` por coluna.

### S-02 — Prazos podem mudar de estado fora da confirmação jurídica

- **Regra:** transição de estado protegida no banco. **Gravidade: Alta.**
- **Local/evidência:** `supabase/migrations/202609090002_rls.sql:78-80` autoriza `UPDATE` de toda a linha com `deadline.create` e só exige `deadline.confirm` quando o **novo** estado é `confirmed`. O estado e os campos de confirmação estão em `supabase/migrations/202609090001_core.sql:196-214`; a RPC de confirmação controlada está em `supabase/migrations/202609090003_domain_functions.sql:65-75`.
- **Impacto:** um usuário com `deadline.create` pode alterar diretamente vencimento, responsável e estado para `completed`, `cancelled` ou `overdue`, contornando o fluxo de confirmação. Mesmo com a restrição da tabela para prazos de IA, é possível fornecer `confirmed_by` na mesma atualização.
- **Correção:** retirar `UPDATE` amplo de `authenticated` e expor transições permitidas por RPCs que validem estado anterior, papel e autoria; proteger `confirmed_by`/`confirmed_at` no banco. Adicionar teste com papel que tenha `deadline.create`, mas não `deadline.confirm`.
- **Mitigação temporária:** comparar prazos alterados com eventos/auditoria e limitar temporariamente `deadline.create`.
- **Confirmação:** validar os grants efetivos e as constraints no banco de produção.

### S-03 — Registros de auditoria podem ser forjados por usuários

- **Regra:** integridade da trilha de auditoria. **Gravidade: Alta.**
- **Local/evidência:** `supabase/migrations/202609090002_rls.sql:127` permite `INSERT` em `audit_logs` a qualquer autenticado quando `user_id = auth.uid()`. `supabase/migrations/202609090001_core.sql:451-459` contém `action`, `resource_type`, `resource_id` e `metadata`; `src/lib/security.ts:16-27` usa a mesma tabela para eventos da aplicação.
- **Impacto:** qualquer conta autenticada pode inserir eventos com ação, recurso e metadados arbitrários pelo Supabase, misturando registros falsos à trilha usada em investigação interna.
- **Correção:** revogar `INSERT` direto de `authenticated`; registrar eventos por função/serviço que derive o ator da sessão e valide ação e recurso. Preservar o trigger de alterações no banco e enviar logs de segurança para armazenamento com controle de integridade.
- **Mitigação temporária:** distinguir eventos de trigger dos inseridos pela aplicação e usar logs do banco/plataforma como evidência independente.
- **Confirmação:** conferir privilégios de produção e eventual pipeline externo de logs.

## Média prioridade

### S-04 — Processamento interno de documentos provavelmente bloqueado pelo Proxy

- **Regra:** autenticação coerente para chamadas internas. **Gravidade: Média (disponibilidade e indexação).**
- **Local/evidência:** o worker chama `POST /api/internal/documents/process` com Bearer em `services/legal-mcp-gateway/app/worker.py:129-133`; a rota valida `CRON_SECRET` em `src/app/api/internal/documents/process/route.ts:8-10`. Porém, `src/proxy.ts:4,46-52` só libera `/login`, `/auth/callback` e `/api/health` sem sessão Supabase e redireciona as demais rotas para login.
- **Impacto:** se esse Proxy estiver ativo em produção e o worker não enviar cookies de sessão, os jobs de extração falham antes de chegar à validação do Bearer. Documentos enviados podem ficar sem OCR, texto extraído e índice de busca.
- **Correção:** liberar **somente** essa rota da checagem de sessão no Proxy, mantendo a validação forte de `CRON_SECRET` na própria rota; testar um job completo após o deploy.
- **Mitigação temporária:** monitorar falhas `extract_document` na fila, sem desativar autenticação da rota.
- **Confirmação:** verificar logs de produção, pois não foi possível consultar a Vercel nesta sessão.

### S-05 — Usuário desativado ainda pode consultar suas conversas diretamente

- **Regra:** revogação de acesso deve valer também para a API de dados. **Gravidade: Média.**
- **Local/evidência:** `src/lib/auth.ts:5-10` exige `profile.active` na aplicação, e `has_permission` faz o mesmo em `supabase/migrations/202609090002_rls.sql:3-10`. Mas as políticas de leitura de `conversations`, `messages` e `message_sources` em `supabase/migrations/202609090002_rls.sql:105,109,111` verificam apenas `user_id = auth.uid()`.
- **Impacto:** uma sessão/JWT ainda válido de uma conta desativada pode ler o histórico próprio de conversas via API Supabase, que pode conter fatos e documentos jurídicos.
- **Correção:** incluir perfil ativo nas políticas dessas tabelas ou aplicar uma política restritiva comum; ao desligar um usuário, revogar também sessões/refresh tokens. Testar acesso com sessão emitida antes da desativação.
- **Mitigação temporária:** revogar sessões no procedimento de desligamento e reduzir a vida útil de sessões privilegiadas.
- **Confirmação:** testar no Supabase de produção; a aplicação web isoladamente já nega acesso.

### S-06 — Metadados e texto de documentos podem ser alterados fora do pipeline de upload

- **Regra:** proteger conteúdo validado e campos de sistema. **Gravidade: Média.**
- **Local/evidência:** `supabase/migrations/202609090002_rls.sql:93-99` dá `INSERT` e `UPDATE` amplos em `documents`, `document_versions` e `document_chunks` a quem tem `document.upload`; a tabela inclui `storage_path` e `extracted_text` em `supabase/migrations/202609090001_core.sql:267-309`. A rota de upload com validação de assinatura e antivírus está em `src/app/api/v1/documents/route.ts:23-39`, mas o banco não exige que a gravação passe por ela.
- **Impacto:** um usuário com `document.upload` pode adulterar texto extraído, metadados e caminhos de arquivo via API Supabase. Isso afeta busca, respostas da IA e integridade documental. A leitura real de objetos continua dependente do bucket privado e das regras de Storage.
- **Correção:** reservar alterações de campos de processamento para `service_role`; remover grants diretos de escrita nessas tabelas e usar RPCs específicas quando a interface precisar editar metadados.
- **Mitigação temporária:** confrontar `sha256` e histórico de versões com objetos do bucket; monitorar alterações diretas.
- **Confirmação:** verificar grants e políticas de Storage publicados.

### S-07 — Cabeçalho de correlação inválido pode suprimir auditoria da aplicação

- **Regra:** validar identificadores de entrada e detectar falhas ao gravar auditoria. **Gravidade: Média.**
- **Local/evidência:** `src/proxy.ts:18-25` aceita `x-request-id` do cliente após apenas cortar para 64 caracteres; `src/lib/security.ts:16-27` grava esse valor em `audit_logs.request_id`, que é `uuid` em `supabase/migrations/202609090001_core.sql:458`, e não verifica o erro retornado pelo `insert`.
- **Impacto:** um cliente autenticado pode enviar um `x-request-id` que não é UUID; a gravação desse evento de auditoria falha, mas a ação já pode ter sido concluída. Eventos gerados por triggers do banco continuam independentes.
- **Correção:** gerar um UUID no Proxy quando o valor recebido não for um UUID válido e tratar explicitamente falhas de gravação de auditoria; para operações sensíveis, decidir se a mutação deve falhar de forma transacional.
- **Mitigação temporária:** comparar eventos de auditoria da aplicação com logs de requests e triggers.
- **Confirmação:** testar uma operação autenticada com `x-request-id` inválido em ambiente de teste.

### S-08 — Modelos jurídicos podem ser aprovados ou modificados diretamente

- **Regra:** aprovação e conteúdo aprovado devem ter privilégios separados. **Gravidade: Média.**
- **Local/evidência:** `supabase/migrations/202609090002_rls.sql:90-91` permitia `INSERT` e `UPDATE` amplos em `knowledge_items` com `document.upload`; `approved_by` e `approved_at` ficam em `supabase/migrations/202609090001_core.sql:259-260`. A interface exige `admin.settings` para aprovação em `src/app/(app)/conhecimento/modelos/actions.ts:10-12`.
- **Impacto:** um usuário com upload podia marcar o próprio modelo como aprovado ou alterar seu conteúdo após a aprovação pela API Supabase, influenciando rascunhos jurídicos gerados pela IA.
- **Correção aplicada no repositório:** a nova migração limita as colunas de `INSERT`, remove `UPDATE` direto e move a aprovação autorizada para o servidor.
- **Confirmação:** testar os privilégios efetivos após aplicar a migração em produção.

## Verificações de produção pendentes

1. **Supabase:** conferir migrações aplicadas, grants por coluna/tabela, RLS, bucket privado, políticas de Storage e se cadastro público está desativado. `supabase/config.toml:22` desativa cadastro **local**, mas não prova a configuração remota. Conferir MFA para administradores e usuários com acesso a dados sensíveis; o código de login em `src/app/(auth)/login/actions.ts:9-16` só mostra senha.
2. **Vercel:** a CLI local permitiu conferir e publicar o deployment ativo. O conector MCP retornou `403`, mas a CLI confirmou `ssoProtection.deploymentType=all_except_custom_domains`. As variáveis `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ENCRYPTION_SECRET`, `MIMO_API_KEY` e `DATAJUD_API_KEY` também estão configuradas para Preview e Development; conferir se esses ambientes precisam acessar dados e segredos de produção e restringir o escopo quando houver ambientes separados.
3. **Dados externos:** documentar e aprovar o envio de trechos jurídicos para MiMo, OCR e antivírus. O fluxo está em `src/lib/ai/tools.ts:50-60`, `src/app/api/internal/documents/process/route.ts:21-32` e `src/lib/documents.ts:21-39`. Verificar retenção, região, contrato e quais documentos podem ser enviados. Isto é uma decisão de governança, não uma vulnerabilidade confirmada.
4. **Imagem publicada do gateway:** o `pip-audit` não encontrou advisories nas dependências resolvidas pelo arquivo `requirements.txt`; ainda é necessário conferir a imagem efetivamente implantada e seu sistema operacional.

## Referências

- [Supabase — segurança por coluna](https://supabase.com/docs/guides/database/postgres/column-level-security): RLS limita linhas; o privilégio `UPDATE` de tabela permite atualizar todas as colunas.
- [Supabase — autenticação multifator](https://supabase.com/docs/guides/auth/auth-mfa): políticas de MFA precisam ser aplicadas também no banco e nas APIs.
- [Next.js — autenticação](https://nextjs.org/docs/app/guides/authentication): Proxy é filtro preliminar; autorização sensível deve ser verificada perto dos dados.
- [OWASP — integridade de logs](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): trilhas devem permitir detectar adulteração e verificar a origem.
- [Supabase — buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals): URLs assinadas dão acesso temporário a objetos privados.
