# Continuidade, backup e encerramento contratual

## Situação verificável

Implementados: exportação autenticada de todas as tabelas `public` em JSON, originais de `attachment` e `module_file`, manifesto SHA-256 e ZIP; worker de backup com `pg_dump`, JSON e arquivos; consulta autenticada de conectividade. Não foram executados backups, migrações, restaurações, carga ou alterações remotas nesta entrega.

Não há comprovação de redundância em três locais físicos, disponibilidade mensal de 99,5%, recuperação de desastre ou capacidade de 60 usuários simultâneos. Esses itens exigem contratação/configuração e evidência operacional. Um resultado de `/api/operations/health` não substitui monitoramento externo.

## Backup automatizável

Arquivo executável: `src/lib/operations/backup-worker.ts`. Pré-requisitos: Node, dependências instaladas, utilitário PostgreSQL `pg_dump` compatível com a versão do servidor, `DATABASE_URL` e `BLOB_READ_WRITE_TOKEN` em ambiente protegido do executor. A conta do executor precisa de leitura das tabelas e dos originais. Não entregar essas credenciais aos usuários da aplicação.

```powershell
npx tsx --env-file=.env.local src/lib/operations/backup-worker.ts D:\Backups\RioAzul\2026-11-10T230000
```

O diretório deve ser novo. Saída 0 e `manifest.json` significam cópia concluída; saída diferente de 0 ou ausência do manifesto significa cópia incompleta. Preservar o log em acesso restrito. Não aplicar retenção sobre a última cópia íntegra antes de concluir e verificar a nova cópia.

Agendar o comando no executor institucional (Agendador de Tarefas, cron ou serviço de jobs), com diretório único por execução e alerta externo para saída não zero/ausência de execução. Definir responsáveis, periodicidade, retenção, RPO e RTO aprovados. O script entrega a automação executável; o agendamento e os destinos ainda precisam ser configurados. Executar em janela de manutenção que impeça alteração/remoção de arquivos: `pg_dump`, JSON e Blob não compartilham transação distribuída. O dump é consistente internamente; JSON usa um único snapshot de consulta. Os arquivos precisam permanecer imutáveis durante a cópia.

Replicar os artefatos completos para destinos independentes com criptografia, controle de acesso e retenção imutável quando contratada. Conferir os hashes em cada destino. Documentar provedor, região e localização física comprovada; regiões declaradas sem evidência não demonstram três locais físicos distintos. Confirmar limites, retenção PITR, armazenamento e transferência nos planos reais Neon/Blob.

## Ensaio de restauração (ambiente isolado)

1. Registrar início, responsável, versão do código, versões PostgreSQL e conjunto escolhido. Validar SHA-256 de `database.dump`, `database.json` e de cada original contra o manifesto. Cópia incompleta não passa.
2. Criar banco e armazenamento isolados. Nunca apontar o ensaio para a URL de produção. Configurar a conexão do destino no ambiente do executor.
3. Restaurar o dump em banco vazio, com falha imediata e transação única:

   ```powershell
   pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname=$env:RESTORE_DATABASE_URL D:\Backups\RioAzul\2026-11-10T230000\database.dump
   ```

4. Restaurar originais no armazenamento privado do ensaio. Preservar `storageKey` quando suportado; caso o provedor gere chaves diferentes, manter mapa antigo → novo e atualizar `attachment.storage_key`/`module_file.storage_key` **somente no banco restaurado**, em transação. O worker preserva bytes; não automatiza esse remapeamento de provedor.
5. Conferir contagens por tabela, chaves estrangeiras, contadores e códigos de negócio, cursos/progresso, tickets/histórico e hashes dos arquivos. Abrir documentos e baixar anexos pela aplicação autenticada no ambiente restaurado, verificando autorizações e sigilo.
6. Registrar término, tempos observados, perda de dados observada, falhas e evidências. Comparar RPO/RTO contratados; somente marcar recuperação validada quando todas as verificações passarem.

