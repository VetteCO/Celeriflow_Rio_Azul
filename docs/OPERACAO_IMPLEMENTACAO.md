# Gestão, capacitação e suporte — implementação da etapa 9

## Entregas e integração

- Schema direto em `src/db/operations-schema.ts`; migração `src/db/migrations/003_operations.sql` sem `BEGIN/COMMIT` externos: o executor `scripts/migrate.ts` controla a transação. Os blocos `BEGIN/END` internos de funções PL/pgSQL permanecem necessários. Nenhuma alteração de `schema.ts`/`index.ts` é necessária. Aplicar a migração após revisão coordenada; `db:push` com somente o schema principal não incorpora essas tabelas.
- `operations_next_code()` aloca códigos `aaaammddxxxxx`, fuso America/Sao_Paulo, contador diário persistido com conflito atômico e limite explícito de 99.999. Usa `business_counter` com chave `business:aaaammdd`, compartilhada com `nextBusinessCode()` do núcleo. Coordenar o gerador `modules_next_code()` da etapa 6–8 para usar a mesma sequência global.
- Permissões a integrar no RBAC central: `operations:reports` (relatórios/auditoria), `operations:manage` (publicar cursos, administrar chamados, saúde) e `operations:export` (exportação integral). `ADMIN_GERAL` já recebe pelo curinga. Não atribuir automaticamente exportação a auditor ou administrador local: ela abrange dados integrais. EAD próprio e chamados próprios exigem servidor ativo autenticado; consulta é restrita por usuário.
- Entrada de navegação para integração pelo principal: `/operacao`. Subrotas `/ead`, `/suporte`, `/auditoria`, `/continuidade` já possuem navegação interna.
- Todas as grades usam a exportação nomeada `DataTable`, contrato informado pela coordenação. Não foram adicionadas dependências. CSV, PDF 1.4 textual, XLSX OOXML e ZIP são gerados localmente. PDF usa Helvetica/WinAnsi (português); caracteres fora desse repertório são substituídos por espaço. Não é PDF/A nem assinatura digital.

## Relatórios reais

`GET /api/operations/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&department=UUID&user=UUID&module=...&format=csv|pdf|xlsx`

Período final inclusivo. Consultas agregadas independentes evitam multiplicação por joins. Exportações abrangem todos os indicadores do filtro aplicado, não só a página visível. Filtros aplicados (em vez de campos ainda não confirmados) alimentam exportação. A tela oferece gráfico de contagens e a origem de cada métrica.

| Indicador | Fonte e interpretação |
|---|---|
| Volumetria e conclusão | Documentos criados no período; conclusão reflete situação atual dessa população |
| Produtividade | Movimentações ocorridas no período por ator e setor de origem/destino informado |
| Leitura | Primeiras leituras registradas no período por leitor |
| Consumo | Soma dos tamanhos cadastrados dos anexos dos documentos criados; não fatura do Blob |
| Qualidade | Prazos pendentes vencidos na posição atual e média de avaliações reais de chamados |
| Auditoria, acessos, assiduidade digital | Eventos instrumentados; dias com eventos não representam ponto funcional. Login conta apenas ações LOGIN/AUTH_LOGIN/SESSION_LOGIN |
| Suporte | Chamados abertos no período, prazos excedidos e média de horas até resolução |
| Módulos e georreferenciamento | `module_record` quando presente: registros por família, fiscalizações com coordenadas e quantidade de feições cadastradas |

`module` usa tipo documental (`MEMORANDUM` etc.), família (`fiscalizacao`, `camadas` etc.), `SUPPORT` ou entidade de auditoria. Fontes que não correspondem retornam zero/ausência; não confundir módulos com o nome comercial de uma secretaria. Setor e usuário têm semântica descrita na coluna origem. Relatórios são gerenciais agregados e restritos à permissão própria, não concedem leitura documental ampla por inferência.

Relatórios contratuais: `/operacao/contratos` registra snapshot mensal imutável com código, competência, data e exportação CSV/PDF/XLSX. `POST /api/operations/contract-reports` aceita `{ "period": "2026-11", "requestKey": "monthly:2026-11" }`; repetição da chave retorna o mesmo relatório e conflito de competência é recusado. Um agendador externo pode chamar a API com token Firebase vigente de conta de serviço autorizada; configurar renovação de credencial e agendamento após o fechamento mensal. Não embutir token estático no código. A tela usa uma chave mensal; snapshots adicionais via API exigem outra chave explícita e preservam os anteriores. Registro representa dados conhecidos na geração, não reconstituição retroativa de estados.

Mapa básico: `/operacao/mapa` consulta `/api/operations/geo` com a mesma permissão de relatórios. Desenha pontos de fiscalizações e GeoJSON Point/LineString/Polygon/MultiPolygon de camadas reais em SVG, com seleção por teclado, zoom, deslocamento, enquadramento, visibilidade por fonte e filtros de código/setor/família. A API retorna somente código, família e geometria, sem propriedades cadastrais arbitrárias. Coordenadas ausentes/inválidas são contabilizadas; não viram ponto zero. Limites de 1.000 registros e 50.000 vértices recusam explicitamente recortes excessivos, sem truncar silenciosamente. É representação esquemática WGS84, sem mapa-base externo, análise métrica ou garantia de precisão GPS. Anéis de polígonos precisam estar fechados; recortes que cruzem o antimeridiano exigem tratamento cartográfico próprio.

