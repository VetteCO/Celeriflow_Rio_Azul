# Roteiro da Apresentação — POC Pregão 60/2026 (cronometrado, < 90 min)

> Regra de ouro: **declarar as duas simulações logo na abertura** (Gov.br e resposta
> por e-mail sem MX próprio). Comissão valoriza transparência; o fluxo técnico é real.

## 0. Preparação (véspera + 1h antes) — checklist

- [ ] `npm run db:seed` em banco **limpo de ensaio** (ou documentar os existentes)
- [ ] Logins testados: `admin@email.com`, `teste.admin@email.com`, `teste.nivel3@email.com` (senha padrão do ensaio)
- [ ] Internet principal + backup 4G/5G; notebook + fonte + celular (QR) + caixa de e-mail real de demonstração
- [ ] Aba anônima reservada para o portal do cidadão
- [ ] `NEXT_PUBLIC_APP_URL` apontando para a URL que a comissão vai ver (localhost só se presencial no seu equipamento)
- [ ] Relógio visível; este roteiro soma **~85 min** + 30 min de reserva

## 1. Abertura (5 min) — 00:00–00:05

1. Painel `/` — mostrar os 9 POCs e o status.
2. Falar: *"Sistema SaaS em nuvem (Vercel + Neon + Firebase), dados fictícios, LGPD
   com mascaramento. Dois pontos transparentes: o login Gov.br roda em tela de ensaio
   até sair o credenciamento de homologação, e a resposta por e-mail usa o webhook real
   com simulador até o MX do domínio próprio. Todo o resto é fluxo real, sem toque no banco."*

## 2. Cenário 1 — Segurança, acessos e LGPD (20 min) — 00:05–00:25

| Min | Ação (cliques) | O que a comissão vê | ATENDE se |
|---|---|---|---|
| 0 | `/admin` → login master | Login Firebase funcionando | login ok |
| 5 | Criar usuário "Servidor Demonstração" (Nível 3, CPL) | Criação + role + auditoria | usuário criado ao vivo |
| 8 | Alternar um usuário para Admin e de volta | Troca de perfil + claim sincronizada | diferença de perfis visível |
| 11 | Sair, entrar com `teste.nivel3@email.com`, tentar criar memorando e circular | Bloqueio (API 403, não só botão) | bloqueio demonstrado |
| 14 | "Entrar com gov.br (ensaio)" → CPF + nome → vincular | Selo "gov.br verificada" + `GOVBR_SIMULATED_LOGIN`/`GOVBR_LINKED` no audit | auth externa + vínculo + log |
| 18 | `/publico/<chave>` (usar chave do protocolo existente) | CPF `***.456.789-**`, QR, chave inválida → erro tratado | máscara LGPD + QR + chave |

## 3. Cenário 2 — Comunicação interna (35 min) — 00:25–01:00

| Min | Ação | O que a comissão vê | ATENDE se |
|---|---|---|---|
| 0 | `/documentos/novo`: assunto + rich text + origem ADM + destino CPL + **2 prazos** | Editor da plataforma, calendário | — |
| 6 | Salvar → número `MEM-00000X/2026` automático | Numeração sequencial, sem digitar | número gerado |
| 8 | Anexar arquivo (≤10MB, Blob) | Anexo listado | anexo ok |
| 10 | Despachar para JUR com texto | Status `IN_TRANSIT`, movimento `FORWARDED` | tramitação origem→destino |
| 13 | Entrar como outro usuário, abrir o memorando, "Marcar recebido" | `RECEIVED`, timeline `CREATED>FORWARDED>RECEIVED` com usuário/setor/data-hora | timeline cronológica |
| 18 | `/circulares/nova`: Urgente, 3 setores (ADM+CPL+JUR), enviar | `CIR-00000X/2026`, expansão para servidores | envio múltiplo |
| 24 | Abrir a circular com 2–3 logins diferentes (troca rápida de usuário) | Cada abertura registra `firstReadAt` | leitura individual |
| 30 | Painel de acompanhamento + filtro "só não lidos" | Lidos com data/hora, não lidos listados | rastreabilidade por servidor |

## 4. Cenário 3 — Cidadão e externo (30 min) — 01:00–01:30

| Min | Ação | O que a comissão vê | ATENDE se |
|---|---|---|---|
| 0 | Aba anônima → `/cidadao` | Portal separado do admin | área externa |
| 3 | Preencher cadastro, digitar CEP `80010-180` → Buscar | Endereço completo automático (ViaCEP) | CEP automático |
| 7 | Requerimento + Enviar | Protocolo `AAAA-NNNNNN` + chave pública | protocolo + chave |
| 10 | "Simular resposta por e-mail" no documento (ou responder pelo Gmail, se MX pronto) | Despacho `EXTERNAL_REPLY` aparece **sem toque manual** | captura automática |
| 16 | Reabrir e mostrar que a citação do e-mail foi removida do despacho | Parser texto/HTML | tratamento da resposta |
| 19 | Celular lê o QR da `/publico/<chave>` | Mesma consulta do celular | QR funciona |
| 22 | Digitar a chave manualmente no campo de busca | Mesma consulta por chave | chave funciona |
| 25 | Mostrar CPF mascarado + histórico limitado | LGPD no público | sigilo mantido |

## 5. Reserva (30 min) — perguntas, repetição e contingência

- **Pergunta provável "e os outros módulos do objeto?"** → responder: parecer, ofício,
  intimação e pauta usam o mesmo núcleo (novo tipo + prefixo + tela); demonstrar criando
  um `Document.type` novo é trivial — ver `docs/ANALISE_EDITAL_E_LACUNAS.md`.
- **Pergunta "assinatura digital?"** (item 17.3.1-b) → admitir como backlog de
  implantação com proposta de integração; não improvisar na hora.
- **Contingências:** internet caiu → backup 4G; ViaCEP fora → digitar endereço manual
  (o campo permite); Blob lento → pular anexo (não é macro-requisito); e-mail real
  não chega → usar o simulador declarando.
- **Frase de fechamento:** *"9 fluxos demonstrados ao vivo, nenhum com alteração manual
  no banco, auditoria em todas as ações relevantes."*

## Credenciais e URLs do ensaio

| Item | Valor |
|---|---|
| Admin master | `admin@email.com` (senha do ensaio) |
| Nível 3 | `teste.nivel3@email.com` |
| CEP de demonstração | `80010-180` (endereço público, sem dados reais) |
| CPF de ensaio gov.br | `529.982.247-25` (válido, fictício para o teste) |
| Rotas | `/`, `/admin`, `/documentos`, `/circulares`, `/cidadao`, `/publico/<chave>`, `/api/health` |
