# Etapa 6 — GED e módulos documentais

Data: 10/11/2026. **Estado: 9/9 itens tecnicamente encerrados no recorte documentado, publicados e validados em HTTPS. Homologação municipal pendente.**

## Nove critérios do plano

| Item | Entrega técnica | Evidência de aceitação |
|---|---|---|
| 6.1 — Editor | Blocos com parágrafos formatados, tabelas, imagens incorporadas/HTTPS, links, ordenação, tela cheia incluindo os blocos, modelos/variáveis consistentes, importação DOCX com original privado, autosalvamento após primeiro rascunho e reserva exclusiva renovável. | Cenários `6-editor-*` e `6-browser-*`: duas reservas da mesma conta, renovação/expiração, revisão obsoleta, persistência no servidor, aplicação de modelo e DOCX. |
| 6.2 — PDF e preservação | PDF nativo A4 e prévia autenticada pelo mesmo renderizador, folha de rosto, tabelas paginadas, imagens incorporadas, links e paginação. Compilação e PDF/A-2b na fila; relatório veraPDF vinculado ao SHA-256 da saída. Originais e versões preservados; envelope documental imutável para assinatura. | `6-native-pdf-*`, `6-original-*`, `6-pdfa-*`, `6-signature-seal-*`; teste de célula maior que uma página e guardas SQL. |
| 6.3 — Parecer | Natureza técnica/jurídica, origem obrigatória em documento/processo acessível, código próprio, anexos, formalização, conclusão e histórico. | Dois pareceres vinculados ao documento do núcleo; rejeição de parecer sem origem; conclusão própria. |
| 6.4 — Ofício | Destinatário externo livre ou contato autorizado, snapshot de nome/e-mail/revisão, vínculo, resposta/histórico, conclusão e QR institucional no PDF. | Fluxo contato → ofício → resposta → PDF/QR → conclusão. Entrega e recebimento externo real continuam na etapa 11. |
| 6.5 — Intimação/reunião | Intimação com destinatário, prazo, ciência manual com evidência, validação do destinatário e arquivo. Pauta com reunião/local, itens/responsáveis, participantes e deliberações obrigatórias, preservando a pauta formalizada. | Recusa de ciência de outro destinatário; ciência/arquivo; recusa de reunião sem deliberação ou com pauta substituída; encerramento próprio. Desenho funcional sujeito à validação da Administração. |
| 6.6 — Atos oficiais | Espécie, conteúdo/modelos, vínculos, formalização/conclusão, QR institucional e composição do Diário; autorização setorial no servidor e na interface. | Portaria ligada à reunião/acervo, bloqueio de edição do conteúdo formalizado e mutação por N3. Composição/publicação informativa já exercitada na etapa 7. |
| 6.7 — Assinaturas preparadas | Vários assinantes, etapas paralelas/sequenciais, recusa/cancelamento justificados, prevenção de duplicatas/saltos/sobrescrita de fila pendente, tela central e lote com resultado individual. | Envelope preserva conteúdo/revisão/hashes dos originais; acesso temporário do signatário externo ao setor é revogado após recusa; lote com sucesso/negação e cancelamento. Execução criptográfica real permanece na etapa 10. |
| 6.8 — Classificação/etiquetas | Hierarquia importável de até quatro níveis, caminho função/subfunção/atividade/série, recusa de ciclos/pais ausentes/quinto nível, reclassificação por documento autorizado, versões e etiquetas por setor. Lista permite pesquisar classe/etiquetas. | Importação/reclassificação mista com negação de outro setor; consulta setorial das etiquetas e busca pela listagem. |
| 6.9 — Processamento | Fila idempotente com lease/fencing, execução direcionada de PDF/PDF-A/OCR/ZIP, originais conferidos por hash, resultados privados/expiráveis, download e relatório. Solicitação de assinaturas em lote preparada na central documental. | Quatro execuções reais e conferência dos artefatos; OCR de PDF composto apenas por imagem e sem texto incorporado; PDF/A validado independentemente. Worker permanente e scheduler seguem na etapa 9/infraestrutura. |

