# Fechamento programável da operação — etapa 9

Rodada local de desenvolvimento, 10/11/2026. A implementação inicial foi entregue sem execuções remotas. **Atualização posterior autorizada: validação HTTP/SQL e catálogo executados**, conforme seção final deste documento. Migração 008 aplicada e congelada pelo principal; não alterada nesta validação. Nenhum provisionamento, SLA, redundância ou homologação é declarado.

## Entregas de código

### Indicadores e gráficos

- `src/lib/operations/completion-reports.ts`, integrado a `reports.ts`: população núcleo por criação e origem/participação setorial; percentual de conclusão atual; tempos de primeira leitura/ação e recebimento→conclusão; engajamento com denominador de destinatários individuais distintos; anexos e tamanho médio.
- Módulos: encerramentos/percentuais por família, avaliação numérica vigente sem comentários/identidade, anexos/tamanhos, eventos `MODULE_*` por vínculo de registro, tempos baseados em auditoria/versões, faixas de idade, séries mensais, emissões delegadas, usos efetivos de contrassenha e solicitações de assinatura por estado conhecido. `updated_at` não é usado como data fictícia de resolução.
- Utilização: população de servidores e habilitados atuais, faixas disjuntas da última ação instrumentada até a data final. Módulo restringe a população a atores com eventos vinculados; setor é lotação atual. EAD: certificados por data de emissão e média dos certificados.
- Auditoria geral passa a reconhecer família dos módulos vinculados por `entity_id`, inclusive eventos cuja entidade é `module_record`, e tipo documental vinculado. Coordenadas só entram na contagem após validação numérica/faixa WGS84.
- Gráficos em vista exclusiva, separados por categoria e unidade, com fonte/descrição, tela cheia e exportação SVG. Séries mensais são barras por mês/tipo. Não somam percentuais, médias ou subconjuntos. A tabela permanece `DataTable`, 20 linhas pelo componente compartilhado.
- Novo `/operacao/delegacoes`, API `/api/operations/delegations`: código documental, tipo de autorização, identificador da autorização, autorizador, digitador/usuário, setor e data. Filtros período/setor/usuário/família e CSV/PDF/XLSX completos do filtro. Usuário selecionado corresponde a autorizador **ou** digitador. Não entrega token, hash de contrassenha, corpo, assunto ou identidade externa. A consulta usa `operations:reports`; exportações são auditadas.
- Indicadores genéricos não agrupam texto livre/assunto/corpo ou identidade pessoal. Métricas são agregadas independentemente, sem multiplicação por joins. Cada fonte declara eixo temporal e papel do usuário/setor. Os conjuntos de origens distintas não devem ser somados como se fossem uma população única.

### Faturamento explícito

`src/lib/operations/billing.ts` é usado tanto pela geração mensal agendada quanto pelo POST de contratos. O snapshot imutável incorpora linhas calculadas e configuração integral/versionada com SHA-256. Não há tarifa derivada de valores de referência do edital.

Configurar `OPERATIONS_BILLING_RULE_JSON` somente com regra contratual aprovada, por exemplo **estrutura ilustrativa, sem preço sugerido**:

```json
{
  "version": "contrato-versao-aprovada",
  "contractReference": "identificador-do-instrumento",
  "validFrom": "2026-11",
  "validTo": "2027-10",
  "monthlyFixedCents": 0,
  "items": []
}
```

`0` só deve ser configurado se for efetivamente a parcela contratada; o exemplo não deve ser aplicado como tarifa. Itens opcionais exigem `indicator` (`volume`, `moves`, `bytes` ou `tickets`), `unitPriceCents` inteiro não negativo e `unitsPerCharge` positivo. Fórmula por item: arredondar `quantidade / unitsPerCharge × unitPriceCents` ao centavo; somar parcela fixa. Escalas/unidades vêm das métricas declaradas. A configuração é estrita, impede duplicação de itens e recusa competência fora da vigência. Sem variável, o relatório registra **regra ausente**, não uma cobrança zero. Resultado é cálculo para conferência, não emissão fiscal. Repetir chave preserva snapshot anterior; nova regra não altera retrospectivamente relatório existente.

