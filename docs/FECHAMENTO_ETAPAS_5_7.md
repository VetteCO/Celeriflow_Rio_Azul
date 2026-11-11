# Integração do núcleo e workflow — etapas 5 e 7

Data: 10/11/2026 (horário de Brasília; parte das evidências UTC está datada de 11/11). **Etapa 5: 6/6; etapa 7: 10/10 itens técnicos no recorte funcional documentado**, implementados, publicados e validados internamente. Homologação humana e dependências finais de implantação mantêm seus marcos próprios.

## Publicação e verificação final

- SaaS: https://rioazul.celeriflow.com.br
- Deployment: `dpl_65BvRYJyfBwKhaSKPiEkuUQhgBxS`, **READY**, alias confirmado pela CLI Vercel.
- URL da versão: https://celeriflow-rio-azul-2xc8ht2ga-celeriflow-hub.vercel.app
- Código funcional: `9db8323`, sucedendo o incremento `a758bdc`.
- **810/810 verificações HTTPS** na versão final: 533 integração/workflow, 119 núcleo e 158 circulares/cidadão.
- **533/533** na rodada local de workflow; **86/86** na suíte local complementar de contatos; **158/158** locais de circulares/cidadão após a correção final de streaming; **34/34** testes de domínio. As rodadas têm escopos próprios e não representam 810 requisitos contratuais distintos.
- Build, lint e tipos aprovados localmente e no build remoto. Nenhuma migração nova neste incremento; checagem somente leitura: 11 checksums históricos válidos, sem pendências.
- Saúde pública `ok`; conferência autenticada confirmou os mesmos **15 servidores e seis setores** entre SaaS e banco configurado. Cinco documentos e um anexo original preservados por fingerprint/bytes; os três documentos que aparecem para o administrador são seu escopo autorizado, não a contagem global.
- Consulta de logs da versão final retornou **zero erros** no intervalo de 23:42:43 UTC de 10/11 a 00:12:43 UTC de 11/11. É observação pontual, não medição de SLA contínuo.
- Sincronização GitHub permanece sem confirmação por credencial indisponível no ambiente não interativo. Histórico local e bundle completo preservam os commits; o deployment foi realizado pela CLI autenticada da Vercel.

### Rodadas e artefatos

Diretórios no temporário privado aprovado; somente inventário e hashes sanitizados são versionados em `EVIDENCIAS_ETAPAS_5_7.json`.

| Rodada | Ambiente/escopo | Resultado |
|---|---|---|
| `stages57-1794353533592` | Local, integração e workflow | 533/533 |
| `contacts-4cef4a26-4bd4-4f43-a354-ecd36db11964` | Local, contatos | 86/86 e limpeza confirmada |
| `stages12-1794354987627` | Local, circulares/cidadão com três downloads sucessivos | 158/158 |
| `stages57-1794355392692` | HTTPS final, integração/workflow e processamento real direcionado | 533/533 |
| `stages12-1794355794981` | HTTPS final, núcleo/Admin/Nível 3/editor/calendário/tramitação | 119/119 |
| `stages12-1794355206272` | HTTPS final, circulares/cidadão/CEP/QR móvel/downloads | 158/158 |

Cada rodada de escrita manteve snapshot/manifesto privado e limpeza por IDs próprios, com auditoria preservada. Os PDFs/ZIPs gerados foram baixados e preservados privadamente antes da remoção dos trabalhos e artefatos temporários. Os sete fingerprints originais e o SHA-256 dos bytes do anexo foram reconferidos após a limpeza.

**Histórico de defeitos/rodadas não finais:** `stages57-1794352808000` encontrou expectativa antiga de 403 onde a política vigente retorna 404 e um seletor exato incompatível com o nome acessível do filtro. Ambos os ajustes eram do roteiro; a rodada seguinte passou em 525/525, depois ampliada para 533/533 com a recusa exclusiva do assinante pendente. A rodada `stages12-1794354375471` foi recusada antes dos cenários por ausência do opt-in `--allow-production`. A rodada HTTPS `stages12-1794354542077` encontrou erro real `Response body object should not be disturbed or locked` no streaming do anexo após a auditoria assíncrona. `ownDownloadStream` passou a assumir o leitor do provedor imediatamente e expor um fluxo próprio com controle de fluxo e cancelamento, sem carregar o original inteiro em memória. A correção foi testada, publicada e exercitada por três downloads consecutivos; as rodadas interrompidas não integram os totais aprovados. A primeira execução dos testes de domínio sem o arquivo de ambiente falhou na inicialização da configuração; a execução correta passou.

