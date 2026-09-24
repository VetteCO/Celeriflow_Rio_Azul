# Celeriflow_Rio Azul
## Checklist e plano de desenvolvimento para a POC — Pregão Eletrônico nº 60/2026

> **Objetivo deste documento**  
> Definir um software novo, enxuto e dedicado ao certame de Rio Azul/PR, evitando carregar a complexidade do CeleriFlow completo. O foco inicial é **atender 100% dos cenários exigidos na POC**, embora a retificação exija apenas 70% para aprovação. Depois da POC, o sistema deverá evoluir para os 100% dos requisitos funcionais, técnicos e legais exigidos na implantação.

---

## 1. Base documental utilizada

Este plano foi construído a partir dos documentos do Pregão Eletrônico nº 60/2026, principalmente:

- **Termo de Referência**, especialmente:
  - item 7.3.1 — Demonstração Técnica / POC;
  - página 8 — roteiro dos três cenários da POC;
  - itens 8.1 a 8.4 — implantação, parametrização, treinamento e suporte;
  - itens 12.2.2.1 a 12.2.2.4 — LGPD, SLA, documentação técnica e segurança/nuvem;
  - itens 14.1 a 14.10 — obrigações da contratada.
- **1º Edital Retificador**, que alterou a aprovação da POC para **mínimo de 70% dos macro-requisitos** e transferiu a comprovação integral de 100% dos requisitos para a fase de implantação/parametrização.
- **Estudo Técnico Preliminar**, especialmente fiscalização de SLA, suporte presencial e capacitação.

### Regras objetivas da POC

- POC **presencial**.
- Convocação da primeira colocada.
- Prazo de até **5 dias úteis** a partir da convocação para disponibilizar o ambiente e apresentar.
- Duração máxima da apresentação: **2 horas**.
- Execução **ao vivo** dos fluxos em um sistema SaaS/nuvem.
- Comissão registra **ATENDE / NÃO ATENDE**.
- A retificação exige **no mínimo 70%** dos macro-requisitos da POC.
- Estratégia deste projeto: **não trabalhar para 70%; trabalhar para 9/9 requisitos**.

---

# 2. Estratégia do produto

## 2.1. Nome do projeto

**Celeriflow_Rio Azul**

## 2.2. Princípio de desenvolvimento

O novo software deve ser construído como uma aplicação independente, enxuta e objetiva, contendo apenas a infraestrutura e os módulos necessários para:

1. passar na POC;
2. permitir evolução rápida para os requisitos integrais do contrato;
3. não herdar menus, entidades, regras ou complexidade desnecessária do CeleriFlow municipal completo.

### Não fazer nesta primeira etapa

- não copiar todo o ERP municipal;
- não criar módulos tributário, saúde, educação, RH, patrimônio etc.;
- não criar cadastros sem relação com os fluxos documentais de Rio Azul;
- não criar dashboards decorativos;
- não criar funcionalidades falsas ou apenas visuais para itens da POC;
- não usar botões de integração sem fluxo técnico real por trás.

---

# 3. Escopo mínimo do Celeriflow_Rio Azul para a POC

A aplicação deve conter **8 blocos funcionais**:

1. **Autenticação, usuários e permissões**
2. **Organograma / setores**
3. **Núcleo documental e workflow**
4. **Memorando eletrônico**
5. **Circular eletrônica e confirmação de leitura**
6. **Área externa / protocolo do cidadão**
7. **Comunicação por e-mail com captura automática de resposta**
8. **Consulta pública por QR Code / chave pública + LGPD**

---

# 4. Checklist oficial da POC

## Cenário 1 — Segurança, Acessos e LGPD

### POC-01 — Usuários e níveis de acesso

**Exigência do TR:** criar um usuário servidor e demonstrar segmentação de permissões por níveis, por exemplo Administrador Geral versus usuário de nível 3 apenas para visualização.

### Checklist

