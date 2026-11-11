# Plano de desenvolvimento — POC 100% e implantação integral

**Versão:** 10/11/2026.  
**Situação:** etapas 0–7 tecnicamente encerradas nos recortes documentados. Incremento funcional das etapas 8 e 9 concluído e validado internamente no recorte abaixo; aceite integral permanece aberto para Sisobra, bases municipais, infraestrutura permanente, dimensionamento do uso real e homologação formal.
**Base técnica:** `VALIDACAO_INTERNA_POC_2026-11-10.md`.

## 1. Diretrizes acordadas

1. Entregar **9/9 requisitos da POC**, com integrações reais e evidências. A margem de 70% do retificador não será usada como meta de desenvolvimento.
2. Corrigir primeiro a base auditada e tornar os fluxos inteiramente navegáveis pelas telas.
3. Antecipar funcionalidades da implantação, aproveitando o mesmo núcleo de permissões, documentos, processos e atendimento.
4. Deixar **Gov.br, e-CPF/ICP-Brasil e configuração/integração real do Resend para as etapas finais**. Preparar antes apenas os contratos internos necessários aos módulos.
5. Deixar o **desenvolvimento dos aplicativos para a última etapa**.
6. A POC só será considerada concluída após autenticação avançada real e envio/resposta de e-mail real. Enquanto essas etapas estiverem pendentes, registrar “núcleo validado; POC incompleta”.
7. Validar cada incremento internamente e, depois, entregar um roteiro curto para teste das telas pelo usuário.

### Dois marcos de entrega

- **Marco P — POC 100%:** nove cenários aprovados no SaaS publicado, com roteiro ao vivo de até duas horas. Não depende da conclusão dos módulos exclusivos da implantação nem dos aplicativos.
- **Marco I — Implantação 100%:** requisitos funcionais, técnicos e de serviços do contrato comprovados, incluindo os módulos adicionais, certificados, aplicativos, capacitação e operação.

O edital usa **Gov.br OU e-CPF** no cenário da POC. Nas especificações completas há exigências de Gov.br, acesso por e-CPF/e-CNPJ e assinaturas ICP-Brasil. A alternativa da POC não elimina essas obrigações da implantação. Autenticação, assinatura de documentos e Tramita GOV.BR são integrações distintas.

## 2. Fontes e achados que alteram o planejamento

Fontes verificadas:

- `PREGÃO 60-2026 1 PROTOCOLO ELETRÔNICO.pdf`: POC nas páginas 25–26; especificações funcionais/técnicas detalhadas na minuta contratual, páginas **31–91**; objeto e quadro da contratação na página 24.
- `03 TR.pdf`: especialmente itens **8.1–8.5**, **11.8**, **12.2.2** e obrigações de devolução dos dados.
- `edital retificado.docx`: 70% na avaliação da POC, 100% na implantação e qualificação técnica envolvendo GED com assinatura digital.

### Pontos importantes

- A implantação é significativamente maior que os nove testes da POC. Criar novos valores no enum de documentos não entrega, sozinho, os respectivos módulos.
- Há **aplicativo nativo de atendimento** e **aplicativo de fiscalização offline**, com instalação por Play Store e App Store (páginas 35–37). Uma interface web responsiva não comprova essa entrega.
- Os perfis completos incluem Administrador Geral, Administrador Local, Níveis 1/2/3 e atribuição de Auditor (página 33). A gestão global de usuários não deve ser confundida com leitura irrestrita de documentos; o texto descreve escopo setorial e acesso de Auditor.
- O núcleo deve suportar **vários setores simultâneos e resolução por setor** (páginas 66–67). Corrigir o “setor atual” apenas com um campo único não resolve o fluxo multissetorial exigido na implantação.
- O calendário mensal, a gestão de atividades e os dias úteis/feriados estão explicitados nas páginas 69–70.
- Há integrações adicionais: **Sisobra**, **Tramita GOV.BR**, **WhatsApp Business com IA**, SMS e serviços cartográficos. Elas precisam de entregas próprias.

### Prazos e operação previstos nos documentos

- POC: ambiente/apresentação em cinco dias úteis da convocação; duração máxima de duas horas.
- TR 8.1/8.2: ativação e credenciais administrativas em até cinco dias úteis da OS, por HTTPS.
- TR 8.3: parametrização/implantação em até **30 dias da liberação dos acessos**; treinamento presencial concluído dentro da implantação.
- TR 8.4: disponibilidade mensal mínima de **99,5%**, visita presencial mensal e solução de falhas por criticidade em **2h / 8h / 24h**.
- Páginas 84–85 do edital também descrevem suporte, primeiros retornos e disponibilização de funções em dois dias úteis após homologação do cronograma. Registrar os diferentes marcos e conciliar o cronograma contratual; não substituir o SLA de solução pelo prazo de retorno.
- Páginas 83–84: redundância em pelo menos três locais físicos distintos, informação das cópias e exportação dos dados/anexos no encerramento.

Estes são prazos contratuais, **não estimativas de esforço de programação**. O antigo plano de cinco dias não dimensiona o escopo integral agora identificado.

## 3. Sequência executiva

