# Fechamento complementar — Ouvidoria anônima e contatos

Data: 10/11/2026. Estado: **implementado, contratos e persistência externa testados localmente; validação de telas/homologação integrada pendentes**. A sessão principal informou aplicação de 006/007 e integração dos comandos genéricos. Esta frente não executou build/lint/tsc, acesso a banco remoto, seed, commit ou deploy.

## Fonte conferida

- Plano 0–9, matriz e `src/lib/modules/ENTREGA.md` lidos antes da implementação.
- Edital pp. 77–78, extração `rio-edital-completo.txt`, linhas 4089–4134: a regra é **por perfil de contato externo**, não por cargo/perfil de servidor. Tipos PF/PJ/setor de PJ; campos básicos habilitáveis/obrigatórios; pelo menos um CPF/CNPJ/e-mail/celular; até dez complementares com nome, explicação, formato, canal interno/externo/ambos e obrigatoriedade; listas segmentadas e unificação. Rastreabilidade: `CON-P77-01`, `CON-P78-02`.
- Ouvidoria por chave, complementação/anexos e avaliação: `OUV-P54-01.e`, `OUV-P55-01.a/c/f`. Integrações externas de e-mail continuam na etapa 11.

## Migração exclusiva

**006, 007, 008 e 009 já aplicadas pelo principal: congeladas por checksum.** O incremento externo está em **`src/db/migrations/009_contacts_external.sql`**. Transação de aplicação pertenceu ao executor principal.

**Conciliação local de 006 concluída:** imediatamente antes do aviso de congelamento, esta frente havia acrescentado o SQL externo à 006. Ele foi isolado na 009 e, mediante autorização expressa posterior, a 006 foi restaurada via patch, removendo somente aquelas adições. SHA-256 normalizado CRLF→LF conferiu exatamente com o aplicado: `81887c9e1489f7486001215be90f7084411ed4982bed27b4f094bfd0c2b3fc61`. Nenhum histórico do banco foi modificado. O ensaio PGlite anterior usou os arquivos locais; a conferência do checksum foi uma verificação local separada.

Cria tabelas de operações anônimas idempotentes, perfis, listas, associação explícita a cidadãos legados, unificações e aliases legados. Funções PostgreSQL concentram bloqueios, revalidação, escrita e auditoria numa transação; não simulam transação com chamadas HTTP independentes. Reutiliza os triggers existentes de revisão/snapshot/auditoria. Não altera `modules-schema.ts`.

## Ouvidoria anônima

- Serviço: `src/lib/modules/anonymous.ts`. APIs: `/api/modules/anonymous`, `/api/modules/anonymous/files`, `/api/modules/anonymous/files/[fileId]`. Página: `/gestao/anonimo`.
- Chave de 32 bytes gerada por Web Crypto, representada por 64 caracteres hexadecimais. Persistência somente SHA-256 em `module_anonymous_access`; chave não é URL/query string, UID Firebase, IP, cookie ou identidade fictícia. Mantida em memória no cliente para repetição de criação; usuário precisa guardar a chave. Não há recuperação.
- Assunto explícito dentre fluxos de Ouvidoria ativos com `anonymousEnabled=Sim`. Campos dinâmicos existentes são preservados/validados, sem retornar o workflow interno. Participação inclui setor inicial e Ouvidoria guardiã. Criação gera rascunho; anexos obrigatórios são conferidos transacionalmente na protocolização.
- Criação repetida pela mesma chave/conteúdo retorna o mesmo código; conteúdo divergente conflita. Complementação, protocolização, avaliação e upload usam operação UUID + hash do payload. Repetição idêntica retorna resultado anterior, inclusive com revisão antiga; alteração de payload com mesmo UUID é recusada.
- Respostas: somente mensagens `EXTERNA`. DTO omite identidade, UIDs, responsáveis, participantes, notas internas, referências, assinatura, storage key, hash da chave e snapshots.
- Upload privado limitado a PDF/PNG/JPEG/TXT, 5 MB/arquivo, 20 arquivos e 50 MB por manifestação. Leitura do multipart limitada a 6 MB inclusive em transferência sem Content-Length; assinatura de PDF/imagem conferida. Estado/revisão/limites reavaliados sob bloqueio da manifestação. Arquivos anônimos têm autor interno/externo nulo e `external_visible=true`.
- Download por POST e header `x-anonymous-key`; sempre confere vínculo e visibilidade. Não devolve URL do Blob. Cache desabilitado, attachment e nosniff. Se a resposta se perde depois de iniciar a persistência, o objeto permanece para reconciliação: uma leitura independente não é usada como prova de rollback, pois pode anteceder o COMMIT ainda em andamento.
- Avaliação por chave aceita 1–5, somente estado final e participações da etapa concluídas. Usa `data.evaluation` e `evaluationCycle` existentes; nova nota substitui a corrente, snapshots preservam anteriores. Reabertura continua sob comando interno existente.
- Protocolização anônima agora utiliza `workflowDeadline(hours,businessDays,departments)` de `business-hours.ts`, incluindo os expedientes configurados na 007, no mesmo contrato dos fluxos autenticados.