## Proteção de dados e migração

- Migração aditiva `012_ged_signature_snapshot.sql`: protege a correspondência entre envelope/revisão/originais e sua imutabilidade; unificação de contatos atualiza a referência corrente `recipientContactId`, preservando envelopes e históricos.
- Os onze arquivos históricos não foram alterados. Executor próprio com conexão direta, trava, checksum e transação por arquivo; sem seed ou limpeza geral.
- Reconstrução local: `stage0-1794357601379/results.json`, três bancos independentes, 52 tabelas e 13 históricos por banco (baseline + 12 migrações). Checksums, FKs, rollback e guarda de envelope aprovados.
- Suíte da etapa 6: snapshot anterior às gravações, contas/setores/documentos/arquivos próprios, execução apenas de trabalhos próprios, arquivo privado dos históricos antes da limpeza e reconferência dos originais. `audit_log` permanece no banco.

## Verificações e versão

Build, lint e TypeScript aprovados. Suíte de domínio: **54/54**, com conexão fictícia apenas para inicialização das dependências dos testes puros; sem consultas reais nessa suíte.

Aceitação local final: **196/196**, rodada `stage6-1794358078990`. Regressão de contatos/unificação: **86/86**, `contacts-0d58fe9f-608a-4683-9a5d-aa5f4a38dd5d`, com recursos próprios removidos. Preservação da etapa 6: 15 servidores, cinco documentos, seis setores e o anexo original (78 bytes e SHA-256 conferidos), além dos sete fingerprints dos cadastros originais. PDF/A-2b aceito pelo veraPDF 1.30.4 com **144 regras aprovadas e zero reprovadas**. OCR em português reconheceu o documento composto apenas por imagem.

Regressão integrada local das etapas 5/7 no mesmo incremento: **533/533**, rodada `stages57-1794358358909`, com limpeza e reconferência dos originais aprovadas. Os inventários sanitizados dessas regressões integram `EVIDENCIAS_ETAPA_6.json`.

Aceitação autenticada em produção: **196/196**, rodada `stage6-1794358715176`, base `https://rioazul.celeriflow.com.br`, com Chrome, prévia, DOCX, lotes, quatro execuções reais e originais/fingerprints reconferidos após a limpeza. Os conversores rodaram no executor local temporário, consumindo exclusivamente os trabalhos criados nessa rodada pela API HTTPS. Isso valida o contrato publicado e o processamento real, sem caracterizar worker permanente hospedado na Vercel.

Rodada inicial `stage6-1794357489195` foi reprovada e limpa. Revelou incompatibilidade real na leitura do relatório veraPDF 1.30.4: `validationResult` é uma lista. O conversor havia produzido PDF/A válido, mas o leitor rejeitava a conformidade. Corrigido o leitor para aceitar objeto/lista e recusar relatório vazio, perfil divergente ou falha parcial. Ajustados também o cadastro de contato próprio do ensaio, o seletor acessível e a inspeção de XObjects na assertiva de imagem; esses ajustes não equivalem a defeitos de preservação do PDF. A rodada `stage6-1794357869786` aprovou os fluxos e deixou uma falha do seletor de checkbox duplicado no diálogo oculto da tabela; o ensaio passou a selecionar pelo papel acessível visível. Ambas foram limpas e tiveram os originais reconferidos.

Código funcional `1602f39` publicado no deployment `dpl_EzWvo8RCfAYqe7ZR82Z1jjRSAC9L`, **READY**, versão `https://celeriflow-rio-azul-ddtucm3m4-celeriflow-hub.vercel.app`, alias `https://rioazul.celeriflow.com.br`. Build/lint/tipos remotos, health público e validação autenticada do SaaS aprovados. Evidências sanitizadas em `EVIDENCIAS_ETAPA_6.json`; artefatos completos privados nos diretórios das rodadas. Consulta pontual de logs: zero registros de erro entre `2026-11-11T00:31:16.388Z` e `2026-11-11T01:01:16.388Z`; não comprova SLA contínuo.

