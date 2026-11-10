# Tarefas reproduzíveis — achados F01–F12

Fonte histórica: `VALIDACAO_INTERNA_POC_2026-11-10.md`, seção 4. Responsável técnico por cada tarefa: Celeriflow. Aceite funcional: proprietário/Município conforme a etapa. Preparação: base autorizada, identidades Admin/N3/A/B/C e massa própria com manifesto, conforme `PLANO_DADOS_ENSAIO.md`.

O estado abaixo é do recorte conhecido, não fechamento integral do requisito. Os achados originais permanecem preservados. Não executar escrita nos serviços existentes apenas para reproduzir este documento.

| Tarefa / etapa / IDs | Reprodução e resultado esperado | Regressão e estado |
|---|---|---|
| F01 · 1 · POC-P25-01, ACE-P32-02 | N3 tenta receber/alterar documento; suspender uma conta e repetir GET com token anterior. Esperado: recusa, sem mutação ou acesso residual. | `validate-integrated.ts`: cenários N3/suspensão/revogação. Evidência integrada final; testado no recorte, falta aceite completo por tela. |
| F02 · 1 · POC-P25-01, ACE-P31-01 | Admin cadastra servidor; entrar com a conta criada; conferir UID, perfil e setor. Falha de provisionamento não pode produzir sucesso falso. | Mesmo harness: criação e autenticação de nova conta. Evidência integrada final; completar demonstração pelo formulário/login. |
| F03 · 10 · POC-P25-02, EXT-P33-01 | Tentar vínculo autodeclarado; executar login real, erro/cancelamento e retorno com sessão. Esperado: somente identidade validada pelo provedor. | Pendente integração real; aceite exige credenciamento/certificado e recibo da autenticação. Registrar falha/ausência, nunca substituir por formulário local. |
| F04 · 4 · POC-P25-03, POC-P26-09 | Documento com nota interna, identificador e classificação restrita; consultar pelas duas rotas públicas, sem sessão e com terceiro. Esperado: nenhuma nota/identidade privada. | `public-protocol-redaction`, `external-dto-privacy` e cenários de escopo no harness integrado; completar todos os caminhos e tela. |
| F05 · 4 · POC-P25-03 | Consultar CPF e CNPJ válidos em DTO e textos derivados; comparar máscara e ausência do identificador completo. | Recorte de privacidade integrado; pendente roteiro visual completo de ambos os documentos. Não marcar alínea inteira por teste de CPF apenas. |
| F06 · 2 · POC-P25-05, ORG-P67-01 | A cria, encaminha a B; B recebe e encaminha a C; repetir envio concorrente. Esperado: origem B no segundo envio, destino no recebimento e uma transição vencedora. | `forward-race-one-winner`, `exactly-two-forward-events` e ações do núcleo; evidência integrada final. |
| F07 · 3 · POC-P25-06, CIR-P45-01 | Circular em dois subsetores; leitor não destinatário; duas leituras do destinatário; ampliar destino urgente. Esperado: população única, sem recibo indevido e primeira data imutável. | `immutable-first-read`, `single-receipt-in-sql`, `urgent-forward-adds-individual-recipients`; completar comparação visual lista/detalhe. |
| F08 · 4 · POC-P26-07, PRT-P60-01 | Cidadão abre requerimento; servidor do Protocolo o localiza pela caixa/número sem UUID. Esperado: destino autorizado e acesso navegável. | `anonymous-protocol-explicit-intake` e rota de protocolo integrado; falta fechamento do cenário cidadão→caixa pela interface. |
| F09 · 11 · POC-P26-08, NOT-P69-01 | Provedor rejeita envio e depois aceita mensagem real. Esperado: rejeição não vira SENT; sucesso armazena ID, sem confundir aceite do provedor com entrega. | Pendente configuração do Resend e caixa real. Conferir retorno data/error e persistência no cenário da etapa 11. |
| F10 · 11 · POC-P26-08, EXT-P34-02 | Webhook sem assinatura; webhook real; resposta HTML longa e anexos; repetir evento. Esperado: recusa do não autêntico, despacho completo e único, bytes preservados. | Pendente ciclo real do provedor. Automação sintética não encerra esta tarefa. |
| F11 · 2 · ANX-P77-01 | Anexar arquivo conhecido, clicar para baixar autenticado; repetir URL sem sessão e com terceiro. Esperado: arquivo íntegro só a autorizado. | `download-original-status`, `sha256-original-equals-download`; concluir roteiro pelo clique na tela publicada. |
| F12 · 2/4/7 · PRZ-P69-01, FOR-P87-02 | Dois prazos no mesmo memorando, feriado/fim de semana, CPF repetido/inválido e data inexistente. Esperado: calendário correto e rejeição de entradas inválidas sem gravação parcial. | `calendar-weekend-holiday-oracle`, `deadline-persisted`, `modules.test.ts` e `workflow-validation.test.ts`; calendário visual e existência cadastral têm aceite separado. |

## Execução e vínculo da evidência

- Harness integrado: `npx tsx --env-file=<arquivo-privado> scripts/validate-integrated.ts --allow-write --base <URL> --admin-uid <UID> --intake-department <UUID> --external`. Todos os destinos/identidades devem ser do ambiente autorizado. O operador mantém o manifesto privado e usa `--resume-cleanup <manifesto>` apenas para retomar a limpeza daquela execução.
- Testes puros de campos: `npx tsx --test src/lib/modules/modules.test.ts src/lib/modules/workflow-validation.test.ts`.
- Navegador isolado de formulários: `npx tsx scripts/validate-workflow-browser.ts`, com build local na porta 3100; intercepta somente a API do cenário e não grava na base.
- Evidência integrada final anterior: `integrated-a09deb90-e73d-4887-9d7e-69dd37ab5ca2/results.redacted.json`, 307 verificações, detalhada em `FECHAMENTO_ARVORE_E_VALIDACAO.md`.
- Cada nova execução deve registrar ID/alínea, versão/hash, URL/ambiente, data, responsável, massa/cenário, esperado/obtido, resultado, arquivo de evidência e pendência. Registrar falhas sem convertê-las em aprovação; não apagar histórico de rodadas anteriores.

Converter um achado em tarefa rastreável encerra o item organizacional da etapa 0. Resolver a tarefa e obter seu aceite continuam nas etapas indicadas.