## Contatos: telas e serviços

- Serviço: `src/lib/modules/contacts.ts`.
- `/gestao/contatos`: DataTable de 20 linhas, filtros perfil/tipo/lista, criação, importação/exportação, listas, perfis e unificação.
- `/gestao/contatos/novo`, `/gestao/contatos/cadastro/[id]`: edição dedicada, revisão otimista, máscaras fiscais/CEP/telefone, campos conforme perfil, vínculo explícito com cidadão legado e acesso ao histórico.
- `/gestao/contatos/perfis`: configuração por Admin Geral, tipos, campos básicos habilitáveis/obrigatórios e até dez complementares. Revisão/auditoria integral das configurações.
- `/gestao/contatos/segmentos`: listas setoriais com seleção de contatos, busca e seleção paginada em 20. APIs revalidam escopo dos membros; listas de outro setor não são retornadas.
- `/gestao/contatos/unificar`: origem/principal e contagens retornadas. Original não é excluído, dados cadastrais do principal prevalecem.
- APIs `/api/modules/contatos`, `/{id}`, `/{id}/legado`, `/unificar`, `/perfis`, `/perfis/{id}`, `/perfis/publicos`, `/segmentos`, `/segmentos/{id}`. Endpoints internos usam sessão/permissão real e setores atuais. Endpoint público devolve apenas definições ativas e complementares externos/ambos, nenhum contato.
- `validateContactProfile(profile,type,values,channel,previous)` é o contrato reutilizável de validação por canal. A tela dedicada usa `INTERNO`. Dados adicionais existentes em `data`, `values`, referências e snapshots são conservados. Edição dedicada não substitui o JSON inteiro por um esquema reduzido.
- Unicidade de CPF/CNPJ/e-mail/celular normalizados é conferida sob bloqueio na gravação dedicada. Contatos antigos/importados sem perfil continuam legíveis.
- Importação CSV dedicada exige perfil/revisão, aplica validação por canal interno e unicidade transacional; até 100 linhas com resultado individual. UUID por linha + hash preservam repetição idempotente do lote. `/api/modules/contatos/import` agora recebe `{profileId,profileRevision,rows}`; a página `/gestao/contatos/importar` já usa esse contrato.

## Unificação: referências realmente reescritas

Uma única função `modules_merge_contacts` bloqueia/revalida origem e principal, atualiza referências correntes e listas, reescreve vínculos legados associados, incrementa revisões e dispara snapshots/auditoria. Resultado: `records`, `segments`, `legacyLinks`, `externalRequests`, `citizenIdentities`.

Referências atuais suportadas, sempre por igualdade exata do UUID (nunca busca/substituição em texto):

