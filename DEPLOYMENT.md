# Deploy

Crie projetos Supabase separados para staging e produção. Ative Vector e Cron, aplique migrations, confirme bucket privado e configure backups/PITR conforme o plano contratado. Cadastre o primeiro usuário e atribua `SUPER_ADMIN` por operação administrativa controlada.

Conecte o repositório à Vercel, raiz do projeto, região `gru1`, e configure todas as variáveis de `.env.example` por ambiente. Configure dois Deploy Hooks e salve cada URL como secret `VERCEL_DEPLOY_HOOK` nos environments protegidos do GitHub.

Implante o Dockerfile do gateway em serviço sempre ativo e privado; configure health check `/health`. Rode uma segunda instância/comando da imagem como `python -m app.worker`. Permita tráfego ao gateway somente do worker/Next.js e ao DataJud/MiMo/Supabase somente por HTTPS.

No GitHub, crie environments `staging` e `production` com aprovação obrigatória e secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `VERCEL_DEPLOY_HOOK`. Execute workflow `Deploy`; ele migra antes de disparar o deploy Vercel. Promova produção somente após smoke tests em staging.
