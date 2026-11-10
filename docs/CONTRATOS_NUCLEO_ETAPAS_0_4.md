# Núcleo 0–4: contratos e migração

Implementado em código em 10/11/2026; **não homologado**. Nenhuma migração, seed ou alteração de dados reais foi executada por este agente. Firebase, Neon e fluxos de tela ainda exigem validação integrada após migração em ambiente próprio. Gov.br, certificados e canais Resend permanecem etapas finais.

## Banco e implantação

1. Fazer backup/snapshot do banco e registrar os totais anteriores (base auditada: 15 usuários, 5 setores, 5 documentos).
2. Aplicar **uma vez** `src/db/migrations/0001_core.sql`, antes de publicar o novo backend, pelo executor `scripts/migrate.ts` (`npm run db:migrate -- --apply --existing-schema` para instalação inicial revisada sobre a base existente). O executor exige Node.js 22+ e `DIRECT_URL`, controla transação, checksum e histórico. Não copiar credenciais para logs.
3. Esta migração adiciona colunas e tabelas, perfis e backfill da participação/índice de identidade. Não apaga usuários, documentos ou cidadãos e não muda UUIDs/números legados. Cadastros de cidadãos preexistentes duplicados são preservados, mas a identidade canônica passa a apontar para um único cadastro.
4. Configurar `DEFAULT_INTAKE_DEPARTMENT_ID` com UUID de um setor ativo. Se ausente, somente um setor cujo nome contenha `protocolo` é utilizado; ausência de ambos retorna 503, impedindo protocolo órfão.
5. Aplicar as migrações dos módulos adicionais na ordem definida por seus respectivos responsáveis; schemas adicionais são independentes de `src/db/schema.ts`.
6. Executar lint/build pela coordenação principal. A checagem TypeScript intermediária não apontou erros nos arquivos do núcleo após correções; havia alterações simultâneas de frontend/módulos ainda sendo concluídas.
7. Validar acesso, criação, tramitação e consulta em homologação. Em rollback de aplicação, manter as colunas/tabelas aditivas. Não executar script destrutivo. Para recuperação de dados, restaurar snapshot em banco separado, conferir integridade e realizar troca controlada.

Migração requer PostgreSQL com `gen_random_uuid()` (já utilizado pelo schema existente). O arquivo SQL não contém `BEGIN/COMMIT` externos: a transação é controlada pelo executor principal, incluindo histórico/checksum. Reaplicação não é procedimento de rollback. A migração inclui `user_profile.phone`.

Verificação final deste agente: `npx tsc --noEmit --pretty false` sem erros em arquivos do núcleo; restavam quatro erros de iteração `Set`/target ES5 em `src/lib/modules/server.ts` (outro responsável). Sete asserções locais de validação/mascaramento CPF/CNPJ passaram, sem acesso ao banco. Não foi executado build completo, conforme divisão de trabalho.

Atualização de integração posterior: ficha completa, CPF/telefone, Minha Conta, paginação de circulares e administração restrita Nível 1 foram implementados sem executar novos lint/tsc/testes nem acessar o banco, conforme orientação da coordenação. A verificação acima refere-se à revisão anterior, não valida automaticamente estes ajustes.

## Identidade e autorização

- Header interno: `Authorization: Bearer <Firebase ID token>`; token revogado/inválido, usuário sem vínculo ou inativo retorna 401.
- Perfil e vínculos setoriais são lidos no banco a cada requisição; claims antigos não concedem privilégios.
- `Session`: `uid`, `userId`, `roles`, `role` (compatibilidade), `departmentId`, `departmentIds`, `email`.
- `requirePerm`, `documentScope`, `canAccessDocument`, `canActInDepartment`, `isRecipient` são compartilháveis pelos módulos.
- Admin Geral administra usuários; isso **não** dá leitura global de documentos. Auditor explicitamente atribuído pode ler globalmente, sem alterações pelo perfil Auditor. Outros perfis veem autoria, destinatário individual e participação setorial; circular restringe leitura à autoria/destinatário/Auditor.
- Nível 3 somente visualiza; não recebe, despacha, anexa ou altera prazo.
- Administração local não gerencia usuários privilegiados nem atribui perfis elevados.
- Nível 1 possui `admin:users` e `admin:departments` sob escopo obrigatório no backend: cadastra/gerencia apenas Nível 2 e Nível 3 em seus setores ativos e descendentes. Não gerencia pares Nível 1, administradores ou auditores; não concede vínculos fora da subárvore. Admin Local pode também atribuir Nível 1. Usuários com vínculos secundários fora da subárvore não podem ser gerenciados pelo administrador restrito.
- Nível 1/Admin Local criam somente subsetores de pais ativos na subárvore autorizada. Edição/desativação/realocação do organograma continuam exclusivas de Admin Geral. A subárvore administrativa **não** amplia acesso documental.
- Auditor recebe `operations:reports`. `operations:export` permanece exclusivo de Admin Geral (`*`); não foi concedido aos demais perfis.
- `GET /api/admin/me`: identidade atual, permissões, setores e ficha funcional. Usar no frontend para refletir mudança de perfil sem renovar token.
- `GET /api/admin/me` também retorna no topo `cpf`, `phone`, `registration`, `position`, `preferences`, `secondaryDepartmentIds`, `leaveStart`, `leaveEnd`, `lastAccessAt`, mantendo `profile`. `PATCH /api/admin/me` aceita **somente** `{phone?,preferences?}` e retorna o mesmo DTO atualizado, com auditoria. Campos desconhecidos ou de privilégio são rejeitados; preferências são mapa de booleanos (máximo 30 chaves). O mapa enviado substitui as preferências anteriores.