- `data.linkedIds`, `data.refs` (UUIDs ou objetos com `id`/`recordId`/`moduleId`), `contactIds`, `contactId`, `contatoId`, `contatos`.
- Valores tipados/legados contendo o UUID: `destinatario`, `outorgante`, `outorgado`, `organizacao`, `proprietario`, `responsavel`, `candidato`, `autor`, `cadastroPrincipal`.
- Membros de `module_contact_segment` com deduplicação.
- Associações explícitas `module_contact_legacy`. Quando ambas as partes têm cidadão associado, reescreve `external_request.citizen_id` e `citizen_identity.citizen_id` para o cidadão principal. Só aceita identidades fiscais idênticas; não transfere uma identidade autenticada por semelhança de nome/e-mail. Quando só a origem tem cidadão, mantém esse cidadão e associa-o ao contato principal, sem fabricar outro cadastro.
- Triggers canonicalizam referências estruturadas posteriores e novas referências legadas, evitando reintroduzir o identificador aposentado. Cadeias de unificação são preservadas.
- Fonte previamente marcada `UNIFICADO` pela implementação antiga pode ser reparada via API se aponta exatamente para o principal solicitado e ainda não tem registro na nova tabela de unificação. O trigger bloqueia o antigo comando isolado `UNIFICAR_CONTATO`, que apenas criava uma referência sem transferir vínculos.

**Preservação:** `module_version`, `audit_log`, originais, mensagens, conteúdo textual, blocos, identidade, avaliação, assinatura e snapshots de publicação não são reescritos. Cadastro origem permanece `UNIFICADO`. Referência atual fora do snapshot em um registro `PUBLICADO` impede a operação inteira, sem sucesso parcial. Referências em campos livres arbitrários não são inferidas por nome ou conteúdo; esquemas novos precisam registrar a chave estruturada em `modules_contact_refs`.

## Integração externa concluída — incremento 009

- `/cidadao/conta/cadastro`, acessível por Minha conta e Portal, consulta perfis públicos e renderiza PF/PJ/setor, campos básicos habilitados/obrigatórios e somente complementares `EXTERNO`/`AMBOS`. `ContactProfileFields.tsx` reutiliza MaskedInput e busca de CEP com confirmação/edição manual do endereço.
- `/api/cidadao/conta/cadastro` GET/POST exige sessão Firebase real com e-mail confirmado. `src/lib/citizen-contact.ts` carrega perfil atual, valida revisão, aplica `validateContactProfile(...,"EXTERNO",previous)` e rejeita campos reservados/desconhecidos e e-mail divergente. O contrato puro está em `contact-profile.ts`, compartilhado também com o serviço interno.
- A função `modules_external_contact_save` da 009 grava cidadão, identificação fiscal, contato, vínculo legado, UID titular, versões e auditoria em uma transação. Revalida perfil/revisões/titular, bloqueia duplicação ou apropriação por CPF/e-mail, preserva nome/CPF existentes, não inventa usuário interno e conserva JSON/referências/campos internos anteriores.
- O vínculo fiscal exige CPF/CNPJ válido no servidor, igualdade com o cadastro legado e `citizen_identity` correspondente. E-mail é o confirmado da sessão. **Isto não é prova de titularidade fiscal emitida por Gov.br, RFB ou ICP-Brasil**; divergências exigem conciliação pelo atendimento. Perfil com apenas e-mail pode criar contato sem fabricar CPF ou linha vazia de identidade fiscal.
- Contatos externos novos são recebidos no setor ativo do servidor que configurou o perfil, mantendo autoria externa real. Sem setor ativo, criação aborta integralmente com erro de configuração.
- `module_contact_account` vincula UID/cidadão/contato com unicidade. Caixa e arquivos do cidadão respeitam esse titular quando o vínculo existe. Mudança de e-mail ou nova conta com mesmo e-mail não reassocia automaticamente o cadastro. Unificação preserva o vínculo da conta única e aborta se existirem titulares distintos; o trigger da 009 faz parte da transação de unificação.
- Quando há perfil ativo ou conta já vinculada, o protocolo exige o cadastro confirmado e revalida os campos externos obrigatórios do perfil atual. Usa os dados do cidadão vinculado, não uma identidade recebida por JSON. Sem perfis configurados e sem conta vinculada, conserva o cadastro legado existente. O portal apresenta o atalho ao cadastro por perfil e evita exigir novamente campos desabilitados.

