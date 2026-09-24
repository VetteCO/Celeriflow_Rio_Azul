# Plano de Dados do Ensaio — todas as tabelas

Elenco fictício (nomes/emails realistas, dados inventados — nada real):

## Servidores (login Firebase + claim + app_user)

| Nome | E-mail (senha do ensaio) | Setor | Perfil |
|---|---|---|---|
| João da Silva | joaodasilva@email.com | ADM | ADMIN_GERAL |
| Maria Oliveira | mariaoliveira@email.com | CPL | NIVEL_3 |
| Carlos Souza | carlossouza@email.com | JUR | NIVEL_3 |
| Ana Santos | anasantos@email.com | RH | NIVEL_3 |
| Paulo Ferreira | pauloferreira@email.com | TI | NIVEL_3 |
| Fernanda Lima | fernandalima@email.com | ADM | NIVEL_3 |

Criação: `TEST_PASSWORD='...' npm run admin:bootstrap` (idempotente, upsert por e-mail).

## Cidadão

| Nome | E-mail | CPF | Endereço |
|---|---|---|---|
| Ricardo Almeida | ricardoalmeida@email.com | 111.444.777-35 | Rua Barão do Rio Branco 250, Centro, Curitiba/PR, CEP 80010-180 |

## Cenário (documentos encadeados, como na vida real)

1. `MEM-000002/2026` "Aquisição de material de escritório" (João, ADM→CPL, 2 prazos,
   anexo termo.txt, timeline CREATED>FORWARDED>RECEIVED por Maria).
2. `OFI-000002/2026` "Encaminhamento de minuta de contrato" (João, ADM→JUR).
3. `CIR-000002/2026` "Horário de atendimento no feriado" (Informativa, 5 setores):
   lida por João e Maria, não lida pelos demais (demonstra o painel).
4. Protocolo `2026-000002` (Ricardo): requerimento + e-mail de saída PENDENTE +
   resposta inbound (EXTERNAL_REPLY) — ciclo cidadão completo.
5. `audit_log` recebe linha em cada inserção relevante.

## Por tabela (o que cada script insere)

| Tabela | seed.ts (base) | bootstrap-users.ts | seed-cenario.ts |
|---|---|---|---|
| organization | 1 linha | — | — |
| department | 5 setores | — | — |
| role / permission / user_role | 2 roles, 8 perms, vínculos | vínculos dos novos | — |
| app_user | 6+3 anteriores | 6 do elenco (+claim Firebase) | — |
| citizen | — | — | Ricardo Almeida |
| document | — | — | MEM+OFI+CIR+REQ |
| document_deadline | — | — | 2 no memorando |
| document_recipient | — | — | expansão da circular + CPL |
| document_read_receipt | — | — | João e Maria na circular |
| document_movement | — | — | timelines completas |
| attachment | — | — | 1 via Blob (se token ok) |
| external_request | — | — | protocolo 2026-000002 |
| email_message | — | — | OUTBOUND pendente + INBOUND |
| audit_log | SEED_FASE_1 | USER_BOOTSTRAPPED | entradas do cenário |

## Como rodar / resetar

```
npm run db:seed            # base (idempotente)
TEST_PASSWORD='Senha123!' npm run admin:bootstrap   # logins
npm run db:seed:cenario    # cenário (pula o que já existe)
```

Reset total do ensaio: apagar linhas de `external_request`, `document*`, `email_message`,
`attachment`, `citizen` criadas pelo cenário (mantém base) — ou recriar o banco Neon
(branch nova) e rodar os três comandos.
