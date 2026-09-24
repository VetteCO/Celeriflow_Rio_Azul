# Análise do Edital Retificador (Pregão 60/2026) × Sistema — Lacunas

Data da análise: 24/09/2026. Fonte: `docs/edital retificado.docx` (1º Edital Retificador).
**Pendente do usuário: o Termo de Referência completo** (cenários de teste da POC, item 7.3.1).
Sem ele, o mapeamento fino requisito→tela depende do plano interno.

## 1. O que o retificador mudou (e o impacto no projeto)

| # | Mudança | Impacto |
|---|---------|---------|
| a | Item 16.2.3: POC aprova com **≥70% dos macro-requisitos** (TCE-PR Acórdão 2384/25); ausência/recusa = desclassificação imediata | Nossa meta segue 9/9, com margem: podemos falhar em até 2 macro-itens e passar |
| b | Item 16.2.3.1: **100% dos requisitos** comprovados na implantação/parametrização, sob pena de rescisão | Pós-POC vira obrigação contratual — backlog da seção 4 vale ouro |
| c | Cláusula 10ª: **subcontratação de datacenter/SaaS autorizada** (responsabilidade integral nossa + LGPD) | Nossa stack (Neon + Vercel + Resend + Firebase) está coberta; declarar na POC |
| d | Item 17.3.1: qualificação técnica exige **(a) Protocolo Eletrônico e Workflow** e **(b) GED com Assinatura Digital** | (a) temos; (b) assinatura digital é lacuna — ver seção 3 |
| e | Sessão em 10/09/2026 (passada) | Estamos em fase pós-disputa → provável convocação para POC a qualquer momento |

## 2. Módulos do objeto × cobertura atual

Objeto: memorando, protocolo, parecer, intimação, ofício, circulares e pauta de
reunião, despachos internos/externos, pareceres técnicos e jurídicos.

| Módulo do objeto | Situação | Onde |
|---|---|---|
| Memorando eletrônico | Pronto (POC-04) | `/documentos` |
| Protocolo eletrônico | Pronto (POC-07, requerimento) | `/cidadao` |
| Circulares | Pronto (POC-06) | `/circulares` |
| Despachos internos/externos | Pronto (POC-05 + POC-08) | timeline + inbound |
| Parecer / pareceres técnicos e jurídicos | **Ausente** (pós-POC) | novo `Document.type` + mesmo workflow |
| Ofício eletrônico | Pronto (básico: tipo + série OFI + workflow, adicionado após leitura do TR) | `/documentos` |
| Intimação | **Ausente** (pós-POC) | novo `Document.type` + prazo fatal |
| Pauta de reunião | **Ausente** (pós-POC) | novo `Document.type` + lista de itens |

Arquitetura já preparada: `Document.type` extensível, `formatNumber` com prefixo por
tipo, workflow/timeline/auditoria genéricos. Cada módulo novo ≈ 1 valor de enum +
1 prefixo + tela de lista (reuso de componentes).

## 3. Lacunas críticas para os 100% da implantação (não bloqueiam a POC)

1. **Assinatura digital** (item 17.3.1-b, parcela de maior relevância): hoje não há
   assinar/lote nem ICP-Brasil e-CPF. Para a POC, o Gov.br simulado cobre a
   autenticação; para implantação, prever assinatura (ex.: integração com
   assinador + carimbo de tempo) — é o maior risco pós-POC.
2. **ICP-Brasil e-CPF** como alternativa ao Gov.br (TR diz "Gov.br OU Certificado"):
   caminho reserva se o credenciamento Login Único atrasar.
3. **Módulos parecer/ofício/intimação/pauta** (seção 2).
4. **Domínio próprio + MX** para inbound real (hoje: webhook + simulador).
5. **Resend produtivo** (hoje: confirmações PENDING).
6. **Relatórios, Carta de Serviços, Diário Oficial, app móvel, EAD/treinamento,
   SLA/suporte** — escopo de implantação, fora da POC.

## 4. O que pedir/enviar agora

- [ ] **Subir o Termo de Referência (PDF/DOCX) em `docs/`** — sem os cenários de
  teste exatos não há como garantir o mapeamento 1:1 da apresentação.
- [ ] Confirmar data/horário da convocação para a POC (prazo de 5 dias úteis).
- [ ] Decidir: credenciamento Gov.br homologação (ideal) ou sustentar simulação
  declarada na POC.
- [ ] Registrar domínio + MX (desbloqueia POC-08 real e e-mails de confirmação).
