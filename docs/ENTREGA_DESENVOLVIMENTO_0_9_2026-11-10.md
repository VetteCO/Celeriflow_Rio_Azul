# Entrega de desenvolvimento — etapas 0 a 9

**Atualização de publicação:** versão publicada e conferida em https://rioazul.celeriflow.com.br pela conta `celeriflow@gmail.com`. Build remoto, 39 verificações HTTP e conferência das tabelas aprovados. Ver `DEPLOY_2026-11-10.md`; as referências abaixo ao ambiente somente local descrevem a rodada anterior à publicação.

Data: 10/11/2026. Ambiente conferido: **http://localhost:3200**. Next.js **15.5.29**, Node.js 24.21.0; requisito mínimo do projeto: Node.js 22.13.

**Rodada complementar posterior:** código compilado em produção local (`localhost:3300`), nove migrações aplicadas, 34 testes de domínio/formatos aprovados, 307 verificações integradas e 86 verificações adicionais de contatos/cadastro externo aprovadas. Exportação integral e restauração PostgreSQL real concluídas. Detalhes/evidências em `FECHAMENTO_ARVORE_E_VALIDACAO.md`, `FECHAMENTO_ATENDIMENTO_CONTATOS.md`, `FECHAMENTO_EXPEDIENTE_DIARIO.md` e `FECHAMENTO_OPERACAO.md`. Esta rodada amplia e substitui as lacunas funcionais abaixo; sua publicação deve ser conferida no registro de deploy.

**Fechamento dos roteiros:** 307 núcleo/módulos + 86 contatos + 101 EAD/suporte + 92 operação = **586 verificações integradas aprovadas**, sem falhas nas rodadas finais. Há ainda 50 verificações HTTP de leitura/recusa do build, 34 testes de domínio/formatos, cenários SQL isolados, conferência visual, exportação/restauração e ensaio de 60 sessões. Permanecem as dependências operacionais, integrações finais e homologação formal explicitadas neste documento.

## Resultado executivo

Foi entregue um incremento amplo e persistente cobrindo o núcleo e as famílias das etapas 0–9, com cinco migrações aplicadas e build de produção aprovado. A entrega permite iniciar a validação pelas telas. **Não constitui homologação integral das etapas, da POC ou de todo o escopo de implantação.** Permanecem complementos funcionais detalhados, configurações e aceites específicos descritos abaixo; a existência de um módulo não comprova todos os seus subrequisitos.

## Implementação entregue

| Frente | Entrega de código |
|---|---|
| Base e administração | Matriz rastreável, migrações com checksum/lock, provisionamento Firebase, ficha funcional, perfis, inativação, vínculos secundários, organograma e administração restrita por subárvore |
| Núcleo documental | Numeração/códigos, editor, rascunhos, calendário/feriados, anexos privados, participação multissetorial, tramitação, conclusão/arquivamento/reabertura, notas e respostas separadas |
| Circulares e cidadão | População individual consistente, recibos imutáveis, conta externa/e-mail verificado, caixa pessoal, complementação, anexos liberados e consulta pública restrita |
| GED e documentos especiais | Modelos e importação DOCX, blocos formatados, variáveis, lease de edição, versões/originais, classificação hierárquica/em lote, etiquetas setoriais, parecer/ofício/intimação/pauta/atos e fila de assinatura |
| Workflow e atendimento | Campos condicionais/cálculos declarativos, etapas, SLA/feriados/diligências, processos, chamados, Ouvidoria inclusive entrada sem conta, e-SIC, RH, PAD, judicial e seletivo |
| Contatos e publicação | PF/PJ/organizações, CSV, unificação por referência, delegação/contrassenha, mandatos externos, Carta de Serviços e Diário informativo com composição e publicação imutáveis |
| Territorial | Projetos/licenciamento/fiscalização, PDF/DWG, medição gráfica de plantas, PDF derivado com desenhos/selo, GPS, GeoJSON/SHP/DBF/PRJ, reprojeção, camadas, filtros/proximidade/zonas, adaptadores cartográficos/geocodificação |
| Processamento | Fila persistente, leases/retries/idempotência, PDF, ZIP, executores PDF/A/OCR, arquivos privados, evidência veraPDF, índice textual, expiração e integração da tela dos módulos com a fila real |
| Gestão e operação | Relatórios CSV/PDF/XLSX, auditoria paginada, relatórios mensais idempotentes, EAD/avaliação/certificado, suporte/SLA, exportação, scripts de backup/monitoramento e manuais |
| Interface | Shell lateral recolhível para ícones, DataTable compartilhada de 20 registros, filtros/ordenação, ajuste de colunas, detalhes acessíveis, máscaras de CPF/CNPJ/CEP/telefone/moeda e linguagem operacional |

## Verificações executadas no fechamento