## Administração

- `GET /api/admin/users`: restrito a `admin:users`; retorna `users`, `departments`, `roles`.
- Cada usuário inclui também `cpf`, `phone`, `registration`, `position`, `secondaryDepartmentIds`, `leaveStart`, `leaveEnd`, `preferences`, `lastAccessAt`. `roles` da resposta contém apenas perfis atribuíveis pelo ator; usuários privilegiados não são listados para Nível 1/Admin Local.
- `POST /api/admin/users`: `{name,email,departmentId,role,password?}`. Senha opcional com mínimo de 12 caracteres. Cria Firebase desabilitado, grava usuário/perfil/auditoria em batch, habilita Firebase e banco. Retorna `{id,email,firebaseUid,resetLink,credentialStatus,deliveryStatus:"NOT_SENT"}`. Sem senha, administrador entrega link de definição seguro; nenhum e-mail é anunciado como enviado.
- Falha antes de persistir compensa criação Firebase; falha posterior mantém conta SQL inativa e retorna `provisioning_pending_recovery` com ID. Recuperar via PATCH do usuário (`active:true`, `resetPassword:true`). Não vincular UID arbitrário recebido do cliente.
- `PATCH /api/admin/users/:id/role`: `{role}`; troca SQL atômica; `claimSynced:false` não adia autorização efetiva.
- `PATCH /api/admin/users/:id`: `{name?,active?,departmentId?,secondaryDepartmentIds?,registration?,position?,preferences?,leaveStart?,leaveEnd?,resetPassword?}`. Suspensão SQL é imediata e revoga sessões Firebase. Transfere sem apagar histórico.
- POST e PATCH também aceitam `cpf` e `phone`: CPF vazio/null remove o campo; quando informado exige 11 dígitos e verificadores válidos. Telefone aceita formatação comum, normaliza para 10–15 dígitos; vazio/null remove. CPF persiste em `app_user.cpf`, telefone em `user_profile.phone`. POST aceita ainda ficha, preferências, afastamento e vínculos secundários. PATCH valida intervalo de afastamento considerando os valores existentes.
- `GET /api/admin/departments`: `{departments,myDepartmentIds}` para servidores autenticados.
- `POST /api/admin/departments`: `{name,acronym?,parentId?}`.
- `PATCH /api/admin/departments/:id`: `{name?,acronym?,parentId?,active?,reallocateToDepartmentId?}`. Admin Geral; impede ciclos. Desativação exige setor ativo para realocação e tratamento prévio dos filhos; transfere usuários, vínculos secundários e participações abertas, registrando movimento.

## Documentos e numeração

- Novos documentos/protocolos usam `businessCode`/`displayNumber` com **13 dígitos `aaaammddxxxxx`**, data de São Paulo, contador global diário atômico com limite 99999. UUID continua sendo chave interna. Legados continuam usando número anterior.
- Contador anual por tipo é mantido, inicializado a partir do maior número legado. Reservas podem deixar lacunas quando uma criação falha; jamais reutilizam número.
- Criação usa `db.batch` do Neon HTTP: documento, participações, prazos, destinatários, movimento inicial, auditoria e, no protocolo, cidadão/identidade/protocolo/notificação são commitados juntos. Não utiliza transações interativas incompatíveis com o driver.
- `GET /api/documents?q=&type=&status=&departmentId=&page=1&pageSize=30`: busca no escopo autorizado, incluindo protocolos externos. Resposta `documents`, `departments`, `page`, `pageSize`, `total`.
- `POST /api/documents`: `{type:"MEMORANDUM"|"OFICIO"|"OTHER",subject,body,originDepartmentId?,toDepartmentId?,accessLevel?,deadlines?:[{title,dueAt}]}`. Origem deve ser vínculo do ator. HTML aceita formatação estrutural segura, sem scripts/atributos arbitrários.
- `GET /api/documents/:id`: detalhe, timeline ordenada `(createdAt,id)`, prazos, anexos e `participation:[{documentId,departmentId,state,updatedAt}]`.
- `POST /api/documents/:id/forward`: `{departmentId?,toDepartmentId?,toDepartmentIds?,note?}`; exige participação OPEN do setor de origem. Suporta múltiplos destinos, preserva participação histórica.
- `POST /api/documents/:id/receive`: `{departmentId?}`; PENDING → OPEN, evento inclui origem/destino.
- `POST /api/documents/:id/actions?action=conclude|archive|reopen|reply`: `{departmentId?,note?,visibility?:"INTERNAL"|"CITIZEN"}`. Conclusão/arquivo por setor; resposta explícita ao cidadão distinta de nota interna. Transição inválida retorna 409. Informativa não aceita resposta/encaminhamento.
- Upload `POST /api/documents/:id/attachments` multipart `file`, até 10MB, apenas ator com participação ativa; retorna URL da API privada, nunca Blob direto.
- Download `GET /api/attachments/:id` exige Bearer e autorização documental e registra auditoria. **Frontend deve baixar com fetch autenticado e abrir Blob URL**, não usar link cru sem token.

