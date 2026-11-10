# Validação integrada por APIs reais

## Estado desta entrega

Harness preparado em `scripts/validate-integrated.ts`. **Não foi executado, compilado nem testado nesta entrega. Não houve criação de dados remotos.** Os resultados são produzidos exclusivamente quando o operador o executar; a existência deste roteiro não certifica aprovação dos núcleos ou módulos.

O principal informou uma execução da versão anterior com **163 PASS, 0 FAIL, 0 BLOCKED**, em `integrated-058f3af4*`. Essa contagem não valida os novos cenários de anexos/avaliação/medição abaixo, que aguardam execução pelo principal. A correção do oráculo SQL `due_at AT TIME ZONE 'UTC'` foi preservada.

O script usa os contratos atuais de Firebase, administração, documentos, circulares, anexos e módulos. Importa `familySchema`, `familyFields` e `workflowSchema` do domínio local; não depende de novos contatos. Contratos incompatíveis do servidor geram falha, sem converter respostas inesperadas em aprovação.

## Preparação e execução posterior

Executar na raiz do projeto, com Node e dependências já instalados. Não há instalação de pacotes, seed, migração ou inicialização automática de servidor.

`.env.local` deve apontar para **o mesmo banco, projeto Firebase e armazenamento privado utilizados pelo servidor escolhido**:

- `DATABASE_URL` (credencial administrativa SQL capaz de limpar dependências e administrar os triggers indicados abaixo);
- `NEXT_PUBLIC_FIREBASE_API_KEY`;
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`;
- `BLOB_READ_WRITE_TOKEN` para o cenário de arquivo original e sua limpeza.

Escolher explicitamente o UID de um administrador geral já existente, ativo e vinculado ao banco. O login por custom token e as chamadas autenticadas **podem gerar auditoria e atualizar último acesso desse administrador**. Seu cadastro, papéis e credenciais não são alterados nem removidos.

```powershell
.\node_modules\.bin\tsx.cmd --env-file=.env.local scripts/validate-integrated.ts --allow-write --base http://localhost:3000 --admin-uid UID_DO_ADMIN --intake-department UUID_DO_SETOR_DE_ENTRADA --external
```

`--allow-write` e `--base URL` são obrigatórios; não existe URL de produção padrão. A base deve ser uma origem HTTP(S), sem credenciais, caminho, query ou fragmento. O operador escolhe o ambiente de destino. O script não infere que a base informada é homologação.

### Protocolo anônimo do núcleo

O endpoint `/api/cidadao/requerimentos` determina o setor de entrada pelo ambiente **do servidor**, sem aceitar setor no payload. A opção preferencial é `--intake-department UUID`: informar explicitamente o ID existente já configurado no ambiente do servidor. O harness verifica que o setor está ativo, não o altera, não o inclui no manifesto de propriedade e não o remove. Após a criação, exige que a origem do protocolo corresponda exatamente a esse ID. Essa modalidade não pausa nem exige alteração de configuração do servidor. Apenas o cidadão/documento próprios e suas dependências entram na limpeza.

Se a variável já estiver exportada no PowerShell, pode-se passar `--intake-department $env:DEFAULT_INTAKE_DEPARTMENT_ID`. O carregamento de `.env.local` pelo processo filho não exporta variáveis para o shell; alternativamente, passar o UUID diretamente. Não existe escolha implícita de setor.

Como alternativa, adicionar `--protocol-pause` em um terminal interativo para usar um dos três setores exclusivos. Se ambas as opções forem dadas, o intake existente explícito tem precedência.

O script cria os três setores, mostra o ID exclusivo de entrada e pausa. Nesse momento:

1. Configurar `DEFAULT_INTAKE_DEPARTMENT_ID` **no servidor alvo** com o ID mostrado.
2. Reiniciar o servidor e aguardar sua disponibilidade.
3. Responder `CONFIGURADO` no terminal do harness.
4. Ao terminar, restaurar a configuração anterior do servidor, pois o setor temporário será removido.

Sem intake explícito nem pausa confirmada, o cenário é `BLOCKED`. Configurar apenas a variável no processo do harness não configura o servidor. Se a API rotear para outro setor, a asserção falha e o documento identificado pela chave retornada entra na limpeza; nenhum setor existente é removido.

## Isolamento dos cadastros

Município fictício: **Santa Aurora do Vale**. São criados três setores exclusivos: Gestão Administrativa, Planejamento e Assessoria Técnica. Nomes de pessoas e assuntos são verossímeis; não são acrescentados rótulos “Teste”, “POC” ou equivalentes à interface. A exclusividade é estabelecida pelos IDs, não pelos nomes visíveis.

Quatro contas temporárias são criadas **pelo endpoint administrativo**, com e-mails únicos em `example.invalid` e senhas aleatórias não persistidas nas evidências. Uma conta N3 tem dois setores. As demais são administradores temporários para permitir administração de fluxos e testar suspensão de administrador. Os cenários de autorização não equivalem a uma matriz completa de N1/N2/admin local.

No cenário externo opcional, somente duas dessas contas temporárias têm o e-mail marcado como verificado via Firebase Admin. Seus tokens são renovados. Não se usa conta cidadã preexistente.

Não se cria tenant/organização isolado: o modelo atual é compartilhado. A numeração e a auditoria globais avançam legitimamente. Contadores não são revertidos.

Os três setores exclusivos recebem expediente via `PUT /api/modules/business-hours`, com `revision: 0`, ativo, segunda a sexta, 08:00–12:00 e 13:00–17:00. O administrador autentica a configuração; a linha é removida por `department_id` próprio antes dos setores/usuários, respeitando também a FK do ator. O expediente do intake existente não é alterado.

## Alcance implementado

| Cenário | Evidência efetivamente exigida |
| --- | --- |
| Administração | Vínculo UID/banco e sessão; setores criados visíveis no mesmo banco; provisionamento via endpoint; N3 em dois setores e impedido de criar; revogação de papel respeitada pelo token antigo; suspensão de administrador e rejeição do token; reativação da própria conta temporária. |
| Memorandos | Duas criações concorrentes com IDs/números distintos; corrida de dois encaminhamentos A→B com exatamente um vencedor; recebimentos B e C e encaminhamento B→C; exatamente dois eventos `FORWARDED` no SQL; conclusão, arquivamento e reabertura em C, conferindo estados do documento e participação no SQL. |
| Prazos | Oráculo independente usa os feriados existentes e fim de semana; compara cálculo da API; cria um documento adicional com prazo e verifica persistência. Configura expediente dos três setores e exige que duas horas úteis iniciadas às 11h terminem às 14h locais, excluindo almoço. Workflow usa SLA útil real. Não cria feriado global. |
| Circular | Informativa: oito leituras concorrentes, mesmo `firstReadAt` e único recibo no SQL. Urgente: B recebe e encaminha a C; população passa de um para três usuários; leitura de novo destinatário altera contagem; alteração para C exclui B, mantém recibo e reconcilia total/lidos/não lidos; leitura de destinatário removido negada. |
| Anexo original | Upload de texto UTF-8 via multipart; download autenticado; SHA-256 dos bytes idêntico; acesso anônimo negado. |
| Protocolo anônimo | Intake existente explícito ou pausa alternativa; CPF com dígitos verificadores calculados e sem cadastro prévio; CPF repetido inválido rejeitado; protocolo criado; setor de entrada conferido; resposta pública sem CPF completo, nome, e-mail ou descrição. CPF matematicamente válido não é prova de identidade real. |
| Módulos: processo | Fluxo configurado via APIs, campos baseados no schema e cálculo `3 × 12,50 = 37,50`; valor calculado fornecido pelo cliente é substituído ao protocolar; vínculo aos dois documentos de núcleo. |
| Etapas | Primeira etapa exige A e B; avanço antecipado negado; conclusão de ambos; avanço para C com prazo; decisão final após conclusão de C. |
| Edição e história | Reserva de edição; conflito com outro editor; token inválido; edição válida; revisão obsoleta negada; reserva liberada não autoriza edição. Reaquisição gera outro token; liberação pelo token antigo não encerra a nova reserva; edição com token antigo falha e com token novo funciona. Versão inicial consultável e ainda em rascunho. Não espera 90 segundos para testar expiração temporal da reserva. |
| Ouvidoria e anexos anônimos | Identidade sigilosa removida da resposta de outro setor participante e da consulta histórica. Fluxo anônimo exige a categoria `Relato documental`; SUBMIT sem arquivo falha sem incrementar revisão. Upload multipart de TXT e PDF usando `x-anonymous-key`, `category`, `operationId` UUID e `revision` do READ. Chave ausente/incorreta, extensão proibida, PDF falso e TXT binário rejeitados. Repetição do mesmo UUID/arquivo retorna mesmo ID/revisão, sem duplicação; UUID com conteúdo diferente falha. Downloads por POST e chave verificam SHA-256, MIME, attachment, nosniff, cache privado e no-referrer. |
| Avaliação anônima | SUBMIT com revisão atual, após anexos; avaliação antes da conclusão rejeitada. Os três setores concluem participações e A defere. Notas 0/6 rejeitadas; nota 1 substituída por 5 com idempotência e revisão única por operação. Reabertura sem justificativa negada; com justificativa limpa a avaliação e desabilita nova avaliação até reconclusão. Após nova conclusão dos três setores e deferimento, avaliação pertence ao ciclo 1. |
| PDF: medição e desenho | PDF criado em memória com `pdf-lib` já instalado. MEDIR exige hash do original e revisão atual; hash incorreto/revisão antiga negados. Oráculos independentes: distância 3–4–5 × escala 2 = 10; retângulo 100 × 50 × escala² = 20.000. Gera cópia anotada por API; download confere hash próprio, diferente do original, e PDF legível com uma página. Original continua byte a byte idêntico; derivado interno não é exposto ao acesso anônimo. Não realiza comparação visual rasterizada. |
| Árvore e job ZIP | GET da árvore por raiz `document` e por raiz `module`, exigindo os dois memorandos e o processo nos dois sentidos. Cria um GED reversamente vinculado no setor B, invisível ao usuário A, e exige ausência de seu ID/título/conteúdo/contagem na árvore. POST ZIP `selection: complete` com raiz documental e UUID de idempotência; repetição retorna mesmo ID; SQL exige `QUEUED`, sem output, proprietário próprio e exatamente os três sources autorizados. |
| Externo | Com `--external`: titular cria atendimento; terceiro inicialmente sem acesso; mandato limitado ao registro; aceite; leitura por representante; DTO sem campos internos; revogação remove leitura e escrita do representante, preservando acesso do titular. Não executa corrida entre revogação e escrita. |

O script registra resultados de HTTP e asserções de estado; não publica corpos de requisições/respostas. Concorrência usa `Promise.allSettled` para aguardar ambas/todas as respostas antes do teardown. Não usa retries automáticos de POST.

### Limites explícitos

- Há cobertura transversal de núcleo e módulos, **não cobertura integral de todos os requisitos dos núcleos 0–5 e módulos 6–8**.
- Árvore e captura de sources do ZIP são cobertas. Nenhum worker é disparado: geração de ZIP/PDF/OCR pelo worker e download de saída do job ficam fora do escopo. A cópia anotada de PDF é gerada pela API de anotação, independentemente da fila. O ambiente escolhido deve estar com consumidores da fila parados durante o cenário; se um worker externo reclamar o job, a asserção falha e a limpeza preserva esse job e sua saída para recuperação.
- Não exercita todas as famílias: processos/fluxos, GED privado e ouvidoria são os cenários concretos. Não cria contatos, publicações de diário, geometria, assinaturas ou integrações de e-mail/governo.
- Diário/catálogo permanece para validação pelo agente principal fora deste script, incluindo IDs próprios, dependências e guards específicos. O harness não inclui um bloqueio artificial para esse escopo externo.
- Não exercita toda a matriz de permissões nem publicação de anexos para cidadãos.
- Não usa PGlite: estas corridas são reais contra as APIs e o SQL do ambiente escolhido. Nenhum pacote de isolamento é instalado.
- Os cenários usam setores exclusivos, mas o servidor e banco precisam estar alinhados. A conferência após criar setor detecta divergência; recursos criados em outro banco exigem reconciliação no ambiente correto.
- Resposta perdida depois de commit pode deixar recurso sem ID conhecido. O harness não tenta descobrir/remover por nome ou e-mail. Operações POST sem resposta ficam no manifesto como pendentes, e a execução não é apresentada como totalmente limpa.

## Evidências privadas e histórico

Saída: `%LOCALAPPDATA%\Temp\opencode\integrated-<uuid>`, fora do repositório, no diretório temporário aprovado. O código solicita modos `0700/0600`; no Windows valem as ACLs herdadas do diretório privado do usuário.

- `results.redacted.json`: identificador da execução, instante, nomes fixos das asserções, status HTTP, resultados `PASS`, `FAIL`, `BLOCKED` e diagnóstico sanitizado. Diagnósticos incluem SQLSTATE conhecido com descrição fixa, códigos Firebase permitidos e categorias HTTP (schema/autorização/revisão/reserva/expediente/estado/servidor), com limite de mensagem. Sem SQL/query, parâmetros SQL, stack, URL, tokens, chaves públicas, CPF, nomes, e-mails ou corpos de API. Erros não reconhecidos são classificados sem copiar mensagem bruta.
- `manifest.private.json`: manifesto operacional privado com IDs próprios, vínculo SQL/Firebase, caminhos de blobs e fingerprint do banco. Não é evidência pública; não contém tokens Firebase, senha ou URL de conexão.
- `history.redacted.json`: projeção de ações, revisões, instantes e estados históricos.
- `history-<uuid>.aes` e `.key`: cópia exata **criptografada** dos registros próprios antes da remoção, incluindo versões e relações. Formato AES-256-GCM: IV de 12 bytes, tag de 16 bytes, ciphertext; chave binária de 32 bytes em arquivo separado privado. Esse par é arquivo de recuperação sensível, não evidência JSON para distribuição. Conservar ambos em armazenamento privado; separar a chave para retenção de longo prazo.
- `audit_log` permanece no banco, inclusive a auditoria do administrador existente e dos registros removidos. Não é feito DELETE de auditoria.

O manifesto é persistido antes de iniciar a limpeza. Dados históricos podem conter PII e chaves, por isso o arquivo completo nunca é gravado em JSON aberto ou no repositório. A projeção redigida não substitui o arquivo exato criptografado.

## Teardown e recuperação

O `finally` tenta limpar inclusive após asserções falhas. Só se remove pelo ID registrado no manifesto, ou por uma FK explícita para um desses IDs. Dependências são enumeradas por uma lista fechada; não há DELETE por prefixo, nome, e-mail ou período.

Ordem: dependências de documento/módulo, expediente exclusivo, textos de jobs próprios e vínculos de usuário; jobs próprios; mandatos; registros de módulos; documentos; cidadãos próprios; usuários próprios; setores próprios. Blobs são obtidos somente das linhas de anexos pertencentes a esses IDs. Contas Firebase são vinculadas ao ID de `app_user` do manifesto, com proteção explícita do UID do administrador original. O intake existente é protegido contra inclusão acidental como setor próprio.

TXT, PDF original e cópia anotada são registrados imediatamente como `module_file:id` após conferir no SQL a associação ao `module_record` próprio. O caminho de blob vem dessa linha verificada e é persistido no manifesto; não há listagem global do armazenamento. A expansão por `module_file.record_id` continua recuperando arquivos próprios quando uma resposta se perde. `module_anonymous_access` (hash da chave) e `module_anonymous_operation` (UUID/resultados idempotentes) são dependências pelo `record_id` próprio, removidas antes do registro, com o guard `anonymous_operation_immutable` tratado na transação existente. A chave anônima bruta só permanece em memória; não é incluída no manifesto nem nos JSONs de evidência. Não há tabela adicional de token por arquivo no contrato lido: o download associa arquivo, registro e hash da chave de acesso.

Jobs são registrados por `own("document_job", id)`. Para recuperar uma resposta perdida, somente jobs cujo `owner_id` seja um usuário criado nesta execução podem ser incorporados ao manifesto. Não há busca por assignee, nome ou IDs globais. Só se removem jobs `QUEUED` e sem `output_key`; `document_job_text`, se existir, é removido por `job_id` próprio. A transação bloqueia e reconfere os jobs antes de qualquer DELETE: mudança de estado/saída/proprietário provoca rollback. Não remove `document_job_blob`, não executa worker e não toca arquivos de saída.

Os contratos atuais impedem DELETE de histórico. Depois do arquivo criptografado, a transação administrativa bloqueia exclusivamente as tabelas afetadas, suspende **somente** os guards conhecidos (`modules_guard`, `modules_version_immutable`, `modules_file_immutable`, `modules_mandate_no_delete`, `anonymous_operation_immutable`), executa os DELETEs por IDs/FKs próprios e reativa esses mesmos guards antes do commit. Lock timeout: dez segundos. Falta de privilégio, trigger diferente ou FK nova provoca rollback; não se desabilitam todos os triggers ou constraints.

Se essa transação falhar, **nenhuma conta Firebase é excluída enquanto seu cadastro SQL persistir**. A recuperação tenta confirmar o par ID SQL/UID do manifesto, desabilitar a conta própria e revogar seus refresh tokens, mantendo o cadastro para nova tentativa de limpeza. O manifesto recebe `cleanup:recovery-required`. Falha nessa desabilitação é diagnosticada separadamente. Blobs não são removidos se a limpeza SQL falhar, preservando os arquivos referenciados. Contas Firebase só são excluídas após commit da limpeza SQL. Falhas anteriores à transação, indisponibilidade de rede ou encerramento forçado podem impedir a limpeza automática; o manifesto permanece para recuperação.

```powershell
.\node_modules\.bin\tsx.cmd --env-file=.env.local scripts/validate-integrated.ts --allow-write --base http://localhost:3000 --admin-uid UID_DO_ADMIN --resume-cleanup "$env:LOCALAPPDATA\Temp\opencode\integrated-UUID\manifest.private.json"
```

Recuperação exige mesma base, fingerprint de banco e projeto Firebase; não recria cenários. Nunca apontar para um manifesto alheio. Se houver commit sem ID identificado, reconciliar a operação pela auditoria privada antes de incluir um ID comprovadamente próprio; o script não elimina recursos desconhecidos.

Código de saída: `0` somente se não houver falha nem bloqueio; `1` quando houver falha; `2` quando houver bloqueio sem falha. Não há bloqueio incondicional para jobs. Um resultado aprovado atesta somente as asserções executadas deste roteiro, não homologação integral de todas as famílias.