| Etapa | Entrega principal | Escopo | Dependências |
|---|---|---|---|
| 0 | Matriz de requisitos, ambiente e migrações | Comum | Auditoria existente |
| 1 | Usuários, perfis, organograma e autorização | POC + implantação | 0 |
| 2 | Documentos, anexos, prazos/calendário e tramitação | POC + implantação | 1 |
| 3 | Circulares e rastreabilidade | POC + implantação | 1–2 |
| 4 | Portal cidadão, protocolos internos e consulta segura | POC + implantação | 1–2 |
| 5 | Validação integrada do núcleo e experiência das telas | POC | 1–4 |
| 6 | GED avançado, modelos e módulos documentais adicionais | Implantação antecipada | 1–4 |
| 7 | Workflow configurável, serviços e atendimento ampliado | Implantação antecipada | 6 |
| 8 | Urbanismo, ambiente, fiscalização web e geoprocessamento | Implantação | 6–7 |
| 9 | Relatórios, EAD, suporte e operação SaaS | Implantação antecipada | Eventos de 1–8; execução incremental |
| 10 | Gov.br, certificados e assinaturas reais; Tramita GOV.BR | Integrações finais | Núcleo; credenciais/certificados |
| 11 | Resend real e conclusão dos canais externos | Integrações finais | Portal/processos; configuração pelo usuário |
| 12 | Homologação formal dos nove requisitos e apresentação | **Marco P** | 0–5 + recortes POC de 10–11 |
| 13 | Aplicativos Android/iOS e aceite integral da implantação | **Última etapa / Marco I** | APIs estáveis; todas as entregas de implantação |

**Caminho obrigatório da POC:** 0 → 1 → 2 → 3/4 → 5 → 10 (login real) → 11 (e-mail real) → 12.  
**Antecipação da implantação:** iniciar os incrementos 6–9 após estabilizar a base; sua conclusão integral não é uma dependência artificial do Marco P. As pendências desses incrementos continuam no compromisso do Marco I.

Cada etapa será desdobrada em incrementos pequenos com backend, interface, migração quando necessária e critérios de aceite. A ordem acima é de prioridade/dependência, não uma promessa de uma etapa por dia.

## 4. Etapas de desenvolvimento

### Etapa 0 — Organização e base de execução

- [x] Criar matriz rastreável: ID, fonte/página, texto do requisito, POC/implantação, entrega, dependências, status e evidência.
- [x] Desdobrar cada família do inventário da seção 5 nos itens detalhados das páginas de origem antes de implementar a família.
- [x] Manter estados distintos: planejado, implementado, testado internamente, validado em tela e homologado.
- [x] Separar dados de desenvolvimento, homologação e apresentação; preparar dados de ensaio reproduzíveis.
- [x] Adotar migrações versionadas e estratégia de recuperação para mudanças de schema.
- [x] Registrar URL SaaS, versões, configuração por ambiente e rotina de build/deploy.
- [x] Converter os defeitos F01–F12 da auditoria em tarefas reproduzíveis, com teste de regressão pertinente.

**Fechamento técnico em 10/11/2026:** [FECHAMENTO_ETAPA_0.md](FECHAMENTO_ETAPA_0.md), sete itens de preparação atendidos. Separação de dados comprovada em três bancos locais independentes; não representa três SaaS/Firebase/Blob provisionados nem homologação funcional. Migrações históricas preservadas. Índice individual e evidências com hashes acompanham o dossiê.

**Aceite:** ambiente reconstruível e todo requisito incluído no plano com origem e entrega responsável. Não executar limpeza de dados existentes como preparação padrão.

### Etapa 1 — Administração, perfis e organograma

- [x] Provisionar o novo servidor no Firebase e no banco pelo sistema, com definição/recuperação segura de credenciais e tratamento de falhas parciais.
- [x] Corrigir autorização no backend: Nível 3 não altera documento; usuário suspenso perde acesso; troca de perfil/setor passa a valer sem depender de token antigo privilegiado.
- [x] Aplicar autorização também em consultas, listas, busca, arquivos, prazos e movimentações.
- [x] Implementar árvore de setores/subsetores, cadastro/edição, vínculo principal e estrutura para vínculos secundários.
- [x] Preservar histórico ao suspender/transferir usuários; exigir realocação ao desativar setor.
- [x] Entregar primeiro Admin × Nível 3 para a POC; ampliar para Admin Local, Níveis 1/2 e Auditor na mesma estrutura de permissões.
- [x] Antecipar ficha funcional, preferências, afastamentos, último acesso e histórico cadastral.
- [x] Registrar ator, data/hora e contexto técnico das ações de administração e acesso.

**Fechamento técnico:** [FECHAMENTO_ETAPAS_1_2.md](FECHAMENTO_ETAPAS_1_2.md), itens 1.1–1.8 e evidências por cenário. Conferência humana/homologação e canais externos mantêm seus marcos próprios.

**Telas:** administração de servidores, perfis, organograma, conta e recuperação de acesso.  
**Aceite POC:** criar servidor e entrar com a nova conta; demonstrar permissões diferentes na interface e API. Nível 3 só vê o escopo autorizado.  
**Origem:** 16.3.2.1; páginas 31–34, 66–69; F01/F02.

### Etapa 2 — Núcleo documental, calendário e tramitação