### Exportação aberta e backup por streaming

Novos `scripts/export-operations.ts` e `src/lib/operations/stream-export.ts`; `backup-worker.ts` passa a utilizar o mesmo executor com dump obrigatório. Pré-requisitos: Node 24, `pg_dump` compatível, conexão PostgreSQL direta, acesso aos Blobs, credenciais protegidas e `OPERATIONS_SERVICE_USER_ID` de **ADMIN_GERAL ativo**. A autorização é checada no banco antes de exportar. É obrigatório `--authorize-full-export`.

```powershell
npx tsx --env-file=.env.local scripts/export-operations.ts D:\Exportacoes\RioAzul-UNICO --authorize-full-export --with-dump
npx tsx --env-file=.env.local src/lib/operations/backup-worker.ts D:\Backups\RioAzul-UNICO --authorize-full-export
```

Sem `--with-dump`, a primeira opção ainda produz schema SQL e JSON e dados abertos. Saída:

- `tables/NNNN.jsonl`: todas as linhas de cada tabela `public`, uma linha JSON completa por linha física. Manifesto associa arquivo ao nome original e à contagem. Cursor PostgreSQL com lotes de 100 linhas e backpressure, sem `jsonb_agg` global e sem limite total de 64 MiB. A memória depende do lote/maior linha, não da base inteira.
- `schema.json`: colunas, tipos, defaults, constraints e índices; `schema.sql`: DDL completo via pg_dump, incluindo sequências, funções e triggers.
- `database.dump` quando solicitado: **mesmo snapshot PostgreSQL exportado** da transação repeatable-read utilizada pelos cursores e schema. O diretório precisa ser novo.
- `originals/`: bytes integrais de `attachment.storage_key`, `module_file.storage_key` e `document_job.output_key`, por streaming, com comparação de tamanho/hash cadastrado quando presentes. O inventário foi conferido nesses três campos dos schemas atuais. Cada referência tem arquivo próprio, mesmo quando repete a chave.
- `original-references.jsonl`, `files.jsonl`: inventário incremental com origem, identificador, chave, caminho, tamanho e SHA-256; `execution.jsonl`: conta, run e progresso, sem credenciais; eventos de início/conclusão/falha no `audit_log`.
- `manifest.json` só é renomeado ao final, após todos os arquivos e auditoria de conclusão. Hash de `files.jsonl` no manifesto cobre hashes dos demais arquivos. Saída não zero/manifesto ausente significa incompleto. Manter o manifesto em canal confiável: hashes não substituem assinatura do pacote.

Originais devem permanecer imutáveis e retidos durante a cópia; PostgreSQL e Blob não compartilham transação. Referência a artefato expirado/ausente causa falha explícita, nunca sucesso parcial. Não remover artefatos durante execução. Backup/exportação não engloba secrets, identidade Firebase, DNS ou vídeos externos. Novos armazenamentos exigem atualizar o inventário.

A API web continua sendo a cópia síncrona pequena, com teto explícito, e agora inclui schema JSON e artefatos referenciados de jobs. `/operacao/continuidade` apresenta o comando operacional sem teto de 64 MiB e seus pré-requisitos; não tenta iniciar processo no host serverless. Não há fila web durável de exportação nesta rodada.

### Ensaio de restauração executável

`scripts/restore-operations.ts` exige pacote v2 com dump e manifesto íntegro, `DATABASE_URL` da origem para comparar, `RESTORE_DATABASE_URL`, `RESTORE_DATABASE_NAME` e `--confirm-isolated`. Nome do banco precisa conter `restore`, `ensaio`, `test` ou `homolog` e coincidir com o banco efetivamente conectado. Recusa mesmo host/banco da origem (normalizando sufixo pooler) e destino com tabelas existentes. Nenhum comando usa `--clean`.

```powershell
npx tsx --env-file=.env.ensaio scripts/restore-operations.ts D:\Backups\RioAzul-UNICO D:\Ensaios\RioAzul-UNICO --confirm-isolated
```

