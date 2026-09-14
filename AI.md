# IA, tools e RAG

O MiMo recebe um prompt imutável de segurança mais a versão ativa administrada em `/admin/ia`. Perguntas factuais internas acionam exclusivamente as tools allowlisted; SQL não é exposto ao modelo. A saída é separada em `FATO`, `INTERPRETAÇÃO DA IA` e `RECOMENDAÇÃO`, com fontes persistidas por mensagem.

Pipeline documental: upload validado → antivírus → Storage privado → extração → OCR se necessário → chunking jurídico → embeddings → índice híbrido FTS/pgvector → RAG. Conteúdo recuperado é delimitado como dado e nunca como instrução. Falha de embeddings mantém a busca textual disponível.

Prazos sugeridos por IA/MCP nascem como `pending_confirmation`. Geração de documentos produz somente `RASCUNHO GERADO POR IA`, persistido e rastreável ao processo e template; nenhum envio ou protocolo é automatizado.

Uso, latência, modelo, feedback, prompts e dataset de avaliação ficam registrados para governança e custo.