- [x] Corrigir numeração por tipo/ano, inclusive virada de ano, concorrência e recuperação de erros.
- [x] Tornar criação, prazos e evento inicial consistentes; impedir documentos parcialmente criados.
- [x] Estabilizar editor, validação e sanitização de conteúdo; persistir e reabrir a formatação corretamente.
- [x] Implementar calendário mensal integrado aos documentos e lista de atividades/prazos, com vencimento, conclusão e histórico de alteração.
- [x] Implementar recebimento, despacho, resposta, conclusão, arquivamento e reabertura com transições válidas e permissões específicas.
- [x] Modelar participação/estado por setor, preservando origem e destino de cada movimento e preparando cópia para múltiplos setores.
- [x] Corrigir download autenticado por clique; manter arquivos privados, verificar autorização por documento e registrar downloads.
- [x] Implantar filtros, paginação, busca por número/assunto/setor e timeline determinística.

**Fechamento técnico:** [FECHAMENTO_ETAPAS_1_2.md](FECHAMENTO_ETAPAS_1_2.md), itens 2.1–2.8, verificações de API e navegador, preservação de dados e roteiro do proprietário.

**Telas:** caixa do setor, novo documento, detalhe/timeline, calendário e anexos.  
**Aceite POC:** dois memorandos sequenciais, pelo menos dois prazos visíveis no calendário e fluxo A → B → C com ator/setores/horários corretos; anexos abrem pela tela.  
**Origem:** 16.3.3.1/2; páginas 52, 66–72, 77; F06/F11/F12.

### Etapa 3 — Circulares

- [x] Unificar a contagem de destinatários individuais em lista, detalhe e filtros.
- [x] Restringir a leitura ao contexto autorizado e registrar recibos apenas para destinatários pertinentes.
- [x] Preservar primeira leitura por usuário com proteção contra duplicidade e concorrência.
- [x] Selecionar vários setores/subsetores no organograma e tratar alterações posteriores de destinatários.
- [x] Demonstrar “Urgente” e “Meramente Informativa”.
- [x] Antecipar respostas abertas/restritas, anexos, atividades, arquivamento e regra de circular informativa sem resposta/encaminhamento.

**Fechamento técnico em 10/11/2026:** [FECHAMENTO_ETAPAS_3_4.md](FECHAMENTO_ETAPAS_3_4.md), 6/6 itens; 156/156 verificações da suíte comum local e 156/156 no SaaS HTTPS. Respostas restritas protegidas nos dois detalhes; edição de destinatários e primeira leitura concorrente comprovadas. Homologação municipal e critérios posteriores de automação/notificações mantêm aceites próprios.

**Aceite POC:** circular enviada a dois subsetores, acessada por servidores diferentes; data/hora individual automática e invariável; contagens idênticas em todas as telas.  
**Origem:** 16.3.3.3; página 45; F07.

### Etapa 4 — Cidadão, atendimento interno e sigilo

- [x] Validar CPF/CNPJ, evitar cadastros duplicados e atualizar dados sob regras claras de titularidade.
- [x] Manter ViaCEP com indicação de erro/indisponibilidade e confirmação dos dados preenchidos.
- [x] Conectar o protocolo externo à caixa interna do setor responsável, com acesso navegável por número.
- [x] Associar assunto, responsável e histórico; distinguir resposta ao cidadão de nota interna.
- [x] Aplicar uma política comum de sigilo a `/publico` e `/cidadao`; respeitar classificação e autorização de cada campo/anexo.
- [x] Corrigir máscara de CNPJ e impedir exposição de identificadores em textos públicos derivados de conteúdo interno.
- [x] Entregar consulta por chave e QR com URL pública correta, inclusive pelo celular.
- [x] Antecipar conta externa, caixa pessoal, anexos autorizados, acompanhamento e complementação de requerimento.
- [x] Preparar eventos internos de notificação e estados verdadeiros de envio; configurar Resend apenas na etapa 11.

**Fechamento técnico em 10/11/2026:** [FECHAMENTO_ETAPAS_3_4.md](FECHAMENTO_ETAPAS_3_4.md), 9/9 itens; suíte comum de 156/156 local e 156/156 HTTPS, mais 119/119 de regressão das etapas 1/2. Protocolo navegável pelo número, responsável, política de sigilo comum, conta/anexos/complementação e QR mobile publicados. Eventos preparados com envio `PENDING`; entrega real de e-mail permanece na etapa 11. Dados originais preservados; homologação humana pendente.

**Aceite POC:** cidadão cadastra, busca CEP e abre requerimento; servidor o encontra sem conhecer UUID; chave/QR exibem somente dados liberados.  
**Origem:** 16.3.2.3, 16.3.4.1/3; páginas 34–35, 60–63, 78–80; F04/F05/F08/F12.

### Etapa 5 — Integração das telas e validação do núcleo

- [x] Padronizar mensagens, carregamento, erros, validação de formulários e prevenção de submissão duplicada.
- [x] Revisar navegação e ações exibidas por perfil; garantir que todo fluxo interno tenha entrada pela interface.
- [x] Testar permissões, concorrência de numeração, tramitação, leitura, sigilo e recuperação de falhas.
- [x] Executar roteiro Admin → Nível 3 → memorando → circular → cidadão → consulta pública no ambiente publicado.
- [x] Entregar ao usuário roteiro de testes e registrar defeitos encontrados nas telas.
- [x] Atualizar documentação e remover indicação de identidade “verificada” quando não houver autenticação externa real.

