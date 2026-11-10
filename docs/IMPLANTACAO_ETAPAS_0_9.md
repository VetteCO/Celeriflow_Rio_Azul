# Instalação do incremento 0–9

## Ambiente e dados

- Raiz da aplicação: pasta interna `Celeriflow_Rio_Azul`.
- Node.js **24.x** (versão fixada e validada na publicação), PostgreSQL/Neon, Firebase Auth e Blob privado.
- Manter `.env.local` fora do Git; cadastrar as mesmas variáveis no ambiente de publicação.
- `DIRECT_URL` deve apontar ao endpoint PostgreSQL direto, sem pool transacional, para migrações com lock de sessão.
- `DEFAULT_INTAKE_DEPARTMENT_ID` aponta para **Protocolo Geral**, criado por autorização do proprietário como subsetor da Secretaria Municipal de Administração. No ambiente local foi usado `379a1186-9a99-4eb4-94a4-fc2f5795562d`.
- Cadastrar os responsáveis do Protocolo com vínculo principal ou secundário. Criar setor não atribui automaticamente acesso documental a todos os administradores.

## Instalação

### Banco novo e vazio

Usar `config/environment.example` como modelo sem segredos. Depois de configurar um banco Neon vazio e `DIRECT_URL` direto, executar `npm run db:migrate -- --apply --initialize-empty`. A base estrutural versionada em `src/db/bootstrap/legacy-base.sql` é instalada em transação e recebe checksum no histórico; em seguida são executadas 0001–009. A opção recusa schema public com objetos/tipos existentes. Não usar esse caminho na base atual.

### Banco existente

1. Preservar banco e anexos originais. Registrar contagens, checksums e destino da cópia.
2. Revisar `src/db/migrations/0001_core.sql` até `009_contacts_external.sql`, inclusive os incrementos 006 (contatos/anônimo), 007 (expediente/Diário), 008 (operação) e 009 (cadastro externo). Todos esses históricos já foram aplicados no ambiente atual.
3. Listar com `npm run db:migrate`.
4. Na primeira instalação deste executor sobre o banco existente revisado, executar `npm run db:migrate -- --apply --existing-schema`. Nas seguintes, usar `npm run db:migrate -- --apply`.
5. Executar `npm run lint` e `npm run build` após integrar os módulos. Publicar somente o build conferido.
6. Configurar a URL pública correta em `NEXT_PUBLIC_APP_URL` e nos provedores Firebase. Configurações locais não são comprovação de publicação SaaS.
7. Executar os cenários aplicáveis de `ROTEIRO_VALIDACAO_ETAPAS_0_9.md`, registrar evidências e disponibilizar as telas ao proprietário.

Após qualquer instalação, `npm run db:migrate -- --check` compara os checksums aplicados e lista pendências **sem gravar dados ou criar o histórico**. Banco novo guarda dez entradas (baseline + nove incrementos); a base anterior mantém suas nove entradas, sem aplicação retroativa da baseline. Para conferir a reconstrução em PostgreSQL local, executar `npm run stage0:databases`, conforme `PLANO_DADOS_ENSAIO.md`.

As migrações são incrementais. Não executar `db:push`, seeds históricos ou exclusão de tabelas para resolver conflitos de instalação. Uma migração já aplicada não deve ser alterada; criar novo incremento. Rollback da aplicação deve preservar tabelas e dados aditivos.

## Worker documental — infraestrutura adiada pelo proprietário

O proprietário escolheu definir a infraestrutura depois. Código, fila e APIs integram o incremento; a operação de PDF/A e OCR depende dos executáveis e do host descritos em `PROCESSAMENTO_DOCUMENTAL.md`.

- `npm run worker:documents`: processamento e limpeza contínuos.
- `npm run worker:documents -- --once`: uma passagem, para operação controlada.
- Chromium local foi identificado; Ghostscript, veraPDF, Tesseract e Poppler não estão instalados neste computador.
- Não executar conversores dentro da requisição web. Dimensionar worker separado, disco temporário, memória, supervisão e restrições de rede.

## Operação contratual

- Relatórios mensais: `npm run operations:report`, após configurar conta operacional. Também há endpoint protegido para agendador externo.
- Monitoramento: `npm run operations:monitor`, em ambiente independente, com armazenamento dos resultados e canal de alerta.
- Backup: `npm run operations:backup -- <diretório-novo> --authorize-full-export`, com PostgreSQL `pg_dump` instalado e conta operacional configurada. Replicar e ensaiar restauração conforme a política contratual.
- Exportação integral: `npm run operations:export -- <diretório-novo> --authorize-full-export --with-dump`. Requer `DIRECT_URL` sem pooler, `OPERATIONS_SERVICE_USER_ID` de administrador ativo e ferramentas PostgreSQL. O manifesto v2 contém hashes, inventário, NDJSON, schema SQL/JSON e originais em streaming.
- Restauração: `npm run operations:restore -- <backup-v2> <diretório-novo> --confirm-isolated`, com `RESTORE_DATABASE_URL` e `RESTORE_DATABASE_NAME` explícitos apontando para banco vazio isolado. PostgreSQL local utiliza `psql`; Neon utiliza conexão WebSocket. O ensaio real de banco/arquivos foi aprovado em 10/11; conectar a aplicação ao armazenamento restaurado exige remapeamento isolado.
- Reconciliação: `npm run operations:reconcile -- --output <manifesto-privado.json>`. Compara objetos com referências persistidas, incluindo uploads de resposta incerta. Não exclui objetos.
- Relatórios prontos: `npm run worker:reports -- --watch`; contagem de páginas reais: `npm run worker:pages`. Agendar/supervisionar no executor autorizado; não iniciar processos dentro de requisições serverless.
- Configurar perfis de contatos, expediente dos setores e catálogo do Diário pela administração municipal. A implantação não presume jornada, tarifa de faturamento nem custo de impressão. Regras de faturamento/economia precisam de configuração explícita conforme `FECHAMENTO_OPERACAO.md`.
- Redundância geográfica, restauração, carga de 60 usuários, disponibilidade contínua, treinamento presencial e visitas mensais exigem evidências operacionais próprias.

## Etapas finais preservadas

Gov.br/ICP-Brasil/assinaturas/Tramita, Resend e canais externos, seguidos dos aplicativos, permanecem na ordem do plano vigente. Nenhum vínculo autodeclarado constitui identidade verificada e nenhum hash isolado constitui assinatura digital.
