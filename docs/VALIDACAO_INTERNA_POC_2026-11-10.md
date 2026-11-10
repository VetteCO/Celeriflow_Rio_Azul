# Validação interna da POC — Pregão 60/2026

**Data:** 10/11/2026  
**Parecer:** o sistema possui fluxos básicos funcionais, mas **não está pronto para uma apresentação técnica com segurança de atendimento aos requisitos**. Há falhas reproduzidas em permissões, sigilo, tramitação, circulares e integração entre o portal externo e o atendimento interno. Gov.br e e-mail real não estão implementados/configurados de ponta a ponta.

## 1. Fontes e regra de avaliação

- `docs/PREGÃO 60-2026 1 PROTOCOLO ELETRÔNICO.pdf`, páginas físicas/impressas **25 e 26**, itens **16.3.2.1 a 16.3.4.3**: nove subitens funcionais, distribuídos em três cenários.
- `docs/edital retificado.docx`, retificação de 24/08/2026: substitui a regra de reprovação por qualquer macro-requisito pelo atendimento de **pelo menos 70%** na POC; exige **100% na implantação/parametrização**.
- Código das telas, rotas de API, autenticação, banco, numeração, anexos e e-mail.
- Documentação do Resend sobre `email.received`, consultada em 10/11/2026: <https://resend.com/docs/webhooks/emails/received>.

O edital exige apresentação presencial, execução ao vivo em SaaS, ambiente em cinco dias úteis da convocação e duração máxima de duas horas. A página 26 também inicia a habilitação jurídica; esses documentos empresariais não são funcionalidades do software e não foram objeto dos testes.

**Contagem:** tomando os nove subitens funcionais como unidades de avaliação, são necessários **7 de 9** para alcançar pelo menos 70%. A consolidação oficial dos macro-requisitos cabe à comissão. Não há fundamento para adicionar “ofício” como um décimo requisito desses cenários nem para contar uma simulação como integração real comprovada.

Consequentemente, a conclusão “passa” em `MAPEAMENTO_TR_SISTEMA.md:41-44` não está sustentada pela implementação auditada. A afirmação de que bastaria preencher credenciais também não procede: há código de integração ainda ausente.

## 2. Ambiente e método

- `npm run build`: **aprovado**, incluindo compilação e verificação de tipos; saída com código 0.
- Aplicação executada com `next start --port 3100`, em **http://localhost:3100**.
- Testes HTTP das APIs reais, usando **Neon, Firebase e Vercel Blob reais** configurados no `.env.local`.
- Sessões temporárias Admin Geral e Nível 3 autenticadas por Firebase Custom Token e troca por ID token real. Isso valida o backend autenticado; o login por e-mail/senha das contas da apresentação ainda precisa ser ensaiado na tela.
- ViaCEP consultado externamente, com o CEP `80010-180`.
- Inspeção do código das telas e verificação HTTP de oito páginas. Interação visual, editor no navegador, navegação com mouse e leitura do QR por celular ficam para o ensaio do usuário.
- E-mail recebido foi exercitado por HTTP contra o núcleo real do sistema, com mensagens sintéticas; **não houve entrega/resposta por uma caixa postal real**.
- Um teste adicional simulou exclusivamente a resposta HTTP 422 do Resend, executando o handler real de criação de requerimento. Não enviou e-mail externo.
- **55 verificações registradas: 34 passaram e 21 falharam.** Incluem conectividade, carregamento de páginas, preparação e limpeza; esses números **não são a pontuação do edital**.

### Configuração efetiva

| Integração | Situação observada |
|---|---|
| Neon | Conectado; leitura e gravação verificadas |
| Firebase | Tokens verificados e alteração de custom claim confirmada |
| Vercel Blob privado | Upload e download autenticado aprovados |
| ViaCEP | Endereço real retornado corretamente |
| Gov.br | Client ID, secret e discovery vazios; rota local simulada; callback real responde 501 |
| Resend | `RESEND_API_KEY` e `EMAIL_FROM` vazios; confirmação fica `PENDING` |
| Inbound | `INBOUND_WEBHOOK_SECRET` vazio; webhook aceitou mensagem sem autenticação |
| Aplicação | URL local; deploy SaaS público e acesso externo não foram comprovados nesta rodada |

### Preservação dos dados