**Fechamento técnico em 10/11/2026:** [FECHAMENTO_ETAPAS_5_7.md](FECHAMENTO_ETAPAS_5_7.md), 6/6 itens. Na versão HTTPS final, 119/119 verificações do núcleo, 158/158 de circulares/cidadão e 533/533 de integração/workflow: **810/810**, incluindo Chrome, downloads autenticados e QR móvel. Identidade avançada e e-mail real continuam nos marcos finais; homologação humana pendente.

**Aceite:** os sete subitens que não dependem de login avançado/e-mail passam; os outros dois continuam explicitamente pendentes. Esta etapa não libera a POC 100%.

### Etapa 6 — GED avançado e módulos documentais antecipados

- [x] Ampliar editor: tabelas, imagens, links, tela cheia, modelos e variáveis; rascunho automático e controle de edição concorrente.
- [x] Gerar PDF/PDF-A, folha de rosto e pré-visualização; preservar versões/originais e preparar documento imutável para assinatura.
- [x] Implementar parecer técnico/jurídico vinculado a outro processo, com numeração e anexos.
- [x] Completar ofício eletrônico: contatos, destinatários externos, resposta, histórico e QR; entrega por e-mail fecha na etapa 11.
- [x] Implementar intimação e pauta de reunião, previstas no objeto. Detalhar seus fluxos com a Administração: destinatário/ciência/prazo e reunião/itens/participantes, respectivamente, como desenho funcional a validar.
- [x] Implementar atos oficiais e vínculo entre documentos, com tipos/modelos e permissões próprias.
- [x] Preparar fila de assinatura, assinantes, ordem, recusa/cancelamento e estados; execução criptográfica real fecha na etapa 10.
- [x] Implementar etiquetas, plano de classificação em quatro níveis, importação/reclassificação e busca.
- [x] Preparar processamento assíncrono para OCR, PDFs compilados, exportações e assinaturas em lote.

**Fechamento técnico em 10/11/2026:** [FECHAMENTO_ETAPA_6.md](FECHAMENTO_ETAPA_6.md), **9/9 itens no recorte documentado**. Aceitação local **196/196** e HTTPS **196/196**, incluindo editor/concorrência/DOCX, módulos próprios, fila de assinaturas e quatro trabalhos reais PDF/ZIP/PDF-A/OCR. PDF/A-2b aprovado pelo veraPDF (144 regras, zero falhas); OCR reconheceu PDF sem texto incorporado. Regressões locais: workflow 533/533, contatos 86/86 e domínio 54/54. Migração 012 protege o envelope de assinatura; originais/fingerprints preservados. Worker permanente/infraestrutura seguem na etapa 9, criptografia na 10, entrega por canais na 11. Homologação municipal e desenho definitivo de intimação/reunião pendentes.

**Aceite:** cada módulo possui fluxo funcional próprio, não apenas um tipo selecionável; documentos vinculados e versões permanecem rastreáveis. Itens que dependem de assinatura/envio mantêm pendência explícita até as etapas finais.  
**Origem:** objeto página 24; páginas 41–42, 52–55, 71–78, 85.

### Etapa 7 — Workflow, atendimento ampliado e publicação

- [x] Configurar assuntos, campos condicionais, anexos obrigatórios, roteamento e etapas sem salto indevido.
- [x] Implementar processo administrativo multissetorial, prazos/SLA por etapa e decisão deferido/indeferido.
- [x] Gerar árvore processual em PDF e anexos em ZIP, com versões completa/personalizada, paginação e processamento assíncrono.
- [x] Entregar chamados técnicos, Ouvidoria (identificada/sigilosa/anônima), e-SIC e requerimentos pessoais restritos ao RH.
- [x] Entregar PAD, processos judiciais e processo seletivo simplificado com seus campos, busca, prazos e exportações.
- [x] Implementar contatos PF/PJ, organizações, importação/exportação, unificação e procuração eletrônica.
- [x] Implementar contrassenha/delegação: autorização explícita, limite de uso, cancelamento, identificação de autorizador/digitador e relatório de documentos emitidos.
- [x] Entregar Carta de Serviços com filtros, descrições completas, canais, prazos e conexão com os assuntos do protocolo; preparar busca semântica.
- [x] Implementar Diário Oficial: atos, cadernos/seções, edições ordinárias/extraordinárias, calendário, busca e publicação imutável. Assinatura de edição fecha na etapa 10.
- [x] Ampliar central externa: autenticação comum, caixa pessoal, representantes, avaliação do atendimento e dados públicos autorizados.

**Fechamento técnico em 10/11/2026:** [FECHAMENTO_ETAPAS_5_7.md](FECHAMENTO_ETAPAS_5_7.md), 10/10 itens no recorte funcional desta etapa; **533/533 verificações HTTPS** da suíte integrada e 86/86 da suíte local de contatos. Quatro trabalhos PDF/ZIP completos/personalizados executados de fato, com paginação, hashes e originais conferidos. Busca semântica preparada por vocabulário local; procuração de acesso por mandato; Diário informativo imutável. Worker permanente depende da infraestrutura/etapa 9; assinatura de instrumento/edição certificada, da etapa 10. Recursos avançados de formulários mantêm controle individual na implantação, conforme dossiê. Homologação municipal pendente.

**Aceite:** um processo configurado percorre todas as etapas com documentos, prazos e decisões; Ouvidoria preserva identidade conforme modalidade; edição publicada permanece íntegra. Publicação certificada só conclui após assinatura real.  
**Origem:** páginas 42–63, 76–80, 85–87.