Verifica todos os hashes/tamanhos antes de restaurar; `pg_restore --exit-on-error --single-transaction --no-owner --no-acl` em destino explícito; confere contagens por tabela e ausência de FKs não validadas; copia todos os originais a diretório novo e confere novamente hashes. `storage-map.jsonl` liga chave original ao arquivo local; resultado inclui início/fim e hash do mapa. Falha gera evidência separada e não remove o banco/diretório parcial.

O status de sucesso é **DATABASE_AND_LOCAL_FILES_VERIFIED**, não aceite da aplicação. O executor não envia arquivos ao Blob de produção. Configurar armazenamento privado isolado e remapear chaves somente no banco restaurado antes de testar downloads e permissões na aplicação. Esse remapeamento específico de provedor permanece operacional/manual. Nome/URL são barreiras contra engano, não descoberta infalível de aliases: o responsável precisa fornecer o destino realmente isolado.

## Conferência a executar pelo principal

1. Build/lint/tipos e testes pertinentes na rodada final coordenada. Esta continuação requer **`src/db/migrations/008_operations_completion.sql`**, ainda não aplicada pelo agente. Ela acrescenta fila, catálogo de páginas e histórico de participação; depende das tabelas anteriores do núcleo/módulos/jobs.
2. API: 401 anônimo/403 sem permissão; administrador de relatórios autorizado; filtro de família inclui `MODULE_*` com `entity_type=module_record`; filtro por usuário distingue criador/ator/leitor conforme fonte; filtro que não corresponde à fonte retorna zero/ausência, não total global.
3. Massa isolada: duas leituras repetidas não duplicam destinatários; denominador zero não vira 0% inventado; documento com anexos e vários movimentos não multiplica anexos; module_version final produz duração válida; reaberto não entra em encerrados atuais; avaliação usa número vigente, sem comentário/PII.
4. Conferir faixas 2/3/7/14/45 e 20/30 dias; conferir divergência explícita entre situação atual e data histórica. Comparar séries mensais com fontes, SVG com valores e CSV/PDF/XLSX com todo o filtro. Tabela 21 linhas → 20+1; gráficos em vista própria.
5. Delegação e contrassenha: emissão/uso persistido, nomes internos, código e data; usuário como autorizador e digitador; nenhum token/hash no JSON/exportação. Contagens gerais não devem ser somadas aos eventos de auditoria, que são outra métrica.
6. Faturamento: variável ausente; regra válida; vigência inválida; itens duplicados; preços fracionados rejeitados; divisão por unidade e arredondamento; mesma chave mantém regra/snapshot antigo.
7. Ensaio autorizado: exportar massa superior a 64 MiB; conferir original núcleo+módulo+job, contagens/hashes, schema e dump; provocar original ausente/hash divergente e confirmar ausência de manifesto de conclusão. Conferir logs/auditoria e memória sob volume.
8. Restaurar em banco vazio isolado; recusar origem/banco não vazio/nome divergente/arquivo adulterado; comparar contagens e originais; só então configurar aplicação de ensaio e testar autorização/download. Guardar evidências reais e medir RPO/RTO observados.

## Continuação: fechamento das lacunas programáveis REL/IND listadas anteriormente

### Relatórios prontos, retenção e aviso

Implementados `operation_report_job`, APIs `/api/operations/report-jobs` e `/[id]`, `/operacao/prontos` e executor `scripts/operations-report-worker.ts`. Nenhum subprocesso é iniciado pelo servidor web.

```powershell
npx tsx --env-file=.env.local scripts/operations-report-worker.ts
npx tsx --env-file=.env.local scripts/operations-report-worker.ts --watch
```