Os testes criaram registros com prefixos `AUDIT-...`, três logins temporários Firebase, setores/subsetores, memorandos, circular, requerimentos e um arquivo privado. Os registros e o arquivo foram removidos ao final; os logins Firebase temporários também foram excluídos.

Conferência final: **15 usuários, 5 setores e 5 documentos**, iguais aos totais anteriores; **zero documentos, cidadãos ou registros de auditoria dos testes restantes**. Dos 15 usuários existentes, 9 possuem vínculo Firebase. Os cinco setores existentes não possuem relação pai/subsetor; os subsetores usados no teste foram temporários.

Não houve alteração no código da aplicação. Este relatório registra os defeitos encontrados, não sua correção.

## 3. Matriz dos nove requisitos

| Item | Exigência e telas | Resultado interno | Situação |
|---|---|---|---|
| **16.3.2.1** | Criar servidor e distinguir Admin Geral de Nível 3; `/admin`, `/documentos/[id]` | Cadastro no banco e troca de claim funcionam; Nível 3 recebe 403 nas operações principais. Entretanto, usuário recém-criado não ganha login e Nível 3 pode registrar recebimento/alterar status. | **Parcial — corrigir** |
| **16.3.2.2** | Login Gov.br **ou** ICP-Brasil e-CPF; `/login-govbr` | Login redireciona para formulário local. Callback com `code` retorna 501. Não há autenticação e-CPF implementada. | **Não atende** |
| **16.3.2.3** | Mascarar CPF/CNPJ em consulta pública; `/publico/[key]`, `/cidadao` | CPF mascarado no DTO específico. CNPJ produz máscara incorreta e revela dígitos finais; notas internas podem expor dados por outra consulta pública. | **Parcial — corrigir** |
| **16.3.3.1** | Editor, múltiplos prazos em calendário e sequência automática; `/documentos/novo`, `/documentos/[id]` | HTML, dois prazos iniciais, prazo adicional e quatro criações concorrentes aprovados. Há seletores `datetime-local` e lista de prazos, mas não calendário/agenda consolidado. | **Parcial — demonstrar/completar calendário** |
| **16.3.3.2** | Despacho entre setores e timeline cronológica; `/documentos/[id]` | Despacho e ordem temporal funcionam. Segundo despacho registra a origem inicial, não o setor atual; recebimento não registra setor de destino. | **Parcial — corrigir** |
| **16.3.3.3** | Circular Urgente/Informativa a múltiplos subsetores e data/hora de leitura por servidor; `/circulares` | Distribuição e primeira leitura imutável funcionam. Placar da listagem difere do detalhe, não destinatário registra leitura e a base de apresentação não tem subsetores. | **Parcial — corrigir/preparar dados** |
| **16.3.4.1** | Cadastro externo, busca CEP e requerimento; `/cidadao` | ViaCEP real, criação do cidadão, documento, protocolo e chave aprovados. Cadastro aceita CPF inválido; requerimento fica fora da lista interna. | **Fluxo principal atende, com ressalvas** |
| **16.3.4.2** | Notificação real e resposta no provedor do cidadão capturada automaticamente como despacho | Mensagem textual sintética gera `EXTERNAL_REPLY` e deduplica. Não há envio/recebimento real demonstrável; há defeitos no status de envio, adaptação do webhook e extração do conteúdo. | **Não atende ponta a ponta** |
| **16.3.4.3** | Consulta por QR **ou** chave pública com sigilo; `/publico/[key]`, `/cidadao` | Chave válida, chave inexistente e imagem QR aprovadas. Outra rota pública revela notas internas; `access_level` não restringe a consulta. | **Parcial — falha de sigilo** |

As ressalvas impedem tratar os sete itens fora de Gov.br/e-mail como sete aprovações garantidas. Não recomendo sustentar a apresentação na suposição de que apenas esses dois itens falharão.

## 4. Falhas reproduzidas e evidências

### F01 — Nível 3 e contas inativas podem alterar/acessar documentos

- Nível 3: `POST /api/documents/{id}/receive` retornou **200**, inseriu `RECEIVED` e mudou o status para `OPEN`.
- A tela exibe “Marcar recebido” também ao perfil somente visualização.
- Conta temporária marcada `active=false` continuou obtendo **200** em `/api/documents` com seu token válido.
- Criação, mudança de perfil, despachos, prazos e simulação de e-mail foram corretamente bloqueados com **403** para Nível 3.
- Fontes: `src/app/api/documents/[id]/receive/route.ts:9-40`, `src/app/documentos/[id]/page.tsx:276`, `src/lib/auth.ts:8-30`.