### Etapa 8 — Urbanismo, fiscalização e geoprocessamento

- [x] Aprovação de projetos: construção/parcelamento, participantes, arquivos PDF/DWG, revisão, aceitação/recusa, anotações e selos textuais; assinatura criptográfica na etapa 10.
- [x] Implementar medições em plantas PDF, escalas, áreas/distâncias e cálculo de parâmetros urbanísticos.
- [x] Implementar licenciamento ambiental, fiscalização de obras/posturas e conexão com denúncias/protocolos.
- [x] Criar formulários e API de fiscalização, anexos, GPS e IDs/idempotência para sincronização futura do aplicativo offline.
- [x] Entregar mapa de viabilidade e recursos geoespaciais previstos no bloco “1Map”: camadas GeoJSON/SHP, filtros, proximidade, publicação autorizada e geoportal.
- [ ] Integrar Sisobra para alvarás/Habite-se: envio, retorno, retificação, cancelamento/reativação e histórico; concluir autenticação/assinatura dependente de certificado na etapa 10.
- [ ] Cadastrar legislação, zoneamento e bases fornecidas pelo Município, com controle de versão.

**Incremento técnico:** [FECHAMENTO_ETAPAS_8_9.md](FECHAMENTO_ETAPAS_8_9.md). Cinco itens funcionais encerrados; cadastro/versionamento de legislação e camadas implementado, com fornecimento/conferência municipal pendentes. Sisobra conserva somente pedidos de intenção e histórico aguardando configuração; serialização XSD, assinatura/transmissão e retorno real ainda dependem da integração final, sem recibo fictício. Aceite local: **187/187**, incluindo SHP/PRJ/DBF real, revisão legal, medições contra PDF original, vistorias concorrentes e conferência visual de mapa/gráfico. Homologação humana pendente.

**Aceite:** processo territorial completo testado com base municipal validada e retorno real das integrações aplicáveis. O backend de fiscalização deve operar antes do desenvolvimento móvel.  
**Origem:** páginas 37–41, 45–46, 50–52, 63–66.

### Etapa 9 — Gestão, capacitação e operação SaaS

- [x] Relatórios de volumetria, produtividade, eficiência, qualidade, leitura, assiduidade, acessos, consumo, auditoria e georreferenciamento, no recorte reconciliado com SQL.
- [x] Painéis filtráveis por período/setor/usuário/módulo; exportações CSV, PDF, XLSX e gráficos conforme o requisito; geração assíncrona quando necessária.
- [x] Relatórios automatizáveis para acompanhamento contratual e faturamento (TR 11.8); executores/idempotência entregues, agendamento permanente e regra contratual dependem da operação/parametrização.
- [x] EAD integrado: vídeos por módulo, ordem das aulas, progresso, avaliação, nota e certificado PDF; conteúdo institucional e treinamento humano pendentes.
- [x] Central de ajuda e suporte: chamados/chat, responsáveis, escalonamento, histórico, avaliação e acompanhamento dos SLAs.
- [ ] HTTPS, observabilidade, alertas, trilhas de auditoria, backup automatizado e ensaio de restauração de banco e arquivos.
- [ ] Comprovar armazenamento redundante nos locais exigidos; verificar limites reais dos planos contratados de Neon/Blob e complementar a arquitetura quando necessário.
- [x] Exportação integral em formatos abertos com anexos originais e rotina de encerramento contratual.
- [x] Preparar manuais, capacitação presencial por perfil, certificados, agenda de visita mensal e procedimento de manutenção com aviso prévio; execução/agenda municipal ainda pendentes.
- [ ] Validar capacidade para os 60 usuários previstos no quadro e dimensionar carga com o uso municipal; cadastro de 60 usuários não equivale a teste de 60 simultâneos.

**Incremento técnico:** relatórios **92/92**, EAD/suporte **101/101**, restauração da aplicação com banco/arquivos isolados **12/12**. Carga local sustentada com **60 identidades distintas**, lotes de 60 leituras concorrentes, **3.180/3.180** respostas aprovadas em 61.169 ms (53 rodadas, p95 1.015 ms); o dimensionamento da mistura real municipal permanece aberto. Item de continuidade tem HTTPS, auditoria, executores de monitoramento/backup e restauração exercitada; monitoramento/agendamento permanente e redundância contratada continuam pendentes, conforme infraestrutura adiada. Dossiê: [FECHAMENTO_ETAPAS_8_9.md](FECHAMENTO_ETAPAS_8_9.md). Os três itens operacionais abertos não são convertidos em aceite por este ensaio.

**Aceite:** relatórios conferem com os dados de origem, restauração e exportação são demonstradas e materiais/rotinas operacionais estão disponíveis. SLA de disponibilidade exige medição contínua, não apenas declaração.

### Etapa 10 — Integrações finais: identidade, certificados e assinatura

**10A — Requisito da POC:**

- [ ] Implementar Gov.br OIDC completo: descoberta, autorização, estado/nonce/PKCE conforme provedor, troca de código, validação de tokens, vínculo confiável e sessão interna.
- [ ] Implementar acesso e-CPF como alternativa prevista na POC, com comprovação criptográfica e validação de cadeia/validade/revogação.
- [ ] Testar sucesso, cancelamento, erro e tentativa de vínculo não autenticado; remover o caminho simulado da demonstração oficial.
- [ ] Comprovar pelo menos uma das alternativas reais para fechar 16.3.2.2.