Pendências: análise cartográfica avançada e exportação de geometrias próprias, configuração do agendamento externo para TR 11.8, cálculo de faturamento, medição de custos reais, disponibilidade e assiduidade funcional. O cálculo de cobrança depende da regra contratual e do consumo medido; não foi inventado faturamento. Exportações de indicadores são pequenas e síncronas; grandes exportações têm worker operacional de continuidade, não fila web durável.

## EAD e suporte

Curso publicado preserva aulas em ordem e questões. API nunca entrega o gabarito na consulta dos alunos. Progresso sequencial é conferido no servidor, avaliação corrigida no servidor, aprovação mínima por curso, certificado PDF persistido com código e data imutáveis. Confirmação da aula é declaração do participante: não comprova tempo assistido. Vídeos devem ser endereços HTTPS reais fornecidos pela implantação; a tela abre a fonte, não hospeda/transcodifica vídeo. Publicação pela tela monta múltiplas aulas/questões. Novo conteúdo deve ser novo curso para preservar certificados.

Chamados têm criticidade 2h/8h/24h em horas corridas, histórico de mensagens, atribuição, escalonamento, primeiro retorno distinto de solução, avaliação pelo solicitante após resolução e proteção contra atualização concorrente. Reabrir não reinicia artificialmente SLA. A conversa é persistida, recarregada após envio e atualizada por polling de 12 segundos no detalhe aberto. Não sobrepõe requisições, pausa consultas em aba oculta e durante envio, cancela requisições ao sair e preserva a mensagem em edição. Consulta individual revalida permissão do solicitante/equipe no servidor. Alteração de responsável só é enviada quando editada, evitando sobrescrever atribuições recebidas pelo polling. Não é WebSocket nem canal WhatsApp. Escalonamento registra estado; notificação automática e escala institucional dependem da operação/canais externos.

## Verificação e roteiro de aceite

Executado localmente: `npx tsx --test src/lib/operations/formats.test.ts` — 4 verificações aprovadas (CSV/escape, PDF/xref multipágina, OOXML sem fórmula, ZIP/bytes originais). Verificação TypeScript identificou inicialmente diferenças de exportação do componente compartilhado e alvo ES5; corrigidas no escopo. Build/lint global ficam com o principal. Nenhuma migração remota, seed ou envio de e-mail foi executado.

Após migração coordenada, validar com contas reais autorizadas:
1. Gestor filtra período/setor/servidor/módulo, confere contagens nas fontes e abre CSV/PDF/XLSX. Usuário sem permissão deve receber 403.
2. Publicar curso com duas aulas e questões; aluno não pode concluir a segunda antes da primeira; avaliar incorretamente, refazer, aprovar e baixar certificado. Reenvio após emissão não altera certificado.
3. Abrir chamado, confirmar privacidade contra outro solicitante, atribuir, escalonar e resolver como gestor. Conferir primeiro retorno/prazo/histórico, avaliar como solicitante e exercitar conflito de duas atualizações.
4. Exportar ZIP autorizado, comparar hashes/contagens e baixar cada original; testar original indisponível com fixture isolada. Nenhum arquivo parcial pode ser declarado exportação concluída.
5. Executar worker e restauração conforme `OPERACAO_CONTINUIDADE.md`; registrar evidências reais.

## Cobertura de tabelas

| Rota | Grade | Estado |
|---|---|---|
| `/operacao` | Indicadores/categoria/valor/unidade/origem | DataTable integrado; geometria aguardando validação do shell no navegador |
| `/operacao/contratos` | Código/competência/data/exportações | DataTable integrado; snapshots persistidos e idempotência |
| `/operacao/ead` | Código/curso/módulo/progresso/nota/ações | DataTable integrado; curso e publicação em formulários separados |
| `/operacao/suporte` | Código/assunto/situação/criticidade/SLA/ações | DataTable integrado; histórico em detalhe separado |
| `/operacao/auditoria` | Data/ator/ação/entidade/registro/contexto | Paginação servidor em 20 registros, total filtrado, busca/ordenação globais |

Auditoria usa `pagination`, `onSearch`, `onSort` e `filters` do contrato ampliado do DataTable. Total, página ajustada e resultados são calculados em uma única consulta/snapshot; ordenação tem desempate por ID e campos permitidos em lista fixa. Busca textual literal abrange todas as linhas filtradas (inclusive contexto JSON), antes da paginação. A busca tem debounce de 250 ms e cancelamento de respostas obsoletas. Filtros de ator/entidade e início/fim (fim exclusivo) ficam na faixa `filters`.

Relatórios também movem o formulário para `filters`, e metodologia/gráfico abrem uma vista separada da grade. Contratos exibem filtro de competência na faixa e ação de registro no cabeçalho; criação mensal é formulário separado. EAD e suporte já alternam listagem e formulário/detalhe; não empilham grades de altura integral. O mapa é visualização não tabular própria.

Nesta rodada de continuidade, nenhum teste, lint, build, migração ou acesso remoto foi executado; os testes de formatos anteriores foram preservados. Não há evidência de geometria em viewports, zoom ou 21 registros nesta entrega; executar matriz do padrão de tabelas e fluxos de polling/mapa na validação principal. Interface não declara aprovação de capacidade ou homologação.