**Correção necessária:** permissão específica de recebimento, autorização por contexto do documento/setor e validação do usuário ativo no backend.

### F02 — Cadastro de servidor não provisiona acesso

`POST /api/admin/users` retornou **201**, mas o registro ficou com `firebase_uid=null`. A criação de login continua dependendo do Firebase Console e vínculo manual. A troca de perfil funciona quando o usuário já está vinculado.

Fontes: `src/app/api/admin/users/route.ts:64-92`, `src/app/admin/page.tsx:154-175`.

**Impacto:** criar um servidor na demonstração não permite entrar imediatamente com esse novo servidor. Completar o provisionamento e a entrega/definição de credenciais.

### F03 — Gov.br simulado e vínculo sem autenticação externa

- `/api/auth/govbr/login` retornou **307 para a tela local**.
- `/api/auth/govbr/callback?code=...` retornou **501**.
- `POST /api/auth/govbr/link`, com uma conta temporária Nível 3 e CPF `00000000000`, retornou **200**, sem qualquer token Gov.br ou callback previamente autenticado.
- A tela usa as expressões “Ambiente de homologação” e “gov.br verificada”, mas essa identificação é autodeclarada. O callback local não cria sessão Firebase.

Fontes: `src/app/api/auth/govbr/callback/route.ts:18-41`, `src/app/api/auth/govbr/link/route.ts:29-65`, `src/lib/govbr.ts`, `src/app/login-govbr/page.tsx:52-55`, `src/app/admin/page.tsx:255-269`.

**Correção necessária:** implementar uma das duas autenticações admitidas pelo edital. No caminho Gov.br, completar OIDC, validação da identidade/estado e criação da sessão/vínculo. Preencher variáveis sozinho não resolve.

### F04 — Sigilo diverge entre as duas consultas públicas

1. Criado requerimento temporário e adicionado despacho com marcador de nota interna e CPF sintético.
2. `/api/publico/{key}` omitiu corpo, anexos e notas, conforme esperado.
3. **Sem autenticação**, `/api/cidadao/requerimentos?key=...` retornou a nota interna completa em `history[].note`.
4. Em teste adicional, um documento marcado `access_level='CONFIDENTIAL'` continuou expondo seu assunto em `/api/publico/{key}`, com **200**.

Fontes: `src/app/api/cidadao/requerimentos/route.ts:161-185`, `src/app/api/publico/[key]/route.ts:16-54`, `src/db/schema.ts:103`.

**Correção necessária:** aplicar política única de publicação e sigilo às duas rotas. Notas internas não podem ser publicadas automaticamente; a classificação de acesso deve ser respeitada.

### F05 — Máscara de CNPJ incorreta

Para entrada sintética `12345678000195`, o resultado público foi **`**.***.000/195-**`**. A saída tem formato incorreto e inclui os dígitos verificadores `95` no trecho visível. O teste de CPF estruturado passou.

Fonte: `src/lib/mask.ts:10-13`. Corrigir os intervalos usados na máscara e retestar CPF e CNPJ em todas as consultas públicas.

### F06 — Tramitação não acompanha o setor atual

No fluxo setor 0 → setor 1 → setor 2, a segunda movimentação permaneceu **setor 0 → setor 2**. O handler usa sempre `doc.originDepartmentId`. O recebimento grava `toDepartmentId: null`.

Fontes: `src/app/api/documents/[id]/forward/route.ts:41-48`, `src/app/api/documents/[id]/receive/route.ts:29-35`.

**Correção necessária:** representar/controlar o setor atual e preservar a cadeia de origem/destino de cada movimentação.

### F07 — Contagem de circulares inconsistente

Para a mesma circular, após uma leitura:

- **Detalhe:** 2 destinatários, 1 lido, 1 não lido.
- **Listagem:** 4 destinatários, 1 lido, 3 não lidos.

A lista soma registros de setores e de pessoas; o detalhe considera pessoas. Um usuário fora dos destinatários também abriu a circular e ganhou recibo de leitura. A primeira leitura do destinatário permaneceu imutável ao reabrir, comportamento correto.