**10B — Complementos obrigatórios da implantação:**

- [ ] Completar acesso externo Gov.br/e-CPF/e-CNPJ e regras de identificação por assunto.
- [ ] Entregar segundo fator previsto no acesso interno e mecanismos adicionais dos signatários.
- [ ] Implementar assinatura avançada descrita nas especificações e qualificada ICP-Brasil; certificados A1/A3, X509/PAdES/PDF-A, validação, coassinatura e preservação das assinaturas existentes.
- [ ] Concluir assinatura individual, em lote, sequencial/simultânea, externa e verificador público com metadados técnicos.
- [ ] Concluir assinatura e-CNPJ de edições do Diário Oficial e demais operações dependentes de certificado, inclusive Sisobra.
- [ ] Tratar integração com assinador Gov.br separadamente do login, conforme credenciamento/homologação aplicável.
- [ ] Integrar **Tramita GOV.BR**: adesão, homologação de envio/recebimento/recusa, documentos assinados, NRE/IDT e recibos.

**Dependências:** credenciais de homologação/produção, URLs autorizadas, certificados e dispositivos de ensaio, definição do serviço/assinador e acesso às integrações governamentais.  
**Aceite:** login real cria sessão; assinaturas verificáveis preservam conteúdo; integrações de implantação comprovadas individualmente. Um selo visual, hash isolado ou registro na timeline não é evidência suficiente de assinatura digital.

### Etapa 11 — Integrações finais: Resend e canais externos

**Configuração pelo usuário:** conta/API Resend, remetente/domínio verificado, DNS de envio, domínio/subdomínio de recebimento/MX, webhook HTTPS e caixa postal de ensaio controlada. Usar subdomínio de recebimento quando apropriado para preservar o e-mail institucional existente.

**11A — Requisito da POC:**

- [ ] Validar configuração e implementar envio com retorno `data/error`, ID do provedor e estados corretos.
- [ ] Gerar Reply-To tokenizado em endereço válido e associar a mensagem ao processo.
- [ ] Adaptar o evento `email.received`, verificar assinatura/autenticidade do webhook e recuperar corpo/anexos pela API do provedor.
- [ ] Extrair texto/HTML, preservar mensagem integral e anexar resposta automaticamente como despacho.
- [ ] Garantir idempotência, repetição segura, consistência da persistência e recuperação de falhas.
- [ ] Exibir fila/status de mensagens, falhas, reprocessamento e conteúdo completo ao servidor autorizado.
- [ ] Enviar mensagem real e responder pelo provedor do cidadão; demonstrar despacho sem intervenção manual.

**11B — Implantação:**

- [ ] Expandir notificações para novos trâmites, ofícios, assinaturas, recusa de anexos e conclusões, respeitando preferências.
- [ ] Rastrear entrega, abertura e clique quando o provedor disponibilizar os eventos; distinguir aceite do provedor de entrega na caixa.
- [ ] Implementar integração de e-mail setorial da Ouvidoria.
- [ ] Concluir SMS nos módulos exigidos e WhatsApp Business/IA ligado à Carta de Serviços: áudio, histórico, janela de atendimento, métricas e relatórios de lacunas da base.

**Aceite:** ciclo real de notificação/resposta reproduzível, sem falso `SENT`, sem duplicidade e sem perda de texto/anexo. Configuração do Resend e implementações desta etapa ficam para o final conforme solicitado.

### Etapa 12 — Homologação POC 100%

- [ ] Executar a matriz da seção 6 no mesmo ambiente SaaS da apresentação.
- [ ] Realizar teste interno seguido do teste das telas pelo usuário.
- [ ] Corrigir e retestar falhas dos cenários afetados.
- [ ] Preparar contas/servidores/setores/subsetores, documentos e caixa postal de ensaio.
- [ ] Ensaiar os nove requisitos em até duas horas, incluindo leitura por usuários distintos e consulta fora da rede local.
- [ ] Registrar versão, evidência e resultado de cada subitem; atualizar roteiro e matriz anteriores.

**Aceite / Marco P:** nove subitens aprovados; nenhuma pendência de login avançado, e-mail real, permissões ou sigilo. Módulos exclusivos da implantação possuem acompanhamento próprio e não entram na pontuação dos nove subitens.

### Etapa 13 — Última etapa: aplicativos e fechamento da implantação

**13A — Aplicativo de atendimento Android/iOS:**

- [ ] Implementação nativa/multiplataforma com publicação nas lojas oficiais; selecionar tecnologia móvel nesta etapa, reutilizando as APIs existentes.
- [ ] Identidade visual, localização/seleção da Administração, login comum/Gov.br e manutenção segura da sessão.
- [ ] Cadastro, assuntos/serviços, campos/anexos obrigatórios, novo protocolo e identificação do setor receptor.
- [ ] Caixa de documentos abertos/arquivados, acompanhamento, resposta, anexos, conta e organograma/contatos.
- [ ] Mesmas permissões, sigilo, regras e dados do portal web; notificações pelos canais especificados.

**13B — Aplicativo de fiscalização offline Android/iOS:**

