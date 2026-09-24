# Plano de Implementação — Celeriflow Rio Azul (POC 9/9)

Stack: GitHub + Vercel + Neon + Vercel Blob + Firebase Auth + Next.js/TS/React + Drizzle + Resend + Gov.br predisposto.

Base já criada nesta pasta. Você preenche os CHECKPOINTS no `.env` (copie `.env.example` para `.env.local`).

---

## Fase 0 — Preparar ambiente [ ] 
- [ ] Copiar `.env.example` → `.env.local`
- [ ] `npm install`
- [ ] `npm run dev` → abrir http://localhost:3000 e /api/health
- [ ] Criar repo no GitHub e dar `git push`
- [ ] Conectar repo na Vercel (deploy preview)

> **CHECKPOINT 1 — Neon:** me passe `DATABASE_URL` (pooled) + `DIRECT_URL`. Sem isso `db:push` não roda.

## Fase 1 — Fundação + POC-01 (RBAC) [ ]
- [ ] `npm run db:push` (cria tabelas do `src/db/schema.ts`)
- [ ] Seed: roles `ADMIN_GERAL`, `NIVEL_3_VISUALIZACAO` + 5 setores Rio Azul + usuários demo
- [ ] Tela `/admin`: login Firebase (email/Google) + lista usuários + troca de role (`src/lib/firebase-admin.ts:setRoleClaim`)
- [ ] Proteger API com `verifyIdToken` + `can(role, action)` (`src/lib/rbac.ts`)
- [ ] Teste: usuário NIVEL_3 tenta POST → 403

> **CHECKPOINT 2/3/4:** `NEXT_PUBLIC_APP_URL`, chaves web Firebase, Service Account Admin. Me avise quando colar no `.env`.

## Fase 2 — POC-04 + POC-05 (Memorando + timeline) [ ]
- [ ] CRUD memorando: editor rich text, assunto, origem/destino, anexos via `src/lib/blob.ts`
- [ ] Numeração transacional `MEM-000001/2026` (unique type+year+number, sem duplicar)
- [ ] `documentDeadline` múltiplos + calendário
- [ ] Tramitação origem→destino + `documentMovement` + timeline cronológica
- [ ] `auditLog` em toda ação relevante

## Fase 3 — POC-06 + POC-07 (Circular + cidadão) [ ]
- [ ] Circular Urgente/Informativa p/ múltiplos setores, expansão p/ usuários
- [ ] `documentReadReceipt.firstReadAt` imutável + painel lido/não lido + filtro não lidos
- [ ] `/cidadao`: cadastro + ViaCEP (https://viacep.com.br) + requerimento + `protocolNumber` + `publicKey`
- [ ] Envio confirmação por e-mail (Resend)

> **CHECKPOINT 5/6:** `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY` + `EMAIL_FROM`. Inbound com `*.vercel.app` NÃO funciona (sem MX) — ver Fase 4.

## Fase 4 — POC-03 + POC-08 + POC-09 (LGPD + e-mail inbound + QR) [P0]
- [ ] DTO público separado usando `src/lib/mask.ts` (nunca expor interno)
- [ ] Outbound `src/lib/email.ts` com `replyTo` tokenizado
- [ ] Inbound `src/app/api/email/inbound/route.ts`: validar secret, parser texto/HTML, idempotência `providerMessageId`, anexos→Blob, despacho automático + timeline
- [ ] `/publico/[key]`: query por publicKey + QR Code + tratamento chave inválida
- [ ] Teste real: enviar → responder pelo Gmail → despacho aparece sem toque manual

> **CHECKPOINT 6b — DOMÍNIO:** para inbound real precisa domínio próprio com MX no Resend. Opções: (a) você me passa domínio + acesso DNS, configuro; (b) fallback polling Gmail IMAP para ensaio. Me diga qual.

## Fase 5 — POC-02 (Gov.br) + ensaio [P0]
- [ ] Adapter real em `src/lib/govbr.ts` (hoje MOCK)
- [ ] Vínculo CPF→User + log auditoria + tratamento cancela/erro/não-vinculado
- [ ] Teste ponta-a-ponta 9/9 < 90min, fora da rede dev, com internet backup + celular QR + mailbox real

> **CHECKPOINT 7 — Gov.br:** `GOVBR_CLIENT_ID/SECRET/REDIRECT_URI/DISCOVERY_URL` de homologação. Enquanto vazio, rota retorna MOCK para ensaio.

## Critério de pronto (não ir p/ POC sem isso)
- [ ] 9/9 passam sem `UPDATE` manual no banco e sem hard-code no front
- [ ] Build Vercel verde, HTTPS, migrations aplicadas, seed reconstruível
- [ ] Logs erro + auditoria + monitoramento Resend ativos

## Comandos
```
npm install
npm run dev
npm run db:push
npm run build
```