- POST valida `operations:reports`, proprietário ativo, filtros e formato; reutiliza trabalho em fila/pronto com características iguais. Lock transacional via `db.batch` evita duplicação concorrente do mesmo recorte; chave de requisição torna repetição idempotente.
- Worker reivindica com `FOR UPDATE SKIP LOCKED`, lease de 30 minutos, até três tentativas, recuperação após interrupção e publicação condicionada ao token ainda vigente. Revalida permissão atual do solicitante pelo RBAC existente.
- Todas as consultas geradoras rodam na **mesma conexão/transação PostgreSQL REPEATABLE READ READ ONLY**, por contexto local de consulta. O `db` comum não foi alterado. Esse caminho consistente também foi adotado pelos relatórios imediatos e snapshots contratuais.
- Snapshot inclui filtros, proprietário, data, linhas e metodologia. Guard no banco impede modificar proprietário, filtros/formato/chave e snapshot já publicado.
- CSV/PDF/XLSX são persistidos em Blob privado. API de download revalida proprietário, permissão e expiração; não entrega chave Blob nem URL pública. Download é auditado. Snapshot para gráficos exige o mesmo escopo.
- Publicação mantém **últimos cinco prontos por proprietário**, com expiração máxima de **sete dias contados da conclusão**. Expiração é efetiva na API mesmo com executor desligado; worker faz descarte físico dos arquivos expirados e limpa a referência. Metadados/histórico do pedido permanecem para auditoria.
- Aviso de novos relatórios aparece no link da navegação da operação e na lista, por polling sem sobreposição, suspenso em aba oculta. Ciência é persistida após download. Listagem usa DataTable 20; criação e gráficos são vistas exclusivas.
- Artefatos desta fila foram acrescentados ao inventário das exportações web/streaming; procedimentos de backup e restauração foram preservados.

### Páginas físicas medidas e economia configurada

`operation_page_metric` armazena medições por fonte/ID/chave/hash, estado, páginas, tamanho, hash real e data. `scripts/operations-page-worker.ts` descobre originais núcleo/módulos e saídas **SUCCEEDED** de `document_job` sem alterar código ou schema dos jobs.

```powershell
npx tsx --env-file=.env.local scripts/operations-page-worker.ts
npx tsx --env-file=.env.local scripts/operations-page-worker.ts --retry-unknown
```

O catálogo exige `DATABASE_URL` **direta, sem pooler transacional**, usa cursor com lotes de 25, download por streaming a arquivo temporário e SHA-256, depois `pdf-lib` conta páginas do PDF completo. O parser precisa carregar um PDF por vez: `OPERATIONS_PDF_MAX_BYTES` limita esse processamento (padrão 512 MiB); excedente/protegido/inválido/ausente fica **UNREADABLE**, nunca zero páginas. Não PDF fica **UNSUPPORTED**. `OPERATIONS_TEMP_DIR` permite escolher diretório temporário institucional. As medições são gravadas individualmente e sobrevivem a interrupções do lote.

Consultas gerenciais leem somente o catálogo, sem download de PDF por requisição. Exibem soma das páginas realmente conhecidas, quantidade sem medição e idade do catálogo. Produtos completos publicados têm indicador próprio e cobertura desconhecida própria; não são somados aos anexos originais, evitando dupla contagem. Filtros dos produtos usam fontes do payload via `EXISTS`, sem multiplicar um PDF vinculado a vários registros.

Economia hipotética exige `OPERATIONS_PAPER_PRICE_CENTS` inteiro não negativo e `OPERATIONS_PAPER_COPIES` inteiro positivo. Calcula `páginas conhecidas dos originais × cópias × preço/100`; fonte apresenta parâmetros e ressalva que não prova impressão evitada. Páginas desconhecidas e preço ausente não viram valor monetário zero. Esta regra de economia é distinta da regra de faturamento contratual.

### Histórico, hierarquia, assunto e signatários

`historical-reports.ts` acrescenta categorias históricas separadas das categorias de situação atual:

- Corte na data final, limitado ao instante atual; estados de núcleo por participação/histórico capturado/movimentos, recebimento e conclusão por setor; primeira leitura e primeira ação anteriores ao corte.
- Migração 008 cria `operation_participation_history` imutável e triggers aditivos na participação. A observação inicial é datada **na migração**, não retroagida. Atualizações futuras de estado são preservadas automaticamente sem alterar APIs de outros agentes.
- Antes da instrumentação, só usa evidências de movimento e participação cuja atualização anteceda o corte; participações sem estado demonstrável são explicitamente desconhecidas. O histórico não transforma um estado atual em estado passado. Eficiência histórica informa denominador conhecido e quantidade excluída por insuficiência de evidência.
- Módulos usam última `module_version` no corte, incluindo setores esperados/concluídos da etapa daquele snapshot. Estado atual posterior e `updated_at` não substituem evento histórico.
- Comparação **geral versus subárvore** com recursão protegida contra ciclos. Mantém período/tipo/família/usuário e remove somente setor na população geral, rotulada como comparação explícita. Documento/instância é contado uma vez por população, mesmo com várias participações.
- Dimensão assunto usa UUID de workflow configurado validado, com fallback `SEM_WORKFLOW`; núcleo usa tipo documental. Nenhum assunto livre, corpo, comentário ou identificação externa vira rótulo gerencial.
- Estados históricos das solicitações por signatário/ciclo, média e total solicitação→estado assinado **quando ambos os eventos existem**. Eventos `SIGNED` do núcleo aparecem por ator; sem solicitação correlacionável no dado, duração fica desconhecida. Isso é cobertura de dados, não tempo zero ou assinatura criptográfica presumida.

### Mapa gerencial

API/tela da operação agora permitem período, corte histórico, família, setor, workflow, abertos/resolvidos e faixa. Pontos de demandas georreferenciadas de todas as famílias e camadas usam dados da versão no corte. Faixas disjuntas: abertos até 20, mais de 20 até 30, mais de 30 dias; resolvidos até 30/mais de 30; sem data final demonstrável = `SEM_DATA`. Quantidade e percentual de demandas são publicados sem multiplicar feições; camadas ficam fora do denominador, coordenadas inválidas são informadas.

Modo calor representa contagem de pontos em células da vista 24×16, sem inventar superfície de risco ou área métrica. Pinos mostram código, família, estado, faixa, UUID do assunto, criação e coordenadas. Link ao registro passa pela autorização documental normal. Mantidos zoom, deslocamento, camadas, teclado e limites explícitos sem truncamento silencioso.

### Testes preparados e integração principal

Criados **sem executar nesta rodada**:

- `src/lib/operations/billing.test.ts`: regra ausente, arredondamento, hash/proveniência, vigência, duplicação e métrica ausente.
- `src/lib/operations/snapshot-helpers.test.ts`: chave canônica com separação de escopo/formato, retenção de cinco e fronteira de sete dias, limites 20/30 dias, duração negativa e economia sem páginas/preço conhecido.

Pontos objetivos para o principal:

1. Incluir a migração 008 na revisão/aplicação coordenada. Ela é pré-requisito dos novos relatórios, APIs e executores. Não foi aplicada pelo agente.
2. Rodar build/lint/tipos e testes finais, depois ensaio integrado: dois proprietários, revogação de permissão, concorrência de solicitações, queda/lease/retry, seis relatórios e expiração, Blob privado e snapshot coerente sob gravações concorrentes.
3. Rodar catálogo com PDF conhecido de várias páginas, PDF protegido/ilegível, PDF completo publicado de job e fonte duplicada no payload; conferir cobertura e ausência de dupla contagem.
4. Conferir histórico antes/depois de conclusão, reabertura e migração, subárvore com participação múltipla, faixas do mapa e filtro sem dados.
5. Provisionamento/agendamento dos dois executores é decisão operacional posterior. **Não é necessário alterar jobs**: o catálogo descobre saídas publicadas. Não houve execução remota, deploy ou teste nesta rodada.

O código implementa os itens programáveis desta continuação; cobertura dos registros anteriores à instrumentação, eventos de assinatura inexistentes, provisionamento, SLA, redundância e aceite permanecem fatos a medir, não resultados fabricados. Infraestrutura PDF/A/OCR continua adiada pelo proprietário.

Este documento atualiza as instruções antigas de `OPERACAO_CONTINUIDADE.md` sobre worker em memória e formato v1: para as novas execuções usar o procedimento v2 acima. Backups v1 não são aceitos pelo novo executor de ensaio.

## Validação real autorizada — 10/11/2026, continuação

Executado `scripts/validate-operations.ts --run --base http://localhost:3300`, com autenticação real de contas existentes e PostgreSQL/Blob reais. O harness não imprime dados pessoais, tokens, URLs de Blob ou credenciais. Escreve somente pedidos de relatório próprios, medições do catálogo e auditoria; limpa somente os próprios pedidos/arquivos. Uma opção `--id` foi acrescentada ao worker de relatórios para execução dirigida sem consumir pedidos alheios nem rodar limpeza global. O catálogo aceita seleção explícita de fontes.

