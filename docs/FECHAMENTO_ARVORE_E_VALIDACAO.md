# Fechamento integrado — árvore processual e verificação

## Árvore processual

- `/arvore?type=document&id=<uuid>` e `/arvore?type=module&id=<uuid>` têm entrada nos detalhes do núcleo e da Gestão.
- `/api/process-tree` valida a sessão e a autorização de cada registro. Percorre vínculos diretos e inversos entre `linkedIds` e `coreDocumentIds`, sem divulgar metadados ou contagens de registros não autorizados.
- Vínculos cíclicos são visitados uma vez. O nível identifica o caminho a partir do registro de entrada; o vínculo original permanece na fonte e não é reescrito pela consulta.
- Documentos e anexos são vistas exclusivas de DataTable, com filtros e paginação de 20. Downloads usam os endpoints originais autenticados.
- PDF/ZIP completos usam a mesma árvore autorizada; ZIP personalizado usa somente os anexos explicitamente selecionados. A fila revalida as fontes antes de executar e baixar.
- Consulta interativa tem limite explícito de 100 documentos e 2.000 anexos, com erro quando excedido. O executor de trabalhos mantém limite de 200 anexos; o acervo integral utiliza a exportação operacional em streaming.
- PDF textual do ofício inclui QR para a consulta institucional autorizada. QR não cria recibo de ciência nem torna o documento público.

## Correções de integração

- Criação/alteração de prazos agora aceita participação aberta/pendente em qualquer vínculo setorial ativo do servidor, como os anexos.
- Ações por setor rejeitam setores desativados.
- Salvamento automático dos módulos só informa sucesso após a gravação e aguarda operações em andamento; falhas ficam explícitas e não são repetidas indefinidamente.
- Entradas externas e diligências passaram ao cálculo de SLA por expediente salvo. Diário usa catálogo versionado em vez de rótulos livres para a organização.

## Verificação de encerramento preparada

- `scripts/validate-capacity.ts`: 60 sessões Firebase independentes distribuídas entre contas existentes, três rodadas de leituras concorrentes, status e percentis; execução requer `--run --base --output`.
- Restauração isolada de snapshot via PostgreSQL WASM: recria tipos/tabelas, carrega registros, valida constraints/índices, confere originais por hash e aplica migrações. Não conecta nem restaura sobre produção.
- Resultados devem ser acrescentados após execução; a preparação destes executores não é evidência de aprovação.

## Evidências executadas em 10/11/2026

- TypeScript e lint aprovados no primeiro fechamento deste incremento; alterações posteriores exigem novo build final.
- 11 testes de SLA/expediente, snapshots do catálogo e imagens incorporadas no PDF aprovados.
- 11 cenários PostgreSQL isolados de catálogo/Diário aprovados, inclusive rollback, publicação, reparenting e imutabilidade.
- Snapshot prévio restaurado em PGlite: 16 tabelas originais, constraints, índices e hash do anexo conferidos; migrações 0001–008 aplicadas somente no ensaio isolado. Evidência privada `rio-isolated-restore-results.json`.
- Novo snapshot real preservado em `rio-before-migrations-1794330362017.json`; migrações 006 e 007 aplicadas pelo executor com checksum, mantendo o histórico 0001–005.
- Validação integrada por HTTP local contra serviços reais: **163 verificações aprovadas, zero falhas e zero bloqueios**. Cenários e teardown constam em `integrated-058f3af4-ec85-4655-a6bb-a75eb9214286/results.redacted.json`. Histórico dos dados temporários preservado cifrado; SQL/Firebase removidos pelo manifesto próprio.
- A primeira rodada identificou uma interpretação de `timestamp without time zone` no oráculo do teste. Consulta corrigida para UTC explícito, em conformidade com a leitura Drizzle; a segunda rodada passou integralmente.
- Carga de leitura local: **60 sessões, nove contas distintas, 180/180 requisições**, p50 1.749 ms, p95 5.029 ms, máximo 5.108 ms. Evidência `rio-capacity-results.json`. Não equivale a 60 identidades distintas, teste sustentado ou comprovação de SLA de produção.
- `scripts/reconcile-storage.ts --output <manifesto-privado>` inventaria referências e objetos, incluindo uploads anônimos incertos. Não exclui objetos automaticamente; o inventário requer revalidação antes de qualquer ação operacional.

### Ampliação final do ensaio

- **307 verificações HTTP aprovadas**, zero falhas/bloqueios: `integrated-223d5c19-2c37-4cdd-9662-1b89d2688fad/results.redacted.json`. Acrescenta upload anônimo obrigatório, idempotência/conflitos, assinatura de formato, download/hash/privacidade, conclusão multissetorial, avaliação substituída, reabertura/ciclos, lease renovado e medição/desenho em PDF derivado.
- Migrações 008 e 009 aplicadas; todos os históricos anteriores preservados por checksum. A 006 foi reconferida com o hash aplicado `81887c9e1489f7486001215be90f7084411ed4982bed27b4f094bfd0c2b3fc61`; a integração externa reside exclusivamente na 009.
- Build de produção aprovado com lint/tipos. Ensaio visual adicional das cinco listagens de contatos/perfis/listas/delegações/relatórios prontos aprovado; paginação 20/20/3, filtros, resize, diálogo/Escape, 1280×720, 1366×768, 1920×1080 e móvel 390×844. Evidência `rio-completion-browser-results.json`.
- Reconciliação de armazenamento: três objetos, zero candidatos sem referência e zero referências ausentes no instante conferido.
- Exportação real em streaming com dump PostgreSQL consistente: **50 tabelas, 585 linhas e três arquivos**, manifesto v2 em `rio-stream-export-20261110-complete`.
- Restauração real com `pg_restore --single-transaction` em PostgreSQL 18 local, banco vazio `rio_restore_20261110`: todas as contagens, hashes dos arquivos e FKs conferidos, sem tocar a base de origem. Evidência `rio-restored-20261110/restore-result.json`.
- O tamanho cadastrado do anexo legado diverge do objeto original já preservado no snapshot. O exportador mantém recusa por padrão; a opção operacional explícita `--preserve-size-discrepancies` preserva cadastro/bytes e registra ambos os tamanhos no manifesto, mantendo conferência obrigatória do tamanho transferido versus Blob e SHA-256 quando disponível. Não houve correção silenciosa do cadastro.
- O ensaio real de restauração comprova banco e arquivos locais. Remapeamento de armazenamento para abrir a aplicação restaurada, cópias redundantes e execução agendada continuam dependências operacionais.
- Capacitação/suporte: **101 verificações HTTP aprovadas**, zero falhas, em `learning-support-16c66554-83c1-486e-9b23-d87c0e254cb7`. Inclui sequência das aulas, reprovação/aprovação, certificado PDF imutável/hash/privacidade, SLA por severidade, atribuição/resposta/escalonamento/resolução, avaliação/reabertura e recusas N3. Limpeza SQL/Firebase própria confirmada.
- Build final regenerado com o servidor de desenvolvimento encerrado, evitando disputa pela pasta `.next`; compilação, lint e tipos aprovados, 62 páginas estáticas.
- Recusas por revisão antiga traduzidas para **HTTP 409** e novamente conferidas: `contacts-4e6b4aaf-9938-4b2f-8d77-7e1aa4ad2979`, **86/86**, limpeza concluída. Esta rodada substitui as três recusas 500 toleradas pelo primeiro roteiro.
- Smoke HTTP ampliado do build local: **50/50**. Conferidas também as seis páginas de expediente, catálogo do Diário, novo contato, unificação, Ouvidoria anônima e cadastro externo; linguagem operacional e carregamento aprovados.