## Calendário e circulares

- `GET /api/deadlines?month=2026-11`: prazos no escopo documental e feriados do mês.
- `POST /api/documents/:id/deadlines`: `{title,dueAt}` ISO datetime.
- `PATCH /api/deadlines/:id`: `{title?,dueAt?,status?:"PENDING"|"COMPLETED"|"CANCELLED"}` com auditoria antes/depois.
- `POST /api/admin/holidays`: `{date:"YYYY-MM-DD",title}` (Admin Geral).
- `GET /api/deadlines/calculate?start=YYYY-MM-DD&days=10`: calcula dias úteis excluindo dia inicial, fins de semana e feriados cadastrados; retorna `dueDate` (data civil).
- Circulares preservam GET/POST anteriores. POST acrescenta `includeSubdepartments?:boolean`. Destinatários são snapshot dos usuários ativos dos setores selecionados e vínculos secundários; rejeita circular sem destinatários.
- `GET /api/circulars?page=1&pageSize=30&q=&urgency=&status=&unread=1`: paginação real (máximo 100 por página), `total` de circulares filtradas, ordem estável `(createdAt DESC,id DESC)`. Busca em assunto, código13 e número legado; aceita `search` como alias de `q`. Escopo e filtro de não lidas são aplicados **antes** da paginação e contagem. `unread=1` significa circular com ao menos um destinatário ativo sem recibo. O `total` de cada circular continua sendo sua população individual única, diferente do `total` da resposta.
- Lista/detalhe contam **usuários únicos**, recibos apenas dessa população. `GET /api/circulars/:id` registra primeira leitura somente quando destinatário; POST `/:id/read` rejeita não destinatário. Unique já existente garante primeira leitura imutável.
- `PATCH /api/circulars/:id/recipients`: `{departmentIds}` permite ao autor atualizar população da circular aberta; reexpande vínculos ativos, cancela antigos sem apagá-los e preserva recibos. Cancelados perdem acesso e saem da contagem; reinclusão mantém primeira leitura histórica.

## Portal e privacidade

- `POST /api/cidadao/requerimentos` mantém campos anteriores e valida dígitos verificadores CPF/CNPJ. Não atualiza cadastro existente por dados anônimos; divergência de e-mail exige confirmação de identidade (409). Índice de identidade evita duplicação concorrente sem apagar legados.
- Novo protocolo: assunto não contém nome do requerente; cria participação pendente no setor receptor. Retorna `protocolNumber`, `publicKey`, `emailStatus:"PENDING"`, `notificationStatus:"AWAITING_CHANNEL_CONFIGURATION"`.
- `GET /api/publico/:key` e `GET /api/cidadao/requerimentos?key=` usam **o mesmo DTO**. Somente classificação PUBLIC é consultável; INTERNAL/CONFIDENTIAL/inexistente retornam 404. Documentos antigos INTERNAL não são reclassificados automaticamente.
- DTO público nunca contém corpo interno, arquivos, e-mail ou nome completo. CPF/CNPJ mascarado; subject/requestType e resposta explicitamente pública têm identificadores redigidos. Notas internas nunca são retornadas.
- Conta externa preparada com Firebase convencional e **e-mail verificado**, sem identidade Gov.br declarada: `GET /api/cidadao/conta` lista protocolos vinculados ao e-mail verificado do token. Cadastro/login/verificação Firebase devem ser conectados pela interface; token de e-mail não verificado não acessa a caixa.
- Caixa pessoal paginada: `GET /api/cidadao/conta?page=1&pageSize=30` retorna `{email,requests,page,pageSize,total}`; máximo 100 por página, ordenação estável por criação/ID. O filtro pelo e-mail verificado aplica-se tanto à contagem quanto à consulta antes do limite/offset.
- `POST /api/cidadao/requerimentos` com header Authorization exige Firebase válido e e-mail verificado; token inválido/não verificado retorna 401, sem degradação para anônimo. E-mail do formulário diferente da sessão retorna 403 `session_email_mismatch`. Quando já há identidade vinculada ao e-mail, CPF/CNPJ diferente retorna 409 `linked_identity_mismatch`; cadastro existente não é sobrescrito. Primeiro cadastro usa o e-mail da sessão. A titularidade da submissão é auditada com UID Firebase, citizenId e modalidade de autenticação (não implica identidade CPF certificada). Sem Authorization, o fluxo anônimo continua permitido e identificado como tal na auditoria.
- `GET /api/documents/:id` inclui `attachments[].citizenVisible` para refletir na tela a liberação de cada anexo ao titular.
- `GET /api/cidadao/requerimentos/:key` autenticado pelo titular retorna descrição original, respostas/complementos liberados e anexos explicitamente autorizados, inclusive quando protocolo não é público. `POST` na mesma rota com `{text}` registra complementação enquanto aberto.
- Titular pode anexar via `POST /api/cidadao/requerimentos/:key/attachments` multipart `file` (10MB) e baixar via `GET /api/cidadao/requerimentos/:key/attachments/:id`. Somente `citizenVisible=true` é retornado; chave pública sozinha não autoriza download.
- Servidor pode alterar liberação de anexo por `PATCH /api/attachments/:id` com `{citizenVisible:boolean}`; autorização setorial e auditoria obrigatórias.