- [ ] Login do fiscal, formulários/checklists, identificação do objeto, GPS e localização textual.
- [ ] Fotos/PDF, legendas/marcações, observações e rascunhos locais.
- [ ] Operação offline, armazenamento protegido, recuperação após fechamento e fila de sincronização.
- [ ] Sincronização imediata/posterior, tratamento de conflito, repetição sem duplicação e status pendente/sincronizado.
- [ ] Vinculação da fiscalização sincronizada ao processo na plataforma web.

**13C — Aceite integral:**

- [ ] Publicar e testar instalação real em Android e iOS, incluindo cenário sem conexão para fiscalização.
- [ ] Concluir toda a matriz de implantação, incluindo dependências que ficaram pendentes dos incrementos 6–11.
- [ ] Parametrizar o organograma municipal, cadastrar usuários e executar treinamento presencial e entrega do EAD.
- [ ] Entregar documentação, evidências de operação, relatórios, suporte, exportação e plano de continuidade.

**Aceite / Marco I:** todos os requisitos aplicáveis comprovados, aplicativos disponíveis nas lojas e operação municipal habilitada. “Última etapa” define ordem de desenvolvimento, não dispensa os aplicativos do prazo de implantação.

## 5. Inventário de implantação fora dos nove testes da POC

Este inventário agrupa requisitos para planejamento. O aceite de cada família exige desdobrar e conferir **todos os itens de suas páginas de origem**, inclusive formatos, filtros, permissões e relatórios; não basta entregar o título do módulo.

| Família | Fonte no edital/TR | Etapas |
|---|---|---|
| Perfis completos, acesso setorial, suspensão, recuperação, cadastro funcional, preferências e afastamentos | pp. 31–34 | 1; identidade avançada em 10 |
| Organograma, vínculos secundários, caixas pessoal/setorial e demandas multissetoriais | pp. 66–69 | 1–2, 7 |
| Conta externa, contatos PF/PJ, organizações, representantes/procuração | pp. 34–35, 77–80 | 4, 7, 10 |
| Editor avançado, rascunhos, variáveis, modelos, referências e menções | pp. 71–72 | 6 |
| Prazos/atividades, calendário mensal, dias úteis/feriados e horário de funcionamento | pp. 69–70 | 2, 7 |
| Circulares completas e memorandos privados/modelos/PDF | pp. 45, 52 | 2–3, 6 |
| Ofício completo, pareceres técnicos/jurídicos | pp. 52–55 | 6, 10–11 |
| Intimação e pauta de reunião | Objeto, p. 24 | 6; especificação funcional com Município |
| Assinatura individual/em lote, avançada/qualificada, coassinatura e verificador | pp. 41, 72–76 | Preparação em 6; entrega real em 10 |
| Atos oficiais | pp. 41–42 | 6, 10 |
| Carta de Serviços e busca semântica | pp. 42–44 | 7, 11 |
| Chamados técnicos | pp. 44–45 | 7 |
| Ouvidoria com sigilo/anonimato, e-mail setorial, geolocalização e avaliação | pp. 53–55 | 7–8, 11 |
| e-SIC/LAI e indicadores públicos | p. 55; pp. 69–70 | 7, 9 |
| Processo administrativo/workflow, árvore PDF, anexos ZIP e decisões | pp. 55–58 | 6–7 |
| PAD, processo judicial com OCR e processo seletivo | pp. 58–60 | 6–7 |
| Protocolo completo e requerimento pessoal/RH | pp. 60–63 | 4, 7, 10–11 |
| Projetos de construção/solo, revisão e medições PDF, documentos PDF/DWG | pp. 37–40 | 8, 10 |
| Sisobra, alvarás/Habite-se e ciclo de transmissão | pp. 40–41 | 8, 10 |
| Consulta de viabilidade, mapas municipais, camadas e recursos “1Map” | pp. 45–46, 63–66 | 8 |
| Fiscalização de obras/posturas e licenciamento ambiental | pp. 50–52 | 8; aplicativo em 13 |
| Diário Oficial, edições, publicação imutável e e-CNPJ | pp. 46–50 | 7, 10 |
| Notificações internas/e-mail/SMS, preferências e rastreamento | pp. 67–69 | Eventos em 2–4; canais em 11 |
| Chat IA/WhatsApp Business, áudio, auditoria e métricas | pp. 63–64 | 7, 11 |
| Busca avançada/OCR, etiquetas e classificação documental | pp. 70–71, 76–77, 85 | 6 |
| Contrassenha/delegação com limite de uso e auditoria | p. 76 | 6–7 |
| Arquivos privados, links temporários, miniaturas/galeria e downloads | p. 77 | 2, 6 |
| Personalização e Central de Atendimento | pp. 78–80 | 4, 7 |
| EAD, avaliação, progresso e certificados | pp. 80–81 | 9 |
| Relatórios gerenciais/auditoria/consumo/mapas e painéis CSV/XLSX/PDF | pp. 80–83, 88–91; TR 11.8 | 9 |
| Formulários gerais/específicos, condições e cálculos | pp. 86–87; pp. 37–38, 56 | 7–8 |
| Tramita GOV.BR: envio, recebimento, recusa, recibos NRE/IDT | pp. 87–88 | 10 |
| Aplicativo de atendimento nativo Android/iOS | pp. 35–36 | 13A |
| Aplicativo de fiscalização offline Android/iOS | pp. 36–37 | 13B |
| Backup/redundância, exportação/encerramento, disponibilidade e suporte | pp. 83–85; TR 8.4–8.5 e obrigações | 9, 13C |
| Parametrização, treinamento presencial, manuais e visitas mensais | TR 8.1–8.4 | Preparação em 9; conclusão em 13C |