- [ ] Cadastro de usuário interno.
- [ ] Cadastro de setor/lotação do usuário.
- [ ] Perfil **Administrador Geral**.
- [ ] Perfil **Visualização / Nível 3**.
- [ ] Permissões por ação: visualizar, criar, editar, tramitar, assinar, administrar.
- [ ] Bloquear ações não autorizadas no backend, não apenas esconder botões.
- [ ] Tela para administrador alterar perfil/permissões.
- [ ] Log de criação e alteração de usuários.
- [ ] Teste: usuário somente leitura tenta criar/editar/tramitar e recebe bloqueio.

**Definition of Done da POC**

- Um administrador cria um usuário durante a apresentação.
- O usuário recebe perfil restrito.
- A comissão visualiza claramente a diferença entre os dois perfis.

**Complexidade:** baixa/média.  
**Risco:** baixo.

---

### POC-02 — Autenticação avançada

**Exigência do TR:** demonstrar possibilidade de login integrado via **Gov.br OU Certificado Digital ICP-Brasil (e-CPF)**.

### Estratégia

Implementar **um dos dois caminhos de forma funcional** antes da POC. Não é necessário desenvolver os dois para o roteiro, pois o texto usa “ou”.

### Checklist

- [ ] Escolher o método principal: **Gov.br** ou **ICP-Brasil e-CPF**.
- [ ] Criar adapter/provider isolado para autenticação externa.
- [ ] Implementar retorno autenticado para a aplicação.
- [ ] Vincular CPF autenticado a uma conta do sistema.
- [ ] Registrar evento de autenticação externa no log.
- [ ] Tratar cancelamento, erro e usuário não vinculado.
- [ ] Criar ambiente de homologação/teste utilizável na apresentação.

**Definition of Done da POC**

- Usuário inicia autenticação externa.
- O processo de autenticação efetivamente ocorre.
- O usuário retorna ao Celeriflow_Rio Azul autenticado e identificado.

**Complexidade:** alta.  
**Risco:** alto — dependência de credenciais/integração externa.

> **Decisão recomendada:** este item deve ser iniciado imediatamente. Se a integração Gov.br depender de credenciamento incompatível com o prazo, avaliar tecnicamente o caminho ICP-Brasil e-CPF com maior chance de demonstração real.

---

### POC-03 — Mascaramento LGPD

**Exigência do TR:** ocultar partes críticas do CPF/CNPJ em telas públicas de consulta.

### Checklist

- [ ] Função central de mascaramento de CPF.
- [ ] Função central de mascaramento de CNPJ.
- [ ] Nunca enviar CPF/CNPJ completo para página pública quando não necessário.
- [ ] Aplicar máscara em consulta pública por chave.
- [ ] Aplicar máscara em consulta por QR Code.
- [ ] Testes automatizados com CPF e CNPJ.

**Exemplos de apresentação**

- CPF: `***.123.456-**`
- CNPJ: `**.***.123/0001-**`

**Complexidade:** baixa.  
**Risco:** baixo.

---

# Cenário 2 — Fluxo Documental de Comunicação Interna

## POC-04 — Abertura de Memorando

**Exigência do TR:** elaborar memorando pelo editor de texto da plataforma, vincular múltiplos prazos em calendário e gerar numeração automática e sequencial.

### Checklist

- [ ] Módulo **Memorandos**.
- [ ] Editor rich text.
- [ ] Assunto.
- [ ] Corpo do documento.
- [ ] Remetente/setor de origem automático.
- [ ] Destinatário/setor.
- [ ] Número sequencial automático.
- [ ] Ano da numeração.
- [ ] Múltiplos prazos vinculados ao memorando.
- [ ] Exibição dos prazos em componente de calendário/lista.
- [ ] Status: rascunho, aberto, em tramitação, concluído, arquivado.
- [ ] Anexos.
- [ ] Histórico de alterações.

### Regra sugerida de numeração

`MEM-000001/2026`