## Etapa 5 — integração e roteiro do núcleo

| Item | Implementação e verificação |
|---|---|
| Mensagens, carregamento, validação e duplicidade | Mensagem comum para falha de conexão; erros de domínio visíveis; botões com estado de processamento; trava síncrona no formulário e nos comandos do detalhe para impedir duas gravações pela mesma interação. Chaves de idempotência e revisão otimista continuam sendo as proteções do servidor. |
| Navegação e ações por perfil | `availableActions` fornece capacidades calculadas a partir de situação, perfil, autoria, etapa e participações concluídas. A interface consome essas capacidades; a API mantém suas validações próprias. Nível 3 não recebe formulário de criação por acesso direto, nem botões de mutação. Administração no menu exige permissão administrativa; a ficha pessoal continua acessível em Minha conta. |
| Permissões, concorrência e falhas | Suítes do núcleo conferem papéis revogados, suspensão, numeração concorrente, tramitação, primeira leitura, anexos e sigilo. Suíte 5/7 amplia para pré-condições da decisão, conclusão multissetorial, RH, delegação concorrente e publicação imutável. |
| Admin → Nível 3 → memorando → circular → cidadão → público | Roteiro publicado composto pelas suítes de etapas 1/2 e 3/4 na mesma versão HTTPS. Mapa dos sete cenários abaixo. |
| Roteiro humano e defeitos | Passos de homologação abaixo. Defeitos e correções registrados nesta entrega; homologação humana é um aceite posterior à verificação automatizada. |
| Identidade e documentação | Telas informam conta institucional/e-mail confirmado e indisponibilidade do Gov.br. Não há selo de identidade civil validada sem autenticação externa. A conferência matemática/fiscal de CPF/CNPJ não é autenticação Gov.br/ICP-Brasil. |

### Sete cenários internos da POC

1. **16.3.2.1:** Administração cria servidor; login com a conta; Nível 3 consulta e não altera recebimento/situação.
2. **16.3.2.3:** CPF e CNPJ protegidos nas consultas públicas e nos textos derivados.
3. **16.3.3.1:** Memorando no editor, numeração automática e múltiplos prazos no calendário.
4. **16.3.3.2:** Tramitação A → B → C e histórico com ator, origem, destino e data/hora.
5. **16.3.3.3:** Circulares Urgente e Meramente Informativa, setores/subsetores e primeira leitura individual.
6. **16.3.4.1:** Cidadão com conta, consulta real de CEP, requerimento e localização interna pelo protocolo.
7. **16.3.4.3:** Consulta externa por chave e QR HTTPS, inclusive viewport móvel, respeitando o sigilo.

**16.3.2.2** (Gov.br ou e-CPF real) e **16.3.4.2** (envio e retorno real por e-mail) continuam nas etapas 10 e 11. O fechamento desta etapa não significa POC integral 9/9 nem aceite da comissão.

## Etapa 7 — critérios e rastreabilidade