O JSON é formato aberto para portabilidade, não substitui o dump para restauração PostgreSQL. Identidades Firebase, configurações de provedores, DNS, secrets e conteúdo EAD hospedado por terceiros exigem inventário e procedimento próprio; não estão incorporados ao dump do banco.

## Exportação e encerramento

`POST /api/operations/export`, permissão `operations:export`, retorna ZIP até 64 MiB de dados/arquivos, sem truncar resultados. Falha na obtenção de um original impede conclusão; arquivos de módulos com hash cadastrado são conferidos. O manifesto identifica origem, caminho, tamanho e hash. A exportação é auditada. Para volumes maiores, executar o worker em janela de manutenção e entregar `database.json`, `originals/` e `manifest.json` por canal autorizado. O worker remove o limite de anexos em memória por streaming; a serialização das tabelas JSON continua em memória e deve ser dimensionada ou substituída por exportação PostgreSQL COPY por tabela para bases grandes.

Inventariar novos campos de arquivos sempre que módulos forem adicionados. Exportação inclui todos os registros e dados pessoais do banco: conceder permissão apenas aos responsáveis formais pelo encerramento. Entregar dicionário/schema e versões das migrações, conferir integridade com o destinatário, registrar aceite e aplicar retenção/descarte somente após decisão contratual.

## Observabilidade e manutenção

- Expor aplicação somente por HTTPS no ambiente publicado; comprovar DNS/certificado e redirecionamento HTTP na implantação.
- Monitor externo deve medir disponibilidade continuamente, com intervalos, região de medição, falhas e manutenção identificáveis. Calcular disponibilidade mensal a partir das observações válidas; relatar lacunas de medição.
- Centralizar logs com correlação, retenção e alertas para erros de aplicação, falhas de jobs/backups e orçamento de consumo. Não armazenar tokens ou credenciais nos logs.
- Aviso de manutenção deve informar data, duração, impacto, canal de suporte e responsável. Registrar início/fim, rollback e comunicação efetivamente enviada; não existe envio automático de aviso nesta etapa.
- Ensaiar carga de 60 sessões concorrentes em ambiente autorizado, com mistura representativa de consulta, tramitação e anexos. Registrar latência p95, erros, saturação e custo; quantidade de contas cadastradas não demonstra simultaneidade.

## Serviços presenciais

Agenda de implantação deve listar capacitação por perfil (administração, servidores, auditoria e atendimento), instrutor, local, carga horária, presença e avaliação. O EAD complementa e não comprova treinamento presencial. Agendar visita mensal, produzir ata de atendimento e registrar pendências/responsáveis/prazo em chamados. Entregar manuais e registrar aceite municipal.
# Executores de agendamento e monitoramento

- Relatório mensal: `npx tsx --env-file=.env.local scripts/contract-report.ts`. Exige `OPERATIONS_SERVICE_USER_ID` de uma conta operacional ativa com perfil Admin Geral. Gera a competência anterior em São Paulo, com idempotência por competência. Agendar diariamente para recuperar execuções perdidas; não há cobrança calculada sem regra contratual.
- Alternativa HTTP: `POST /api/operations/scheduled`, protegido por `OPERATIONS_SCHEDULER_SECRET` de pelo menos 32 caracteres em Bearer. Não expor o segredo no navegador.
- Monitoramento externo: `npx tsx --env-file=.env.local scripts/monitor.ts`. Configurar `MONITOR_URL` apontando à saúde HTTPS publicada, `MONITOR_LOG_PATH`, intervalo e `MONITOR_ALERT_WEBHOOK`. O executor grava cada amostra e tenta notificar indisponibilidade/recuperação. Instalar em host independente da aplicação; arquivar logs e definir retenção.
- Estes executores estão implementados, mas seu agendamento e entrega de alertas dependem da infraestrutura operacional. Sem execução contínua não há comprovação do SLA de 99,5%.