A sequência deve ser transacional e não permitir duplicidade.

**Definition of Done da POC**

- Criar memorando ao vivo.
- Informar pelo menos dois prazos.
- Salvar.
- Mostrar número sequencial gerado automaticamente.

**Complexidade:** média.  
**Risco:** baixo/médio.

---

## POC-05 — Tramitação e linha do tempo

**Exigência do TR:** despachar o memorando para outro setor do organograma e exibir o histórico em linha do tempo cronológica.

### Checklist

- [ ] Cadastro de secretarias/setores/subsetores.
- [ ] Tramitação origem → destino.
- [ ] Campo de despacho.
- [ ] Data/hora automática.
- [ ] Usuário responsável pela ação.
- [ ] Registro do setor de origem e destino.
- [ ] Linha do tempo em ordem cronológica.
- [ ] Eventos mínimos:
  - criação;
  - edição relevante;
  - envio;
  - recebimento;
  - leitura;
  - despacho;
  - assinatura;
  - conclusão/arquivamento.
- [ ] Log imutável das ações relevantes.

**Definition of Done da POC**

- Memorando criado no setor Administração.
- Despachado para outro setor.
- Usuário do setor de destino visualiza/recebe.
- Linha do tempo mostra toda a sequência com usuário, setor, data e hora.

**Complexidade:** média.  
**Risco:** baixo/médio.

---

## POC-06 — Circular para múltiplos setores + rastreabilidade de leitura

**Exigência do TR:** criar Circular “Urgente” ou “Meramente Informativa”, enviar simultaneamente para múltiplos subsetores e comprovar a data/hora exata em que **cada servidor** leu a Circular.

### Checklist

- [ ] Módulo **Circulares**.
- [ ] Tipo: Urgente / Meramente Informativa.
- [ ] Seleção múltipla de setores/subsetores.
- [ ] Seleção/expansão dos usuários destinatários.
- [ ] Envio único para vários destinatários.
- [ ] Registro individual de destinatário.
- [ ] Evento de primeira leitura por usuário.
- [ ] Data/hora exata da primeira leitura.
- [ ] Não sobrescrever a primeira leitura.
- [ ] Tela de acompanhamento:
  - destinatário;
  - setor;
  - status lido/não lido;
  - data/hora de leitura.
- [ ] Filtro “não lidos”.
- [ ] Auditoria do envio.

**Definition of Done da POC**

- Criar Circular Urgente.
- Selecionar pelo menos três setores/subsetores.
- Abrir a Circular com usuários diferentes.
- Voltar ao administrador e mostrar a data/hora individual de leitura de cada servidor.

**Complexidade:** média/alta.  
**Risco:** médio.

---

# Cenário 3 — Experiência e Interação com Usuário Externo

## POC-07 — Área externa + protocolo + busca automática de CEP

**Exigência do TR:** simular cidadão acessando área externa, realizar cadastro facilitado por busca automática de CEP e abrir requerimento.

### Checklist

- [ ] Portal público separado da área administrativa.
- [ ] Cadastro de cidadão.
- [ ] Nome.
- [ ] CPF/CNPJ.
- [ ] E-mail.
- [ ] Telefone.
- [ ] CEP.
- [ ] Consulta automática de CEP.
- [ ] Preencher logradouro, bairro, cidade e UF automaticamente.
- [ ] Número/complemento preenchidos pelo usuário.
- [ ] Cadastro de assunto/tipo de requerimento.
- [ ] Formulário de requerimento.
- [ ] Anexos.
- [ ] Geração automática de protocolo.
- [ ] Chave pública de acompanhamento.
- [ ] Confirmação por e-mail.

**Definition of Done da POC**

- Abrir janela anônima.
- Cadastrar cidadão.
- Digitar CEP e demonstrar preenchimento automático.
- Abrir requerimento.
- Exibir número/chave do protocolo.

**Complexidade:** média.  
**Risco:** baixo/médio.