Fontes: `src/app/api/circulars/route.ts:49-60,102-116`, `src/app/api/circulars/[id]/route.ts:59-85`.

**Correção necessária:** usar a mesma população de destinatários nas contagens, restringir recibos aos destinatários e preparar subsetores/servidores representativos na base do ensaio.

### F08 — Requerimento externo não chega à lista de trabalho interna

O requerimento foi gravado e seu detalhe ficou acessível por ID. Porém, `/api/documents` não o listou: o filtro só aceita `MEMORANDUM` e `OFICIO`. Não há caixa/listagem interna própria de requerimentos na árvore atual de telas.

Fonte: `src/app/api/documents/route.ts:39-50`, `src/app/documentos/page.tsx:69-80`.

**Impacto:** a sequência cidadão → atendimento interno → despacho/resposta não é navegável pelas telas sem conhecer antecipadamente o UUID. Criar uma entrada interna para os protocolos externos e ligar o resultado da abertura ao acompanhamento adequado.

### F09 — E-mail real ausente; erros podem virar “enviado”

- Requerimento criado no ambiente efetivo retornou **`emailStatus: PENDING`**.
- Em teste controlado, o Resend respondeu **422**; ainda assim, o handler retornou **201 / `emailStatus: SENT`**.
- O SDK retorna `{ data, error }`; o código não verifica `error` e só trata exceções.
- A tela promete confirmação futura quando o status é pendente ou falho. Não há rotina de reenvio/processamento dos pendentes na implementação inspecionada.

Fontes: `src/lib/email.ts:14-20`, `src/app/api/cidadao/requerimentos/route.ts:115-143`, `src/app/cidadao/page.tsx:110-113`.

**Correção necessária:** configurar envio real, verificar o retorno do provedor, persistir seu identificador e apresentar o status verdadeiro. A confirmação só pode ser demonstrada como enviada após um envio aceito, com entrega validada na caixa de ensaio.

### F10 — Captura automática não está ligada ao contrato real do provedor

- Webhook sem autenticação aceitou mensagem sintética com **200** quando o segredo estava vazio.
- Payload no formato `type: email.received, data: { from, to: [...] }` retornou **400**. A rota exige `to` e `from` no topo, com destinatário em string.
- A documentação atual do Resend informa que o webhook traz metadados; corpo e anexos exigem chamadas adicionais às APIs de recebimento. Essa adaptação não existe no código auditado.
- Resposta textual simples gerou despacho; reenvio sequencial do mesmo Message-ID foi deduplicado corretamente.
- Resposta somente HTML gerou **“(resposta sem texto extraído)”**.
- Resposta longa teve somente os primeiros **500 caracteres** expostos na timeline, sem acesso ao restante pela tela/API de detalhe.
- O botão “Registrar resposta recebida por e-mail” chama `/api/email/inbound/simulate`: é uma ação manual de simulação.

Fontes: `src/app/api/email/inbound/route.ts:9-21`, `src/lib/inbound.ts:48-119`, `src/app/documentos/[id]/page.tsx:86-103,279-287`.

**Correção necessária:** integrar o webhook do provedor, verificar sua autenticidade, recuperar conteúdo/anexos, extrair HTML, preservar o conteúdo integral acessível e comprovar uma resposta feita na caixa postal do cidadão sem clicar no simulador.

### F11 — Anexo funciona na API, mas o link da tela não envia autenticação

Upload **201** e download com Bearer **200**, com bytes corretos. A mesma URL sem Bearer retornou **401**. A tela usa `<a href={a.url} target="_blank">`; esse clique não inclui o ID token armazenado pelo Firebase.

Fontes: `src/app/documentos/[id]/page.tsx:217-220`, `src/app/api/attachments/[id]/route.ts:10-17`, `src/lib/auth.ts:9-10`.

**Correção necessária:** fazer download autenticado e abrir/salvar o arquivo resultante, ou usar mecanismo de sessão/autorização apropriado. Não tornar o Blob público para contornar o problema.

### F12 — Calendário e validação cadastral incompletos