| Item | Entrega |
|---|---|
| Assuntos, campos, anexos, roteamento e ordem | Configuração de fluxos com campos tipados/condicionais/calculados, anexos por categoria, setores, prazo e decisão; publicação da configuração e snapshot por atendimento. A edição de rascunho usa o snapshot do fluxo vinculado, preservando a revisão contratada pelo atendimento. A API nega protocolo sem anexo obrigatório e avanço sem concluir todos os setores. |
| Processo multissetorial e SLA | Etapas ordenadas, uma participação por setor, prazo por expediente e calendário, conclusão explícita do setor selecionado e decisão fundamentada na última etapa. Servidores com vários vínculos recebem um botão por setor autorizado, sem assumir a lotação principal. |
| Árvore PDF/ZIP | Árvore bidirecional autorizada; seleção completa/personalizada; captura de fontes/revisões; fila assíncrona; PDF com capa, originais compatíveis e paginação; ZIP com originais e manifesto. Executor pode processar um trabalho específico com `--job UUID`, sem consumir a fila de outros usuários. |
| Chamados, Ouvidoria, e-SIC, pessoal | Campos próprios, fluxo, prazo, respostas, anexos e decisões. Identidade da Ouvidoria sigilosa restrita ao setor configurado; modalidade anônima não persiste identidade civil. Requerimentos pessoais tramitam apenas no RH configurado, mantendo acesso do próprio autor e do perfil Auditor. |
| PAD, judicial e seletivo | Campos específicos, lista com busca por código/assunto/situação/prazo, etapas, decisão, histórico e exportações. Judicial preserva numeração processual externa; códigos internos seguem `aaaammddxxxxx`. |
| Contatos, organizações e procuração | Cadastro PF/PJ por perfil, hierarquia organizacional, importação/exportação e unificação com reconciliação de vínculos. Mandatos eletrônicos de acesso com consentimento, convite, aceite por conta, poderes, escopo, vigência e revogação. Instrumento de procuração com validação criptográfica continua na etapa 10. |
| Contrassenha/delegação | Autorizador, digitador, validade, limite transacional, consumo concorrente e cancelamento; identificação preservada no documento. Novo relatório navegável e CSV relacionam emissões dentro do escopo documental autorizado. O contador da autorização não concede leitura dos documentos de outro setor. |
| Carta de Serviços | Descrição completa, requisitos, canais, prioridades, espera e prazo; filtros de categoria/público e ligação direta ao assunto ativo. Busca local por título/descrição/campos com normalização de acentos e vocabulário inicial. Esta é a preparação de recuperação semântica; não é um serviço externo de embeddings/IA. |
| Diário Oficial | Atos, catálogo hierárquico, organização/ordem/retirada, edições ordinárias/extraordinárias, calendário, busca no conteúdo e hash preservado. Edição informativa é explicitamente não assinada e imutável; edição certificada depende da etapa 10. |
| Central externa | Conta comum, caixa pessoal, rascunho/anexos/protocolo, respostas liberadas, avaliação após conclusão e representantes com poderes revogáveis. DTOs públicos e externos excluem campos internos e identidades protegidas. |

### Defeitos corrigidos neste incremento

- Detalhe apresentava permissão de edição apenas pelo papel, sem conferir a gestão do registro.
- Ações de avanço/decisão apareciam para participantes de outras etapas e antes da conclusão multissetorial.
- A conclusão setorial assumia a lotação principal, impedindo atuação explícita por vínculo secundário/subordinado.
- Rascunho apresentava campos da configuração ativa atual em vez do snapshot do seu atendimento.
- Acesso direto à criação por Nível 3 mostrava formulário que seria recusado pelo servidor.
- Emissões por delegação não tinham entrada navegável para relatório e exportação.
- Executor documental recarregava setores sem aplicar a mesma expansão Nível 1/Auditor usada na sessão interativa.
- Formulário/detalhe dependiam somente da atualização assíncrona do estado React para bloquear submissões repetidas.
- Download do anexo do cidadão podia falhar com corpo de resposta perturbado/bloqueado entre a leitura do armazenamento e o término da auditoria assíncrona. O leitor do armazenamento agora é apropriado imediatamente, com fluxo HTTP independente, preservação dos bytes e propagação de cancelamento.

## Roteiro de homologação humana

Usar contas autorizadas pelos responsáveis municipais. Os cadastros temporários dos ensaios automatizados são removidos após cada rodada.