---

## POC-08 — Captura automática de resposta por e-mail

**Exigência do TR:** o sistema envia uma notificação ao cidadão; quando o cidadão responde diretamente pelo seu provedor de e-mail, a resposta deve ser anexada automaticamente dentro do processo em formato de despacho.

### Este é o requisito técnico mais crítico da POC.

### Fluxo obrigatório

1. Celeriflow_Rio Azul gera mensagem vinculada ao processo.
2. Cidadão recebe a mensagem em provedor externo real.
3. Cidadão clica em **Responder** no Gmail/Outlook/etc.
4. A resposta é recebida pelo backend.
5. Backend identifica o processo correto.
6. Corpo da mensagem é extraído.
7. Anexos são armazenados, quando houver.
8. Sistema cria automaticamente um novo **despacho externo recebido**.
9. Linha do tempo registra o evento.
10. Servidor visualiza a resposta sem intervenção manual.

### Arquitetura sugerida

Usar endereço de resposta tokenizado, por exemplo:

`processo+<token>@respostas.dominio.com.br`

ou

`reply+<token>@respostas.dominio.com.br`

### Checklist

- [ ] Serviço de envio SMTP/API.
- [ ] Domínio/subdomínio de e-mail configurado.
- [ ] Endpoint/webhook de e-mail recebido.
- [ ] Token não previsível ligado ao processo.
- [ ] Validação do remetente quando aplicável.
- [ ] Parser de texto e HTML.
- [ ] Tratamento de quoted text / assinatura de e-mail.
- [ ] Upload de anexos recebidos.
- [ ] Criação automática de despacho.
- [ ] Registro de data/hora/remetente/message-id.
- [ ] Idempotência para não duplicar a mesma mensagem.
- [ ] Tela de histórico do e-mail recebido.
- [ ] Log técnico de sucesso/erro.

**Definition of Done da POC**

- E-mail sai do sistema.
- É recebido em caixa real.
- Cidadão responde pela caixa real.
- Resposta aparece automaticamente no processo durante a apresentação.

**Complexidade:** alta.  
**Risco:** alto.  
**Prioridade:** P0.

---

## POC-09 — Consulta pública por QR Code ou chave pública

**Exigência do TR:** consultar documento externo por leitura de QR Code ou inserção de chave pública, mantendo o sigilo conforme LGPD.

### Checklist

- [ ] Gerar chave pública aleatória para documento/processo.
- [ ] URL pública de consulta.
- [ ] QR Code apontando para a URL pública.
- [ ] Campo para digitação manual da chave.
- [ ] Página pública sem autenticação.
- [ ] Mostrar apenas dados autorizados.
- [ ] CPF/CNPJ mascarado.
- [ ] Não expor anexos sigilosos.
- [ ] Status do documento/processo.
- [ ] Data de criação.
- [ ] Histórico público limitado.
- [ ] Validação de chave inexistente/expirada/revogada.

**Definition of Done da POC**

- Gerar documento/protocolo.
- Exibir QR Code.
- Ler QR Code pelo celular ou abrir URL.
- Demonstrar mesma consulta digitando a chave pública.
- Dados pessoais aparecem mascarados.

**Complexidade:** baixa/média.  
**Risco:** baixo.

---

# 5. Matriz de prioridade

| Prioridade | Item | Motivo |
|---|---|---|
| **P0** | Captura automática de resposta por e-mail | Maior risco técnico e depende de infraestrutura externa |
| **P0** | Gov.br ou ICP-Brasil | Integração externa e possível dependência de credenciamento |
| **P0** | Circular + leitura individual | Regra específica da POC que não pode ser apenas simulada |
| **P1** | Núcleo documental + Memorando | Base do cenário 2 |
| **P1** | Workflow + linha do tempo | Base estrutural da POC |
| **P1** | Portal externo + protocolo + CEP | Base do cenário 3 |
| **P1** | QR Code / chave pública | Simples, mas obrigatório para fechar cenário 3 |
| **P1** | RBAC | Base do cenário 1 |
| **P2** | Mascaramento LGPD | Baixa complexidade |
| **P2** | Dados de demonstração e roteiro | Necessário para apresentação fluida |
| **P2** | Polimento visual | Fazer somente depois dos fluxos funcionarem |