| Verificação | Resultado e alcance |
|---|---|
| Build de produção | Aprovado, com compilação, lint, tipos e geração de 50 páginas estáticas; última execução sem os avisos anteriores de CSS |
| Verificações HTTP | **39/39**: consultas centrais/módulos/relatórios/fila; sessão ausente; perfil sem permissão; Nível 3 bloqueado em receber/encaminhar/prazos; sigilo público; vínculo autodeclarado Gov.br e canais não configurados recusados |
| Domínio e formatos | **11/11**: identificadores fiscais, campos condicionais, geometria, medições, URLs, escopo/sigilo e integridade de CSV/PDF/XLSX/ZIP |
| Processamento real | PDF `2026111000001` e ZIP `2026111000002` concluídos pelo worker local; repetição idempotente; downloads autenticados e recusa anônima 401 |
| Grade em desktop | 20 linhas sem rolagem em **1280×720**, **1366×768** e **1920×1080**, com paginação visível após estabilização do redimensionamento |
| Comportamento da grade | Paginação 20/20/3; filtro sobre o conjunto; redimensionamento preservando largura total; detalhes sem scroll; Escape devolvendo foco; estado vazio |
| Dispositivo móvel | 390×844, com política de rolagem móvel reconhecida e região da tabela acessível |
| Preservação | 15 servidores, 5 documentos e 1 anexo original preservados; 5 setores originais preservados e Protocolo Geral acrescentado |
| Diff | Verificação aprovada considerando finais de linha CRLF do ambiente Windows |

As verificações HTTP são predominantemente leituras e recusas de ações; **não representam execução integral de todos os fluxos de gravação**. Os dados de 43 linhas utilizados na medição foram interceptados somente no navegador e não persistidos no banco. O ZIP real dessa rodada foi solicitado sem anexos selecionados: comprova fila, geração/manifesto, armazenamento e download, não uma exportação integral do acervo.

As duas solicitações de processamento são operações sobre documento existente, mantidas na fila com retenção/expiração normal; não alteraram seu conteúdo original. PDF com 44.298 bytes e ZIP com 1.593 bytes foram baixados e tiveram assinatura binária e SHA-256 conferidos. PDF/A e OCR não foram executados sem os conversores provisionados.

## Migrações e cadastros

Aplicadas: `0001_core.sql`, `002_modules.sql`, `003_operations.sql`, `004_jobs.sql`, `005_modules_completion.sql`. O executor confirmou os checksums das anteriores antes de aplicar 005.

Por autorização expressa do proprietário:

- Criado **Protocolo Geral**, vinculado à Secretaria Municipal de Administração, e definido como destino inicial do portal. Atribuir os servidores responsáveis ao setor pela Administração.
- Atualizadas duas contas antigas para **José Antunes — jose.antunes@aurora.mg.gov.br** e **Maria Goulart — maria.goulart@aurora.mg.gov.br**, no banco e Firebase. Preservados UID, senha, perfil, vínculos e histórico. Novos e-mails não foram declarados verificados automaticamente.
- **Infraestrutura de processamento adiada:** fila e executores entregues; host/conversores PDF/A/OCR serão definidos posteriormente.

## Pendências e limites do aceite

### Complementos funcionais do escopo detalhado

Complementos implementados nesta rodada: anexos/avaliação por chave na entrada anônima; listas segmentadas e campos de contatos por perfil nos canais interno/externo; unificação transacional de referências e vínculos legados explicitamente associados; expediente diário setorial; catálogo independente de cadernos/seções/subseções; árvore única de documentos/anexos; indicadores históricos, comparação setorial, páginas reais e relatórios prontos persistentes. Os relatórios e respectivos executores têm fechamento de aceites próprio em `FECHAMENTO_OPERACAO.md`.

Esses pontos não devem ser ocultados por uma marcação global de “etapas 0–9 100%”. A matriz de requisitos precisa de evidência individual para avançar de implementação para atendimento/homologação.

### Configuração e operação

- Bases/regras municipais e fornecedores cartográficos/geocodificação; medições e dados territoriais precisam de aceite sobre referência municipal válida.
- Worker permanente, conversores PDF/A/OCR, scheduler, canal de alertas e backup redundante. Exportação/restauração real em PostgreSQL local foi executada nesta rodada; falta restauração da aplicação com armazenamento isolado remapeado e rotina operacional provisionada. A infraestrutura do worker foi adiada pelo proprietário.
- Vídeos/conteúdo EAD, capacitação presencial, visitas, disponibilidade contínua e comprovação de capacidade para 60 usuários.
- Publicação SaaS existente em `rioazul.celeriflow.com.br`; os complementos posteriores à publicação inicial exigem o novo registro de deploy.
- Auditoria de dependências: o Next antigo e o sanitizador foram atualizados; não há declaração de árvore de dependências sem alertas. Restam avisos em dependências existentes e transitivas, alguns exigindo migrações maiores. Devem ser tratados antes do aceite de segurança da publicação.

### Etapas finais mantidas

Gov.br/ICP-Brasil/assinaturas/Tramita, transmissão/retorno real Sisobra, publicação certificada, Resend/canais e aplicativos continuam dependentes das etapas finais e respectivas credenciais/configurações. Registro de solicitação, hash ou publicação informativa não são assinatura nem transmissão governamental comprovada.

## Evidências locais

Diretório: `C:\Users\trici\AppData\Local\Temp\opencode`.

- `rio-final-readonly-results.json`: verificações HTTP.
- `rio-final-browser-results.json`: dez listagens em 1366×768 e observações da rodada visual.
- `rio-final-layout-results.json`: medições estabilizadas, paginação, filtros, redimensionamento, diálogo/foco e móvel. Este arquivo prevalece sobre a amostra transitória capturada imediatamente após um resize na rodada anterior.
- `rio-final-jobs-results.json`: processamento real, hashes e autorização dos downloads.
- `rio-preservation-results.json`: comparação dos registros originais e histórico das migrações.
- Screenshots `rio--*.png`, com dados internos; não publicados no repositório.

Roteiro para o proprietário: `ROTEIRO_VALIDACAO_ETAPAS_0_9.md`. Instalação: `IMPLANTACAO_ETAPAS_0_9.md`. Manual nas telas: `/ajuda`.