## Integração pendente — tarefas exatas da sessão principal

1. Restauração/checksum da 006 e aplicação da 009 concluídos. Executar o aceite visual/integrado final; migrações aplicadas permanecem congeladas.
2. Principal informou concluídos `createRecord(contatos) → saveContact`, `EDITAR`/`UNIFICAR_CONTATO` → serviços dedicados e links do detalhe. Esta frente não editou `server.ts`, `Form.tsx` nem o detalhe compartilhado.
3. Consumidores adicionais da importação, caso existam, usam `{profileId,profileRevision,rows}`. Página e API desta frente já integradas.
4. Relatórios de avaliação devem usar nota corrente por manifestação/ciclo, incluindo registros sem UID, sem somar snapshots históricos.
5. Reconciliação operacional de Blob deve comparar storage key com `module_file` antes de remover objetos de upload cujo resultado de COMMIT ficou incerto.

**Não resta integração de campos por perfil pendente no cadastro cidadão desta frente.** Ativação depende da 009 e do aceite integrado.

## Testes locais executados nesta rodada

- `npx tsx --test src/lib/modules/contact-profile.test.ts`: **5 testes passaram**. Cobrem canal externo, preservação dos internos/JSON legado, recusa de alteração/remoção de campo interno ou desabilitado, formatos/obrigatoriedade/tipo de contato, limite de dez campos, duplicação de chaves e identificador mínimo. Arrays heterogêneos foram explicitamente tipados como `Record<string,string>[]` após o diagnóstico TypeScript do principal.
- `node C:/Users/trici/AppData/Local/Temp/opencode/modules-db-validation/verify-contacts-external.mjs`: **6 grupos passaram**, PostgreSQL WASM/PGlite em memória, sem ambiente/cliente remoto. Migrações reais 002/005/006 local/009, reaplicação 009, cidadão+contato+vínculos atômicos, autoria externa e setor real, rollback de revisão/CPF/e-mail/UID/perfil, preservação de JSON/histórico, perfil só e-mail e recusa de apropriação silenciosa de contato legado.
- O principal informou harness integrado com 163 aprovações, incluindo criação/protocolização anônima; esse resultado é atribuído ao principal, não a uma execução desta frente. Compilação final e upload/avaliação adicionais continuam na validação coordenada.

### Roteiro externo para aceite em tela

1. Após 009, configurar perfil com campo interno sigiloso, externo obrigatório e ambos, CPF/CEP/telefone mascarados; configurar usando servidor com setor ativo.
2. Criar conta real, confirmar e-mail, abrir Minha conta → Meu cadastro por perfil. Conferir ausência do campo interno, preenchimento externo obrigatório, busca CEP, gravação e reabertura sem perda.
3. Tentar por API injetar campo interno/reservado, mudar e-mail/CPF existente, reutilizar revisão antiga e usar outro UID com o mesmo e-mail: negar sem gravações parciais ou exposição do cadastro.
4. Abrir protocolo a partir da conta; conferir identidade/contato vinculados. Acrescentar campo externo obrigatório ao perfil e tentar novo protocolo antes de completar: recusar e encaminhar ao cadastro.
5. Conferir contato na lista do setor configurador, campo interno preenchido por servidor preservado após edição externa e ausência desse campo no GET externo.
6. Legado de mesmo CPF/e-mail com associação explícita pode ser vinculado à conta; CPF com outro e-mail ou contato duplicado sem associação exige atendimento. Perfil só e-mail não cria CPF fictício.
7. Unificar origem com uma conta vinculada e principal compatível: manter acesso do mesmo UID; duas contas distintas devem abortar a união inteira.
8. Protocolar manifestação anônima em expediente com feriado/fim de semana e conferir prazo calculado pelo mesmo `workflowDeadline` dos processos autenticados.