---

# 6. Arquitetura técnica sugerida

> **Observação:** a arquitetura abaixo é uma recomendação de desenvolvimento e não uma tecnologia imposta pelo TR.

## Aplicação

- **Next.js + TypeScript**
- Aplicação única com áreas:
  - `/admin`
  - `/servidor`
  - `/cidadao`
  - `/publico`
- API no mesmo projeto inicialmente para reduzir complexidade operacional.

## Banco

- **PostgreSQL**
- ORM: Prisma
- Migrations versionadas.

## Arquivos

- Object Storage compatível com S3.
- Metadados no PostgreSQL.
- Nunca armazenar documentos grandes diretamente no banco.

## E-mail

- Serviço com capacidade de:
  - envio;
  - recebimento inbound;
  - webhook/API;
  - anexos;
  - message-id.

## Segurança

- HTTPS obrigatório.
- Hash seguro de senha.
- Sessões seguras.
- RBAC validado no backend.
- Logs de auditoria.
- Chaves públicas aleatórias e não sequenciais.
- Dados públicos separados dos dados internos.

---

# 7. Modelo de dados mínimo

## Organização

### `Organization`
- id
- name
- cnpj

### `Department`
- id
- parentId
- name
- acronym
- active

## Usuários

### `User`
- id
- name
- cpf
- email
- passwordHash / externalAuthId
- departmentId
- active

### `Role`
- id
- name

### `Permission`
- id
- code

### `UserRole`
- userId
- roleId

## Cidadão

### `Citizen`
- id
- name
- cpfCnpj
- email
- phone
- cep
- street
- number
- complement
- district
- city
- state

## Documento/processo

### `Document`
- id
- type: MEMORANDUM / CIRCULAR / EXTERNAL_REQUEST / DISPATCH / OTHER
- number
- year
- subject
- body
- status
- accessLevel
- originDepartmentId
- createdById
- createdAt
- publicKey

### `DocumentDeadline`
- id
- documentId
- title
- dueAt
- status

### `DocumentRecipient`
- documentId
- departmentId
- userId opcional
- recipientType

### `DocumentReadReceipt`
- documentId
- userId
- firstReadAt
- lastReadAt opcional

### `DocumentMovement`
- id
- documentId
- fromDepartmentId
- toDepartmentId
- action
- note
- actorUserId
- createdAt

### `Attachment`
- id
- documentId
- filename
- mimeType
- storageKey
- size
- createdAt

## Protocolo externo

### `ExternalRequest`
- id
- citizenId
- documentId
- protocolNumber
- publicKey
- requestType
- createdAt

## E-mail

### `EmailMessage`
- id
- documentId
- direction: OUTBOUND / INBOUND
- providerMessageId
- from
- to
- subject
- bodyText
- bodyHtml
- replyToken
- status
- sentAt / receivedAt

## Auditoria

### `AuditLog`
- id
- actorType
- actorId
- action
- entityType
- entityId
- metadata
- createdAt

---

# 8. Regras de negócio indispensáveis

## Numeração

- sequencial por tipo + ano;
- geração transacional;
- nunca reutilizar número;
- número não muda após emissão.

## Linha do tempo

A linha do tempo deve ser produzida a partir de eventos persistidos, não de textos hard-coded.

## Circular

A confirmação de leitura deve ocorrer por usuário individual.

## E-mail inbound

Cada resposta deve ser idempotente usando `Message-ID` ou identificador equivalente.

## LGPD pública

Nunca utilizar a mesma serialização/API do painel interno na área pública. Criar DTO específico de consulta pública.

