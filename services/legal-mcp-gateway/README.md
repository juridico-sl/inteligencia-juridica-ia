# Legal MCP Gateway

Serviço interno HTTP que mantém sessão MCP/stdio com `mcp-juridico-brasil`. Nunca exponha diretamente à internet sem rede privada e `MCP_INTERNAL_SECRET`.

```bash
docker build -t legal-mcp-gateway .
docker run --rm -p 8080:8080 --env-file .env legal-mcp-gateway
```

Variáveis obrigatórias: `DATAJUD_API_KEY`, `MCP_INTERNAL_SECRET`. Opcionais: `MCP_COMMAND`, `MCP_TIMEOUT_SECONDS`, `MCP_RATE_LIMIT_PER_MINUTE`, `MCP_ALLOWED_NETWORKS`.
