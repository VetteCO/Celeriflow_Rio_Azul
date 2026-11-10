# Fechamento técnico da etapa 0 — organização e base de execução

Data: 10/11/2026. Escopo: sete itens da etapa 0 do plano vigente. **Conclusão técnica: 7/7 itens atendidos**, com os limites de ambiente descritos abaixo. Não constitui homologação das funções, da POC nem da implantação integral.

## Critérios e evidências

| Item | Entrega comprovável | Estado |
|---|---|---|
| 0.1 Matriz rastreável | `MATRIZ_REQUISITOS_IMPLANTACAO.md` + índice `CONTROLE_REQUISITOS.json`: 172 grupos, 909 unidades individuais, fonte, escopo/etapas, responsável técnico/de aceite, critério e estado inicial individual explícito. | Concluído |
| 0.2 Desdobramento por família | Alíneas extraídas sem renumerar IDs; texto integral preservado inclusive nos grupos com introdução. Nove itens POC, seis grupos UI e famílias do edital/TR. Gerador verifica duplicidade e consistência. | Concluído |
| 0.3 Estados distintos | Fluxo planejado → em desenvolvimento → implementado → testado internamente → validado em tela → homologado; aceite individual pendente quando não há prova. Registros incrementais anteriores preservados. | Concluído |
| 0.4 Separação e massa reproduzível | Três bancos locais novos, 50 tabelas cada, IDs/e-mails distintos, diretórios de arquivos próprios e massa fictícia Aurora das Veredas. Executor não consome credenciais/URLs da produção. | Concluído para preparação de dados |
| 0.5 Migrações/recuperação | Nova baseline exclusiva para banco vazio, checksum, nove históricos preservados, verificação somente leitura e transação por arquivo. Reconstrução local e rollback testados; restauração anterior referenciada por hash. | Concluído |
| 0.6 URL/versões/configuração/build/deploy | `AMBIENTES_E_RELEASES.md`, modelo sem segredos e inventário SHA-256 de fontes/evidências. URL e deployment publicados registrados; complementos locais diferenciados. | Concluído |
| 0.7 F01–F12 como tarefas reproduzíveis | `TAREFAS_REGRESSAO_F01_F12.md`: uma tarefa por achado, etapa, IDs, reprodução, esperado, regressão, evidência e pendência. F03/F09/F10 continuam nas integrações finais. | Concluído |

## Verificações

- `npm run stage0:databases`: três bancos construídos desde zero, baseline + nove migrações, checksums conferidos, zero FKs não validadas, rollback intencional aprovado em cada banco. Evidência: `stage0-1794339110524/results.json` no temporário privado.
- `npm run db:migrate -- --check`: base existente com **nove checksums históricos válidos e nenhuma migração pendente**, somente leitura. Baseline não aplicada à base preservada.
- `npm run stage0:register`: verifica o índice derivado da matriz; geração inicial com `--write`.
- `npm run build`: aprovado, incluindo lint, TypeScript e geração de 62 páginas estáticas. O primeiro build identificou a exigência de `NODE_ENV` na tipagem dos subprocessos; corrigida antes do build final aprovado.
- `scripts/stage0-evidence.ts`: reconfere existência/hashes dos artefatos anteriores e HTTP 200/`ok=true` do health HTTPS; gera `EVIDENCIAS_ETAPA_0.json` sem copiar conteúdo privado.

Uma tentativa inicial do ensaio local falhou por configuração vazia de `PGSERVICEFILE`; o executor passou a remover as variáveis PG herdadas e a fixar somente o destino local. A rodada aprovada criou um cluster novo. Nenhuma falha foi reclassificada como sucesso.

## Limites precisos do fechamento

1. Os três bancos locais separam **dados de preparação**, não são três SaaS prontos. Contas Firebase, stores Blob e transporte Neon não foram provisionados neles. Não existe alegação de login, envio real ou apresentação homologada nessas bases.
2. Abrir a aplicação restaurada com arquivos remapeados, provisionar workers/backups/redundância e medir carga sustentada continuam na etapa 9. A reconstrução estrutural da etapa 0 foi comprovada sem esses serviços.
3. O índice individual inicia em `planejado` quando não há aceite individual consolidado; isso não apaga implementações nem as 586 evidências integradas anteriores. Estas continuam nos registros incrementais. O índice é gerado e não deve receber edições manuais que sejam perdidas na regeneração; novas evidências são registradas por ID na matriz/dossiês, com os campos definidos abaixo.
4. Push GitHub e publicação do complemento local são pendências de distribuição registradas. Nova tentativa com prompts desabilitados retornou `Repository not found` e indisponibilidade de autenticação interativa; isso não distingue repositório privado sem permissão de repositório inexistente. O código e os artefatos estão no repositório local; não equiparar deployment Vercel com sincronização do remoto.
5. Declarações legais, marcos da OS e aceite municipal dependem dos responsáveis e permanecem nas linhas contratuais da matriz. A etapa 0 organiza essas obrigações; não assina declarações nem atribui aceite à comissão.

## Registro de avanço e responsabilidade

Responsável técnico pelas entregas: Celeriflow; execução desta conferência assistida pelo agente. Proprietário decide configuração/credenciais; Município/comissão/fiscal homologa os itens aplicáveis. Não foi inventado nome de responsável municipal.

Para cada aceite futuro registrar: `ID/alínea; estado; versão; ambiente/URL; data; responsável; cenário/massa; esperado; obtido; resultado; artefato; pendência`. A aprovação de um componente compartilhado precisa de conferência de integração no módulo correspondente. Nunca atualizar estado de uma família inteira com base na soma de testes.

O percentual técnico da etapa 0 passa a **100% dos seus sete itens de preparação**, sem alterar os percentuais/estados das etapas 1–13.