O envio GitHub de `1602f39` foi recusado por ausência de credencial não interativa (`Cannot prompt because user interactivity has been disabled`). Publicação pela conexão Vercel autenticada `celeriflow-hub`, associada à conta autorizada. A publicação SaaS não sincroniza o GitHub; preservar os commits e o bundle local até regularizar a autenticação Git.

Arquivo de entrega local: `stage6-release-20261110/` no diretório temporário aprovado, com log de publicação, versões das ferramentas, metadados de release e bundles Git verificados. Servidor local encerrado ao finalizar os ensaios. Plano, matriz e índice de 172 grupos/909 unidades atualizados; etapa 6 fechada tecnicamente, etapas 8/9 ainda abertas.

## Roteiro humano

1. **Acervo documental → Novo registro**: salvar rascunho; editar conteúdo e blocos; confirmar o salvamento automático. Abrir a edição em outra aba e conferir o bloqueio por reserva. Aplicar modelo e alternar tela cheia.
2. **Modelos**: importar Word com tabela/imagem e variáveis, salvar, aplicar no acervo; baixar o DOCX original e conferir o conteúdo. Abrir PDF, prévia e folha de rosto.
3. **Pareceres**: criar um técnico e um jurídico, vinculando ao processo; anexar, protocolar e concluir. Conferir versões e origem na árvore processual.
4. **Ofícios**: selecionar um contato, conferir destinatário/e-mail, protocolar, registrar a resposta e concluir. Ler o QR no PDF com uma conta autorizada.
5. **Intimações**: registrar destinatário/prazo, formalizar, registrar ciência com evidência e arquivar. **Pautas**: incluir participantes/itens, formalizar, registrar deliberações e encerrar.
6. **Atos oficiais**: elaborar uma portaria por modelo, vincular aos documentos, formalizar e concluir. Com conta de leitura, conferir ausência de ações mutantes.
7. **Fila de assinaturas**: selecionar documentos, definir dois assinantes na etapa 1 e outro na etapa 2, solicitar; conferir resultado individual, recusar com a conta convidada e cancelar as demais com o solicitante. Conferir hash e cronologia no detalhe/histórico.
8. **Plano de classificação**: importar quatro níveis, reclassificar um documento, adicionar etiqueta setorial e localizar pela listagem. Conferir acesso com outra lotação.
9. **Processamento**: solicitar PDF, PDF/A, OCR e ZIP; executar o worker configurado, conferir download, hashes e relatório veraPDF. Configuração e limites em [PROCESSAMENTO_GED.md](PROCESSAMENTO_GED.md).

## Limites de aceite

Este recorte técnico não encerra automaticamente todas as alíneas das páginas 41–85: numerações especiais de atos por assunto/manual, atribuições avançadas de signatários, coassinatura externa, versões comprimidas/fracionadas, menções por caractere, fluxos municipais definitivos e demais critérios individuais continuam na matriz até sua evidência específica. O código de negócio entregue aqui segue `aaaammddxxxxx`.

PDF nativo é PDF comum; PDF/A é o artefato validado da fila. Importação Word converte para blocos e preserva o original, sem prometer reprodução tipográfica absoluta. Imagem HTTPS externa exige origem permitida no worker. QR abre consulta institucional e não substitui entrega, ciência ou assinatura. Ciência manual registra a evidência informada pelo servidor; não inventa recebimento eletrônico externo.

Assinatura criptográfica/Gov.br/ICP/PAdES permanecem na etapa 10; canais/e-mail reais na 11; homologação humana e parametrização municipal continuam necessárias. A aceitação pontual dos executores não prova operação contínua, disponibilidade ou redundância.
