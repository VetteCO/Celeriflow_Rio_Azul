# Mapeamento 1:1 — TR Oficial × Sistema (POC)

Fonte: `docs/03 TR.pdf` item 7.3.1 + `docs/PREGÃO 60-2026 1 PROTOCOLO ELETRÔNICO.pdf`
(itens 16.x). Retificador aplica 70% (item 16.2.3). Legenda: ✅ demonstrável ao vivo ·
⚠️ parcial/simulação declarada · ❌ lacuna.

## Regras da disputa (lidas no TR)

- 1º colocado, presencial, ambiente em até **5 dias úteis** da convocação.
- Duração máx. **2h**; comissão em sessão reservada registra **ATENDE / NÃO ATENDE**;
  resultado em até **3 dias úteis**.
- **Só o Cenário 1 é explicitamente "(Critério Eliminatório)"**; cenários 2–3 estão
  sob a cláusula genérica de macro-requisitos — estratégia: Cenário 1 impecável.

## Cenário 1 — Segurança, Acessos e LGPD (eliminatório)

| Item TR | Requisito | Status | Evidência no sistema |
|---|---|---|---|
| 16.3.2.1 | Criar usuário servidor + segmentar Admin Geral × Nível 3 visualização | ✅ | `/admin`: criar ao vivo, trocar role, claim Firebase; `POST /api/admin/users` bloqueia Nível 3 com 403 (teste E2E) |
| 16.3.2.2 | Login via Gov.br **ou** ICP-Brasil e-CPF | ⚠️ | `/govbr-simulado`: tela de ensaio declarada + vínculo CPF + `GOVBR_SIMULATED_LOGIN`/`GOVBR_LINKED` em auditoria. Real exige CHECKPOINT 7 (homologação). ICP-Brasil é plano B não iniciado |
| 16.3.2.3 | Ocultar partes críticas CPF/CNPJ em telas públicas | ✅ | `mask.ts` central; DTO público sem corpo/anexos; teste: `***.456.789-**` |
| base | SaaS em nuvem, ao vivo | ✅ | Vercel + Neon + Firebase (declarar Cláusula 10ª na abertura) |

## Cenário 2 — Memorando e Circular

| Item TR | Requisito | Status | Evidência |
|---|---|---|---|
| 16.3.3.1 | Memorando no editor + múltiplos prazos em calendário + numeração automática sequencial | ✅ | `/documentos/novo`; `MEM-000001/2026`; unique `(type,year,number)` + retry |
| 16.3.3.2 | Despacho para outro setor do organograma + linha do tempo cronológica | ✅ | forward/receive; timeline `CREATED>FORWARDED>RECEIVED` com usuário/setor/data-hora |
| 16.3.3.3 | Circular Urgente/Informativa p/ múltiplos subsetores + data/hora exata de leitura por servidor | ✅ | `/circulares`; expansão p/ usuários; `firstReadAt` imutável no banco; filtro não lidos |
| extra habilitação | **Ofício** citado em 12.2.2.3/17.3.4 (sem demo no roteiro, mas cobrado documentalmente) | ✅ | Tipo `OFICIO` + série `OFI-000001/2026`, mesmo workflow (adicionado após leitura do TR) |

## Cenário 3 — Cidadão

| Item TR | Requisito | Status | Evidência |
|---|---|---|---|
| 16.3.4.1 | Área externa + cadastro facilitado CEP + requerimento | ✅ | `/cidadao`; ViaCEP real; protocolo `2026-000001` + chave pública |
| 16.3.4.2 | Notificação por e-mail + resposta pelo provedor próprio anexada **como despacho** | ⚠️ | Webhook real + parser + `EXTERNAL_REPLY` testados; **envio da notificação e recebimento real exigem Resend + domínio/MX** (hoje: PENDING + simulador declarado) |
| 16.3.4.3 | Consulta por QR **ou** chave pública, com sigilo LGPD | ✅ | `/publico/[key]` real: QR gerado, busca manual, CPF mascarado, chave inválida tratada |

## Conta final

- ✅ 8 itens demonstráveis com fluxo real + 2 simulações declaradas (Gov.br, e-mail real).
- Pela régua de 70% (7 de 10 macro-itens): **passa mesmo se 2 falharem**; pela nossa meta 9/9 falta só plugar Resend/domínio e credencial Gov.br.
- ❌ Fora da POC (implantação 100%): assinatura digital em lote, ICP e-CPF, parecer/intimação/pauta, relatórios de auditoria p/ pagamento, treinamento, SLA/suporte, app móvel — ver `ANALISE_EDITAL_E_LACUNAS.md`.