## Roteiro final concentrado (a executar pelo principal)

1. Aplicar/reaplicar 006 em banco local descartável; confirmar triggers e funções, rollback sem versões órfãs e preservação de 0001–005.
2. Sem login, selecionar assunto, preencher campos dinâmicos, criar rascunho e repetir criação; mesmo código. Guardar chave; tentar outra chave e verificar resposta sem dados.
3. Impedir protocolização sem categoria obrigatória; enviar arquivo permitido, repetir mesmo UUID/conteúdo, tentar UUID reutilizado divergente, arquivo excessivo e MIME incompatível. Concorrer upload com conclusão: somente estado autorizado pode persistir. Conferir autor nulo, bytes íntegros e nenhuma duplicação.
4. Inserir nota interna e arquivo não liberado pelo servidor; conferir ausência no READ e recusa de download por chave. Resposta externa e arquivo liberado devem aparecer.
5. Concluir participações e decisão; avaliar, reabrir, concluir e reavaliar. Conferir nota corrente/substituição e histórico. Tentativa em andamento ou com setor pendente deve falhar.
6. Criar perfil PF/PJ/setor, dez complementares e tentar o décimo primeiro; tipos, máscaras, canal, obrigatório/desabilitado, revisão concorrente e Admin × Nível 3. Conferir JSON dinâmico desconhecido preservado após editar.
7. Listas em dois setores, filtros, membros e permissão negativa. Unificar contato utilizado em duas listas, ofício/procuração/organização e linkedIds/refs; contar antes/depois e conferir revisão/auditoria de cada registro afetado.
8. Associar dois cidadãos legados de mesma identidade fiscal, requerimentos e citizen_identity; unificar e comprovar FKs reescritas, cidadãos originais preservados, novos vínculos canonicalizados. Identidades fiscais diferentes devem abortar tudo. Cadastro sem associação não deve ser unido automaticamente por e-mail/nome.
9. Reparar união antiga por API, repetir operação, tentar ciclo, principal já unificado, revisão antiga, referência publicada e gravação concorrente de vínculo. Nenhum rollback pode deixar lista, documento ou versão parcialmente alterados.
10. Validar visualmente DataTables/20 linhas/ações/filtros em viewport completo e páginas Next 15 com params Promise/hook.

**Este documento substitui somente as lacunas específicas de anexos/avaliação anônima e backend/telas dedicadas de contatos do registro histórico `ENTREGA.md`; não declara as etapas 0–9 integralmente homologadas.**

## Harness HTTP próprio de contatos

`scripts/validate-contacts.ts` usa HTTP, autenticação Firebase real e SQL. Exige `--allow-write` e `--base`; aceita `--admin-uid`, `VALIDATION_ADMIN_UID`/`SERVICE_ADMIN_UID`, ou `--resolve-admin-from-db` explícito. A resolução usa a mesma consulta do helper principal (Admin Geral ativo, UID não nulo, ordem por ID); confirma depois a associação exata UID/usuário/perfil no banco antes de autenticar.

```powershell
node --env-file=.env.local --import tsx scripts/validate-contacts.ts --allow-write --base http://localhost:3300 --resolve-admin-from-db
```