---

# 9. Telas necessárias para a POC

## Área interna

- [ ] Login.
- [ ] Painel simples.
- [ ] Usuários.
- [ ] Perfis/permissões.
- [ ] Organograma/setores.
- [ ] Memorandos — lista.
- [ ] Memorando — novo/editar.
- [ ] Memorando — detalhe/linha do tempo.
- [ ] Circulares — lista.
- [ ] Circular — nova.
- [ ] Circular — acompanhamento de leitura.
- [ ] Protocolos externos — lista.
- [ ] Protocolo — detalhe.
- [ ] Caixa/histórico de comunicações por e-mail.

## Área externa

- [ ] Cadastro/login do cidadão.
- [ ] Novo requerimento.
- [ ] Consulta do próprio protocolo.

## Área pública

- [ ] Consulta por chave.
- [ ] Consulta via QR Code.

---

# 10. Dados de demonstração

Criar seed específico para Rio Azul.

## Setores

- Secretaria Municipal de Administração
- Compras e Licitações
- Departamento Jurídico
- Recursos Humanos
- Tecnologia da Informação

## Usuários

### Administrador
- Nome: Administrador Geral
- Perfil: ADMIN_GERAL
- Setor: Administração

### Visualização
- Nome: Servidor Consulta
- Perfil: NIVEL_3_VISUALIZACAO
- Setor: Administração

### Outros destinatários
- Servidor Compras
- Servidor Jurídico
- Servidor RH

## Cidadão

- Pessoa fictícia coerente para protocolo externo.
- CEP real de endereço de demonstração, sem utilizar dados pessoais reais de terceiro.

---

# 11. Roteiro da apresentação da POC

## Preparação

- ambiente de produção/homologação limpo;
- seed conhecido;
- usuários e senhas de contingência;
- e-mail externo real de demonstração;
- celular para leitura de QR Code;
- certificado/conta de autenticação externa preparado;
- internet principal + backup 4G/5G;
- notebook principal + fonte + backup dos acessos.

## Cenário 1 — 20 minutos

1. Login Admin Geral.
2. Criar usuário Servidor Consulta.
3. Atribuir perfil restrito.
4. Entrar como usuário restrito.
5. Mostrar bloqueio de edição/tramitação.
6. Demonstrar Gov.br ou ICP-Brasil.
7. Abrir consulta pública e mostrar CPF/CNPJ mascarado.

## Cenário 2 — 35 minutos

1. Criar Memorando.
2. Escrever conteúdo no editor.
3. Adicionar dois prazos.
4. Salvar e mostrar número automático.
5. Tramitar para Compras.
6. Abrir com usuário Compras.
7. Despachar.
8. Mostrar linha do tempo.
9. Criar Circular Urgente.
10. Enviar para três setores.
11. Abrir com usuários destinatários.
12. Mostrar painel de leitura individual com data/hora.

## Cenário 3 — 35 minutos

1. Abrir área externa em aba anônima.
2. Cadastrar cidadão.
3. Digitar CEP.
4. Mostrar endereço automático.
5. Criar requerimento.
6. Mostrar protocolo e chave.
7. Sistema envia e-mail.
8. Cidadão responde pelo Gmail/Outlook.
9. Voltar ao processo interno.
10. Mostrar resposta inserida automaticamente como despacho.
11. Gerar/abrir QR Code.
12. Mostrar consulta pública.
13. Repetir consulta usando chave manual.

## Reserva — 30 minutos

- perguntas da comissão;
- repetição de requisito;
- contingências;
- comprovação adicional.

---

# 12. Plano agressivo de desenvolvimento — 5 dias úteis

> Planejamento pensado para maximizar a chance de POC, não para finalizar imediatamente 100% do contrato.

## Dia 1 — Fundação + cenário 1 base