## 6. Matriz de aceite POC — meta 9/9

| Item | Demonstração obrigatória | Etapas | Evidência de aceite |
|---|---|---|---|
| 16.3.2.1 | Criar servidor; Admin × Nível 3 | 1, 5 | Nova conta utilizável; visualização autorizada; tentativas de alteração bloqueadas |
| 16.3.2.2 | Login Gov.br ou e-CPF | 10A | Autenticação no provedor/certificado real e sessão na aplicação |
| 16.3.2.3 | CPF/CNPJ mascarados | 4, 5 | Dados críticos ausentes das respostas públicas e das telas |
| 16.3.3.1 | Editor, múltiplos prazos em calendário, sequência | 2, 5 | Formatação persistida, prazos no calendário e números automáticos distintos |
| 16.3.3.2 | Despacho entre setores e timeline | 2, 5 | Movimentações com origem/destino, ator e ordem cronológica corretos |
| 16.3.3.3 | Circular a múltiplos subsetores e leitura automática | 3, 5 | Data/hora por servidor, primeira leitura preservada e contagens consistentes |
| 16.3.4.1 | Cadastro externo, CEP, requerimento | 4, 5 | CEP real, protocolo persistido e acessível ao atendimento interno |
| 16.3.4.2 | Notificação e captura automática da resposta | 11A | Mensagem recebida em caixa real; resposta no provedor incorporada como despacho |
| 16.3.4.3 | QR ou chave com sigilo | 4, 5, 12 | Consulta externa funcional, com conteúdo autorizado e sigilo preservado |

Todos os nove itens devem terminar com versão, data, responsável pelo teste e evidência. O resultado parcial de uma API não comprova sozinho o fluxo de apresentação.

## 7. Decisões técnicas para evitar retrabalho

- Manter Next.js/React, Drizzle/Neon, Firebase e Blob como base; avaliar serviços adicionais em função de requisitos concretos.
- Extrair regras compartilhadas das rotas para serviços de autorização, documentos, tramitação, prazos, publicação e notificações, reutilizáveis pelos módulos e aplicativos.
- Evoluir schema com entidades de participação por setor, estado setorial, assuntos, formulários/versionamento, instâncias/etapas de workflow, versões documentais, assinaturas, eventos de notificação e tarefas assíncronas.
- Usar transação/consistência adequada ao driver de banco e idempotência para operações compostas. Não presumir que várias gravações HTTP independentes sejam uma transação.
- Adotar processamento assíncrono durável para OCR, exportação PDF/ZIP, assinatura em lote, e-mails e sincronizações. Definir serviço e limites antes de implementar esses fluxos; não depender de uma requisição longa do navegador.
- Manter separadas consulta pública, acesso do requerente e acesso interno, todos sob uma mesma política de publicação/autorização.
- Projetar APIs e IDs de sincronização para o móvel; implementar os clientes móveis apenas na etapa 13.
- Tratar assinatura criptográfica, geração de PDF e autenticação como serviços separados. A decisão de biblioteca/provedor depende das exigências A1/A3, PAdES, PDF/A e validação externa.

## 8. Dependências e responsabilidades

| Dependência | Responsável principal | Quando necessária |
|---|---|---|
| Desenvolvimento, migrações, testes internos e roteiro por incremento | Desenvolvimento | Todas as etapas |
| Teste das telas e validação da experiência | Usuário | Após cada incremento funcional |
| Cadastro/configuração Resend, domínio/DNS e caixa postal | Usuário, com integração pelo desenvolvimento | Etapa 11 |
| Credenciais Gov.br, certificados e acessos governamentais | Titulares/órgão responsável, com integração pelo desenvolvimento | Etapa 10 |
| Organograma, usuários, regras de assunto, modelos e fluxos | Município/usuário responsável | Parametrização das etapas 1, 6–8 |
| Legislação urbanística, mapas e bases cartográficas | Município | Etapa 8 |
| WhatsApp Business/Meta, SMS e serviços externos | Titulares das contas, com integração pelo desenvolvimento | Etapa 11 |
| Contas Apple/Google, identidade visual e dispositivos de teste | Titulares das contas e desenvolvimento | Preparação da etapa 13 |
| Conteúdo EAD, agenda de treinamento e equipe de suporte | Responsáveis pela implantação | Etapas 9 e 13C |

Credenciamento e publicação em lojas possuem prazos externos. Identificar os responsáveis e requisitos dessas dependências durante o planejamento; sua implementação permanece nas etapas finais solicitadas.

## 9. Primeiro pacote para execução

Começar pelas etapas 0 e 1, com uma entrega verificável:

1. Provisionamento de servidor utilizável pela tela.
2. Bloqueio efetivo de alteração pelo Nível 3 e de acesso por usuário suspenso.
3. Autorização por setor/documento e organograma com subsetores.
4. Correção prioritária das duas consultas públicas e da máscara de CNPJ, antecipando a parte crítica da etapa 4.
5. Testes internos e roteiro de validação dessas telas.

**Condição de conclusão deste pacote:** resolver F01/F02/F04/F05 sem regressão de autenticação, consulta ou persistência. Gov.br, e-CPF, Resend real e aplicativos permanecem nas etapas finais definidas.