1. Executar os roteiros de `FECHAMENTO_ETAPAS_1_2.md` e `FECHAMENTO_ETAPAS_3_4.md`, no SaaS publicado. Comparar Administrador, Nível 3 e usuário externo em sessões separadas.
2. Em **Gestão municipal → Assuntos e fluxos**, criar assunto com campo obrigatório condicional, duas etapas, dois setores na primeira e setor decisor na última. Configurar expediente e anexo obrigatório; ativar.
3. Em **Processos administrativos**, salvar rascunho. Conferir erro ao protocolar sem anexo; anexar o original na categoria configurada e protocolar. Conferir o prazo.
4. Em **Fluxo e respostas**, concluir apenas um dos setores. O avanço ainda não aparece. Concluir o outro setor autorizado; avançar. Somente o setor decisor da última etapa pode concluir suas participações e deferir/indeferir com fundamentação.
5. Abrir a **Árvore processual e anexos unificados**, solicitar PDF e ZIP completos e personalizados. Em **Processamento**, conferir execução, download, paginação do PDF, seleção e bytes originais no ZIP.
6. Repetir um atendimento por **Chamados**, **Ouvidoria** (três modalidades), **e-SIC**, **Requerimentos pessoais**, **PAD**, **Judicial** e **Seletivo**. Na Ouvidoria, comparar o setor de identidade e outro participante; nos pessoais, conferir restrição ao RH e acesso do titular.
7. Em **Contatos**, cadastrar PF/PJ/organização, importar/exportar e unificar duplicidade autorizada. Na central externa, conceder representação, aceitar com a conta convidada, consultar e revogar; conferir perda de acesso.
8. Em **Delegações**, autorizar digitador com um uso, ativar e emitir. Conferir autorizador/digitador, limite e cancelamento. Abrir **Documentos emitidos com esta autorização** e baixar CSV. A relação respeita o acesso documental da conta consultante.
9. Em **Carta de Serviços**, abrir **Filtros**, buscar por necessidade, filtrar categoria/público e abrir descrição. **Solicitar atendimento** deve selecionar o assunto vinculado na central externa.
10. Em **Diário**, criar edição e preparar atos formalizados. Classificar no catálogo; conferir recusa antes da classificação. Publicar edição informativa, abrir calendário/busca e tentar alterá-la. Conteúdo e hash devem permanecer preservados. A assinatura certificada não deve aparecer como realizada.
11. Como titular externo, acompanhar respostas/anexos liberados e avaliar após a conclusão. Reabrir pelo setor responsável e conferir novo ciclo de avaliação.

## Dependências operacionais

O executor local direcionado demonstra a geração assíncrona real. Disponibilidade permanente do worker, scheduler, observabilidade e retenção operacional pertencem à infraestrutura adiada e à etapa 9. Assinatura real e publicação certificada pertencem à etapa 10; Resend/canais reais à etapa 11. Parametrização definitiva de assuntos, expedientes, RH, catálogo e delegações depende dos responsáveis municipais. As lacunas avançadas de formulários registradas em `REVISAO_FORMULARIOS_0_9_2026-11-10.md` mantêm rastreabilidade própria na implantação.

## Reprodução técnica

Executar suítes de escrita sequencialmente. O endereço local usa os provedores compartilhados configurados em `.env.local`; não representa isolamento de dados.

```powershell
npm run db:migrate -- --check
npm run build
npm run start -- --port 3100
# Em outro terminal:
npm run validate:stages57 -- --allow-write --base http://localhost:3100
npm run validate:contacts -- --allow-write --base http://localhost:3100 --resolve-admin-from-db
# SaaS exige destino explícito e opt-in:
npm run validate:stages57 -- --allow-write --allow-production --base https://rioazul.celeriflow.com.br
# Núcleo e cidadão usam um snapshot novo por suíte:
npm run validate:stages12 -- --snapshot
npm run validate:stages12 -- --allow-write --allow-production --base https://rioazul.celeriflow.com.br --directory "<snapshot A>"
npm run validate:stages12 -- --snapshot
npm run validate:stages34 -- --allow-write --allow-production --base https://rioazul.celeriflow.com.br --directory "<snapshot B>"
```

Recuperação de limpeza da integração: `validate:integrated -- --allow-write --base <mesma URL> --admin-uid <UID administrativo> --resume-cleanup <manifest.private.json>`. Conferir o manifesto e manter os demais workers parados antes da recuperação. O executor direcionado é `npm run worker:documents -- --job <UUID>`; usa os mesmos bloqueios de lease e não consome a fila inteira.