### Backend
- [ ] Criar projeto/repositório.
- [ ] PostgreSQL + Prisma.
- [ ] Models Organization, Department, User, Role, Permission, AuditLog.
- [ ] Auth interno.
- [ ] RBAC backend.
- [ ] Seed Rio Azul.

### Frontend
- [ ] Layout administrativo.
- [ ] Login.
- [ ] Usuários.
- [ ] Perfis.
- [ ] Organograma.

### Paralelo
- [ ] Definir imediatamente estratégia Gov.br ou ICP-Brasil.
- [ ] Configurar domínio de e-mail inbound.

**Meta do dia:** POC-01 funcional.

---

## Dia 2 — Núcleo documental + Memorando

- [ ] Document.
- [ ] DocumentDeadline.
- [ ] DocumentMovement.
- [ ] Attachment.
- [ ] AuditLog completo.
- [ ] Editor rich text.
- [ ] Numeração sequencial.
- [ ] Múltiplos prazos.
- [ ] Tramitação.
- [ ] Linha do tempo.

**Meta do dia:** POC-04 e POC-05 funcionais.

---

## Dia 3 — Circular + portal externo

### Circular
- [ ] Múltiplos setores.
- [ ] Destinatários individuais.
- [ ] Read receipt.
- [ ] Painel lido/não lido.

### Portal
- [ ] Citizen.
- [ ] Endereço/CEP.
- [ ] Novo requerimento.
- [ ] Número de protocolo.
- [ ] Public key.

**Meta do dia:** POC-06 e POC-07 funcionais.

---

## Dia 4 — E-mail inbound + QR + LGPD

- [ ] Envio de e-mail.
- [ ] Reply token.
- [ ] Recebimento/webhook.
- [ ] Parser.
- [ ] Anexos.
- [ ] Criação automática de despacho.
- [ ] Idempotência.
- [ ] QR Code.
- [ ] Consulta pública.
- [ ] Máscara CPF/CNPJ.

**Meta do dia:** POC-03, POC-08 e POC-09 funcionais.

---

## Dia 5 — Autenticação externa + estabilização

- [ ] Finalizar Gov.br ou ICP-Brasil.
- [ ] Testes ponta a ponta.
- [ ] Teste com internet diferente.
- [ ] Limpeza de erros visuais.
- [ ] Seed definitivo.
- [ ] Backup do ambiente.
- [ ] Ensaiar apresentação completa.
- [ ] Cronometrar.
- [ ] Corrigir blockers.

**Meta do dia:** POC-02 funcional + ensaio 9/9.

---

# 13. Plano alternativo em paralelo

Caso haja dois agentes/estações de desenvolvimento:

## Frente A — Core interno

- usuários/RBAC;
- organograma;
- memorando;
- workflow;
- linha do tempo;
- circular/read receipts.

## Frente B — Integrações externas

- cidadão;
- CEP;
- e-mail outbound/inbound;
- QR/chave pública;
- Gov.br/ICP;
- LGPD público.

Integração das frentes diariamente, nunca somente no último dia.

---

# 14. Testes obrigatórios antes da viagem

## Funcionais

- [ ] Criar usuário.
- [ ] Bloquear ação de usuário restrito.
- [ ] Autenticar externamente.
- [ ] Mascarar CPF.
- [ ] Criar memorando.
- [ ] Criar dois prazos.
- [ ] Gerar número automático.
- [ ] Tramitar.
- [ ] Mostrar linha do tempo.
- [ ] Enviar Circular a 3 setores.
- [ ] Registrar leitura individual de 3 usuários.
- [ ] Cadastrar cidadão.
- [ ] Buscar CEP.
- [ ] Criar protocolo.
- [ ] Enviar e-mail.
- [ ] Responder por provedor externo.
- [ ] Receber resposta automaticamente.
- [ ] Criar despacho automático.
- [ ] Gerar QR.
- [ ] Consultar por QR.
- [ ] Consultar por chave.

## Técnicos

