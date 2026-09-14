# Runbook

## Falha de sincronização

Verifique `/admin?tab=health`, `sync_logs` e jobs `failed/dead`; correlacione pelo request/job ID. Confirme DataJud, gateway e credenciais. Após corrigir, solicite atualização manual; dados anteriores permanecem intactos.

## Fila parada

Confirme o processo worker, conectividade Supabase e jobs presos em `running`. Não altere payloads manualmente. Reinicie o worker; jobs falhos usam retry exponencial. Jobs `dead` exigem análise de causa antes de reenfileirar.

## Backup e restore

Use backups/PITR gerenciados do Supabase. Para cópia adicional, execute `scripts/backup.ps1 -OutputDirectory <diretório seguro>` em projeto linkado e armazene dump/hash cifrados fora do repositório. Exporte dados lógicos em “Exportar dados”. Faça backup separado do Storage conforme política Supabase.

Restore: crie projeto isolado, restaure dump/PITR, restaure objetos preservando paths, aplique migrations posteriores, valide contagens/RLS, rotacione todas as chaves, configure gateway/worker e execute smoke tests antes de trocar DNS.

## Incidente ou vazamento

Desabilite acessos afetados, rotacione service role/MiMo/DataJud/MCP/cron, revise audit logs sem editar, preserve evidências, comunique encarregado LGPD e só reabra após teste de autorização e secret scan.