- Prazos persistem corretamente, inclusive o terceiro adicionado depois da criação. A interface contém campos `datetime-local` e uma lista; não há componente de calendário/agenda consolidado. Confirmar atendimento à expressão “vinculando múltiplos prazos em calendário” e completar a visualização antes da apresentação.
- CPF sintético inválido `99999999999` foi aceito com **201** no cadastro externo. A validação atual considera somente comprimento entre 11 e 14, permitindo também comprimentos intermediários.

Fontes: `src/app/documentos/novo/page.tsx:127-163`, `src/app/documentos/[id]/page.tsx:180-211`, `src/app/api/cidadao/requerimentos/route.ts:22-35`.

## 5. Ordem recomendada de correção

1. **Permissões e sigilo:** F01, F04, F05 e autorização/autenticidade de F03/F10. São falhas diretamente relacionadas ao Cenário 1 e à consulta pública.
2. **Integrações exigidas:** concluir Gov.br ou e-CPF; completar envio/recebimento real de e-mail com captura automática. Validar em ambiente publicado e caixa postal real.
3. **Fluxo demonstrável:** provisionamento do servidor, caixa interna de protocolos, setor atual na tramitação, contagem/destinatários de circulares e download por clique.
4. **Aderência e dados:** calendário, CPF/CNPJ válidos, subsetores com usuários vinculados e contas de apresentação testadas.
5. **Atualizar documentação de apresentação:** remover conclusões de aprovação sem evidência; corrigir rotas antigas e descrições de simuladores. A home atual é uma mesa de trabalho, não um painel com nove POCs/status como diz o roteiro antigo.

## 6. Roteiro para o teste posterior das telas

Estes são critérios de aceite; os pontos com defeitos acima não passam na versão auditada.

1. **Administração:** entrar como Admin, criar servidor, definir perfil/setor e entrar com a nova conta. Comparar com Nível 3; verificar que só visualiza e não altera status, prazo, conteúdo ou permissões.
2. **Autenticação avançada:** completar o login no provedor real Gov.br ou com e-CPF e retornar já autenticado. Não usar o formulário local como evidência de integração.
3. **Memorando:** redigir com formatação, cadastrar dois prazos, conferir o calendário, salvar e abrir outro memorando para demonstrar a sequência automática.
4. **Tramitação:** setor A → B → C; conferir em cada etapa origem, destino, ator, horário e status na timeline.
5. **Anexo:** anexar arquivo, abrir pelo link da tela e verificar o conteúdo. Tentar acesso sem sessão e confirmar bloqueio.
6. **Circular:** escolher Urgente/Informativa e dois subsetores; abrir com dois servidores destinatários. Reabrir e confirmar a mesma primeira data/hora; comparar os totais da lista, detalhe e filtro de não lidos.
7. **Cidadão:** em janela anônima, buscar `80010-180`, cadastrar dados fictícios válidos e abrir requerimento. Localizá-lo pela interface interna do servidor.
8. **E-mail:** receber notificação em caixa de ensaio controlada; responder pelo próprio provedor, incluindo texto longo/HTML. Confirmar despacho automático e conteúdo completo, sem botão de simulação.
9. **Consulta pública:** consultar a chave e abrir o QR no celular pela URL pública. Conferir CPF/CNPJ mascarados e ausência de notas, corpos e anexos internos nas duas formas de acompanhamento. Testar também documento sigiloso e chave inexistente.

## 7. Evidência de execução local

Arquivos de execução nesta máquina, fora do código da aplicação:

- `C:\Users\trici\AppData\Local\Temp\opencode\rio-azul-audit.cjs`
- `C:\Users\trici\AppData\Local\Temp\opencode\rio-azul-audit-results.json` — 52 verificações, 33 aprovadas / 19 reprovadas.
- `C:\Users\trici\AppData\Local\Temp\opencode\rio-azul-audit-extra.cjs`
- `C:\Users\trici\AppData\Local\Temp\opencode\rio-azul-audit-extra-results.json` — 3 verificações, 1 aprovada / 2 reprovadas.

Os scripts executam e registram verificações com falhas esperadas para diagnóstico; seu código de saída 0 indica execução/limpeza concluída, **não aprovação funcional**. Os resultados individuais `PASS`/`FAIL` e as evidências descritas neste relatório determinam a avaliação.

**Conclusão final:** liberar para ensaio exploratório das telas, com conhecimento das falhas registradas. Para apresentação oficial, corrigir os bloqueadores e repetir os cenários afetados no ambiente SaaS que será mostrado à comissão.