### Correções encontradas em execução

1. PostgreSQL rejeitou o alias implícito `month` das séries mensais (`42601`). Corrigidas as duas consultas para `AS month`; conjunto de consultas validado também diretamente em transação somente leitura.
2. Upload do worker CLI precisava normalizar o token Blob, seguindo a biblioteca comum: `trim()` e remoção das aspas externas. Normalização aplicada a upload/remoção e ao harness.
3. Comparação do harness foi corrigida para chave canônica dos filtros: JSONB não preserva ordem das propriedades JSON.

Um rebuild local após a correção SQL aprovou compilação/lint/tipos. O servidor 3300 foi reaberto e mantido em execução. Alterações posteriores de worker/harness não exigiram interrupção do servidor; próximo build final fica com o principal. **Nenhuma alteração na migração 008, nenhum deploy/commit e nenhum acesso ao procedimento de export/restore do principal.**

### Resultado funcional observado

- 401 sem sessão para relatórios/fila/mapa; 403 para perfil restrito.
- Relatórios JSON, CSV, PDF e XLSX com resposta 200; PDF interpretado por pdf-lib, XLSX com estrutura OOXML, CSV com cabeçalho esperado.
- Volumetria/tamanho de anexos e populações históricas por tipo reconciliados com SQL. Recorte sem módulo correspondente não retorna volumetria global. Corte anterior à operação não inventa população histórica.
- Geo histórico responde com campos restritos, geometria válida para as feições existentes e percentuais reconciliados. A massa disponível não comprova todas as faixas geográficas povoadas.
- Três pedidos reais, um de cada formato, gerados individualmente pelo worker e publicados em Blob privado. Repetição em fila e depois de pronto retorna o mesmo ID. Proprietário/filtros do snapshot e TTL de sete dias conferidos.
- Downloads autenticados conferidos por SHA-256 e tamanho; acesso anônimo recusado; outra conta **com permissão de relatórios** recebe 404 para o arquivo de outro proprietário; URL privada do Blob recusou acesso sem credencial.
- Preview de snapshot corresponde ao persistido; auditoria contém três publicações e três downloads.
- Catálogo real: um anexo não PDF = `UNSUPPORTED`, páginas `null`; um job PDF = **2 páginas**, **44.298 bytes**, hash e contagem reconferidos; um job ZIP = `UNSUPPORTED`, páginas `null`. As três métricas foram preservadas como dados operacionais legítimos.

Execução final funcional: **87 assertivas PASS**. O arquivo bruto também registra duas falhas derivadas da mesma comparação de tabela inteira de setores, enquanto outro harness criou um setor. Isso não foi apagado nem convertido em PASS: a reconciliação separada encontrou `DEPARTMENT_CREATED` no intervalo, confirmou novamente **15 usuários, 5 documentos, 1 anexo e 6 setores**, e comprovou **zero pedidos próprios e zero Blobs próprios restantes**. Hashes das tabelas documentais, movimentos, participações, módulos/versões/arquivos e jobs ficaram iguais durante a execução final. O harness agora distingue esse conflito de concorrência como BLOCKED, exigindo reconciliação, em vez de confundi-lo com alteração feita pelo teste.

Evidência restrita ao executor:

- `C:\Users\trici\AppData\Local\Temp\opencode\operations-validation-7a13ff31-d044-41e0-b5e4-012547c838bd\results.redacted.json`
- Mesmo diretório: `reconciliation.redacted.json`, com inventário, catálogo, evento administrativo concorrente, limpeza e auditoria preservada.
- `ownership.private.json` guarda somente IDs necessários à limpeza; não publicar como documentação externa.

Arquivos finais gerados e depois removidos: CSV 11.581 bytes, PDF 13.344 bytes, XLSX 28.186 bytes. Os respectivos hashes estão na evidência. Tentativas diagnósticas anteriores também limparam seus próprios pedidos e preservaram auditoria; não houve limpeza de dados originais.