- Cria dois setores, dois administradores internos próprios e duas contas externas próprias com `emailVerified=true` exclusivamente para o ensaio. O administrador preexistente só autoriza a criação inicial; não é alterado, suspenso ou apagado pelo harness.
- Exercita perfis de dez campos, recusa do décimo primeiro, projeção pública, contatos, revisão, isolamento setorial, listas, importação idempotente, cadastro externo, máscaras/formatos no servidor, preservação de campos internos, vínculo fiscal, unificação de referências atuais/legadas, deduplicação e histórico original.
- Manifesto privado recuperável em `%LOCALAPPDATA%/Temp/opencode/contacts-<runId>`. Evidência redigida contém apenas rótulos, status e categorias de diagnóstico; nunca tokens, e-mails, CPF, respostas completas ou parâmetros SQL.
- Teardown restrito aos IDs do manifesto e dependentes conhecidos, incluindo tabelas de 006/009. Audits permanecem no banco; originais e versões próprios são arquivados com AES-256-GCM antes da remoção. Suspensão dos gatilhos conhecidos ocorre somente dentro da mesma transação com locks exclusivos; rollback restaura o estado, e os gatilhos são conferidos ao final.
- Retomada de limpeza: mesmos flags e ambiente, acrescentando `--resume-cleanup CAMINHO_DO_MANIFESTO`. Fingerprint do banco, projeto Firebase e base devem corresponder; falha de FK ou relação desconhecida aborta a transação.
- Rodada inicial em `3100`: 19 verificações passaram, leitura HTTP de contato retornou 500 e interrompeu o setup; limpeza integral confirmou sucesso. Manifesto/evidência: `contacts-7aff910c-56c7-4b2a-be2f-b91be08763b9`. Nova rodada foi direcionada para `3300` após disponibilização do build de produção pelo principal.
- Rodada `contacts-e3a639b8-f4ad-4935-ab1e-d7a308dccb60`: 79 verificações passaram antes da falha de teardown SQL 23503. Recuperação incluiu `operation_participation_history` (008), arquivamento dos históricos próprios e suspensão/restauração transacional de seu gatilho imutável, sob lock exclusivo. SQL foi removido integralmente; na primeira retomada, a resolução do administrador selecionou uma conta temporária e a proteção de titularidade impediu sua exclusão Firebase. A resolução em retomadas agora exclui UIDs do manifesto. Segunda retomada concluiu: **94 PASS acumulados, 2 FAIL históricos preservados, `cleaned=true`, `recovered=true`, saída 0**. Nenhuma aprovação ou falha anterior foi apagada.
- A tentativa seguinte (`contacts-369f88a0-3a03-4985-b493-eaa665f08967`) ocorreu durante indisponibilidade da porta 3300: confirmação local sem autenticação retornou `ECONNREFUSED`. Nenhum recurso de ensaio foi criado; manifesto terminou `cleaned=true`. O diagnóstico do harness agora distingue falha de rede e códigos Firebase sem registrar mensagens sensíveis. A tentativa de iniciar `npm start` encontrou a porta já ocupada quando o servidor foi restabelecido; nenhum segundo servidor foi iniciado.
- **Rodada completa final aprovada em `http://localhost:3300`: 86 PASS, 0 FAIL, `cleaned=true`, saída 0.** Evidências privadas: `%LOCALAPPDATA%/Temp/opencode/contacts-cb21bb49-e58f-46e0-b5cb-6a0ce1cd5dbe`. Inclui cenários HTTP/Firebase/SQL de perfis, contatos, segmentos, cadastro externo, importação idempotente e unificação legada, além do teardown com 008/009 e conferência dos gatilhos restaurados. Contas Firebase próprias removidas; auditorias permanecem e histórico próprio foi arquivado cifrado.
- Precisão do aceite: cenários de revisão antiga para segmento, contato e unificação aceitam a recusa SQL traduzida atualmente como HTTP 500, conferindo também persistência/ausência de sobrescrita. O harness registra esse status explicitamente; a aprovação desses casos significa proteção de estado, não comprovação de tradução HTTP 409. Esta rodada não alterou bibliotecas de aplicação para mudar essa classificação.