- [ ] Ambiente HTTPS.
- [ ] Backup do banco.
- [ ] Seed reconstruível.
- [ ] Logs de erro.
- [ ] Logs de auditoria.
- [ ] Serviço de e-mail com monitoramento.
- [ ] Endpoint inbound protegido.
- [ ] URLs públicas sem exposição de dados internos.
- [ ] Todas as migrations executadas.
- [ ] Build de produção sem warnings críticos.

---

# 15. Critério interno de aprovação

A equipe só deve considerar o Celeriflow_Rio Azul **pronto para POC** quando:

- [ ] POC-01 passa em teste ponta a ponta.
- [ ] POC-02 passa em teste ponta a ponta.
- [ ] POC-03 passa em teste ponta a ponta.
- [ ] POC-04 passa em teste ponta a ponta.
- [ ] POC-05 passa em teste ponta a ponta.
- [ ] POC-06 passa em teste ponta a ponta.
- [ ] POC-07 passa em teste ponta a ponta.
- [ ] POC-08 passa em teste ponta a ponta usando e-mail externo real.
- [ ] POC-09 passa em teste ponta a ponta.
- [ ] apresentação completa fica abaixo de 90 minutos;
- [ ] nenhum item depende de alteração manual no banco durante a apresentação;
- [ ] nenhum item depende de dado hard-coded no frontend;
- [ ] ambiente foi testado fora da rede de desenvolvimento;
- [ ] existe plano de contingência para e-mail, autenticação externa e internet.

---

# 16. Pós-POC — backlog para atingir 100% do TR

A aprovação na POC **não encerra o desenvolvimento**. A retificação determina que a vencedora comprove 100% dos requisitos funcionais, técnicos e legais durante a implantação/parametrização.

O escopo completo citado no TR inclui, além do MVP acima:

- Memorando;
- Circular;
- Ouvidoria Digital;
- Protocolo Eletrônico;
- Processo Administrativo;
- Pedido de e-SIC;
- Ofício Eletrônico;
- Workflow para gestão de processos;
- Aplicativo móvel;
- Assinatura digital em lote;
- Fiscalização de obras e posturas;
- Carta de Serviços;
- Diário Oficial;
- Parecer;
- Chamado Técnico;
- Atos Oficiais;
- treinamento/EAD;
- suporte técnico;
- relatórios;
- requisitos de segurança, backup, alta disponibilidade e SLA;
- capacitação presencial;
- suporte presencial preventivo com periodicidade mínima mensal.

### Regra de arquitetura

Tudo que for criado agora deve evitar bloquear essa evolução. Portanto:

- `Document.type` deve ser extensível;
- workflow deve ser genérico;
- organograma deve ser reutilizável;
- timeline/auditoria deve atender todos os módulos;
- anexos e assinaturas devem ser serviços centrais;
- portal externo deve permitir novos tipos de serviço;
- permissões devem ser parametrizáveis.

---

# 17. Critério de foco

Durante a preparação para a POC, qualquer tarefa deve responder a uma destas perguntas:

1. **É exigida diretamente em um dos 9 requisitos da POC?**
2. **É necessária tecnicamente para que um dos 9 requisitos funcione?**
3. **Reduz risco real da apresentação?**

Se a resposta for **não** para as três perguntas, a tarefa deve ir para o backlog pós-POC.

---

# 18. Resultado esperado

O **Celeriflow_Rio Azul** deve chegar à apresentação como um sistema pequeno, coerente e operacional, capaz de demonstrar uma narrativa única:

> Prefeitura cria usuários e controla permissões → servidor cria e tramita documentos → Circular é enviada e lida com rastreabilidade → cidadão protocola demanda → recebe e-mail → responde pelo próprio e-mail → resposta entra automaticamente no processo → documento pode ser consultado publicamente por QR/chave com proteção LGPD.

Essa narrativa cobre praticamente toda a POC de forma integrada e reduz drasticamente a complexidade em comparação ao uso do CeleriFlow ERP completo.