## Limites deste incremento

### Revisão estática de segurança — correções posteriores

- **Administração concorrente:** cadastro, edição, troca de perfil e alterações de organograma compartilham trava transacional PostgreSQL. Dentro do mesmo `db.batch`, após obter a trava, uma segunda instrução reconsulta usuário ativo, perfis, subárvore administrativa, vínculos secundários e destinos ativos antes das gravações. Falha na guarda aborta todo o lote e retorna 409 `authorization_changed`. Não se usa transação interativa Neon HTTP. Nível 1/Admin Local não recebem mais links de recuperação: `resetPassword:true` retorna 403 `self_service_password_reset_required`; o titular deve usar recuperação Firebase na própria interface. Suspensão/ativação restrita é aplicada no SQL, consultado a cada autenticação; desabilitar/reabilitar a conta Firebase é operação de Admin Geral. Uma conta desabilitada no provedor exige reabilitação por Admin Geral.
- **Circular urgente encaminhada:** o encaminhamento bloqueia o documento em uma primeira instrução do lote e, numa segunda instrução com snapshot atualizado, grava participação, expansão dos usuários ativos dos destinos (incluindo vínculos secundários), reativação de destinatários cancelados, movimento e auditoria. Deduplica por usuário e não insere recibos de leitura. Lista/detalhe e autorização reconhecem os novos destinatários. Informativa continua sem encaminhamento/resposta.
- **Consulta pública:** assunto passa a ser neutro (`Requerimento externo` / `Documento público`) e tipo do requerimento é neutro; textos livres e respostas não são publicados nem quando marcados CITIZEN. Histórico público contém somente ação/data. O titular autenticado continua recebendo os textos autorizados. O redator compartilhado também mascara CPF/CNPJ colado a letras e e-mails; ele não é usado como garantia de anonimização de nomes livres.
- **Identidade anônima e autenticada:** ambas passam pela mesma reserva transacional serializada de cadastro. Não se permite associar outro CPF/CNPJ a e-mail já cadastrado nem alterar e-mail de CPF existente; conflitos retornam genericamente 409 `identity_confirmation_required`, sem devolver dados/chaves antigas. Conflitos legados de identidade exigem regularização, não seleção oportunista de um dos cadastros. A reserva de cadastro ocorre antes da criação documental e pode permanecer para repetição segura se a criação falhar; documento/protocolo/prazos/notificação continuam atômicos entre si. E-mail informado anonimamente não é comprovação de titularidade e não dá acesso à caixa ou protocolos anteriores.
- **Anexos:** upload e alteração de `citizenVisible` aceitam qualquer vínculo principal/secundário autorizado com participação OPEN/PENDING em setor ativo do documento; não exigem que esse vínculo seja o setor principal. Permanecem obrigatórios `doc:edit` e acesso documental.

Estas correções foram feitas por revisão estática, sem novos testes, lint, TypeScript, build, migrações ou acesso ao banco.

O código implementado não equivale à homologação de todas as tarefas 0–4: conexão das novas APIs às telas, fluxo de registro/verificação da conta externa, refinamento da ficha pessoal e validação visual/integrada ainda devem ser acompanhados na matriz geral. Eventos de e-mail permanecem pendentes, sem envio real. Build final e roteiros de tela pertencem à coordenação principal.
