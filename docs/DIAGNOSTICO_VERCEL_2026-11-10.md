# Vercel — diagnóstico e correção do bloqueio de publicação

Data: 10/11/2026. Projeto: `celeriflow-rio-azul`, equipe `celeriflow-hub`.

**Resolvido.** A publicação das etapas 1/2 e do complemento de formulários está em produção no deployment `8vT9ccYuszhZmw8SdCrfnTJzjSBQ`, commit `381d54f6cbea38553abb6529bb867475d20936ef`.

URL: https://rioazul.celeriflow.com.br

## Causa identificada

A mensagem genérica `BUILD_FAILED / Resource provisioning timed out` ocorria no provisionamento de **uma ação da integração Neon**, antes da compilação da aplicação. A máquina Basic foi alocada; a ausência de logs não era evidência de falta de CPU/memória.

Consulta de `GET /v1/deployments/<id>/integrations` mostrou:

- Banco `Celeriflow_RioAzul`: estado `ready`.
- Ação `Create database branch for deployment`, slug `Neon`: estado `timeout`.
- Conexão `spc_e6mX0Roo3Zu6oMZo`: `deployments.required=true`, ação habilitada para `production`.
- Nova tentativa reproduziu o erro em `f2XsN3k7TvFCXkQvDfPfFWNrZWBM`: integração iniciou em `1794345906865` e expirou em `1794346132077`, aproximadamente 225 segundos. API de eventos de build retornou `[]`.
- Banco disponível, plano ativo e `usageQuotaExceeded=false`; não foi encontrado bloqueio de quota/conta. O painel público da Vercel indicava sistemas operacionais.

Não foi possível determinar, somente com a API da Vercel, o motivo interno de o Neon não concluir a criação da branch. A falha da ação e seu efeito sobre o deploy foram comprovados; não atribuir o problema a código Next.js, Node 24, GitHub ou indisponibilidade geral de máquinas.

## Correção aplicada

A documentação do Neon orienta deixar **Production desmarcado** em “Create database branch for deployment”: a publicação de produção usa a branch de produção existente.

1. Conferida a base existente através de sessão Firebase real no SaaS: 15 servidores e seis setores coincidiram com o banco configurado; três documentos autorizados para o administrador usado na conferência.
2. Ajustada a conexão existente, preservando recurso, prefixo, variáveis e ambientes `preview`/`production`:

   ```json
   { "deployments": { "required": false, "actions": [] } }
   ```

   Payload versionado: `config/vercel-neon-production-connection.json`.

   Comando executado, com a CLI autenticada:

   ```powershell
   npx --yes vercel@latest api /v1/storage/stores/store_rIAtchPYYn4Pq2e1/connections/spc_e6mX0Roo3Zu6oMZo --method PATCH --input config/vercel-neon-production-connection.json --scope celeriflow-hub
   ```

   A ação anterior estava habilitada somente para produção; nenhuma criação automática em preview foi acrescentada. Configuração de ambientes isolados permanece no plano de implantação.

3. Refeito o deployment do mesmo commit GitHub. Resultado `READY`, build de aproximadamente 82 segundos, máquina Basic de 2 vCPU/8 GiB, alias público atribuído.

## Validação após a publicação

- Deployment: `dpl_8vT9ccYuszhZmw8SdCrfnTJzjSBQ`.
- URL de versão: `https://celeriflow-rio-azul-mih0m6jcf-celeriflow-hub.vercel.app`.
- Commit GitHub confirmado pela API: `381d54f6cbea38553abb6529bb867475d20936ef`.
- `/api/health`: HTTP 200, `ok=true`.
- Sessão autenticada e conferência de servidores/setores aprovadas após o deploy.
- **119/119 verificações de API/Chrome no SaaS HTTPS aprovadas**, incluindo cadastro/login, recuperação de senha por link privado, perfis, transferência/suspensão/reativação, numeração concorrente, rollback, tramitação, calendário e download autenticado por clique.
- Recursos próprios do roteiro removidos; sete fingerprints originais e bytes do anexo original conferidos após limpeza. Permanecem 15 servidores, cinco documentos, seis setores e um anexo original. Auditoria mantida.
- Evidência: `stages12-1794346567150` no diretório temporário aprovado, incluindo screenshots e resultados. Inventário sem segredos: `EVIDENCIAS_ETAPAS_1_2.json`, com as rodadas local e publicada.

Verificação autenticada reproduzível, sem imprimir credenciais ou cadastros:

```powershell
npx tsx --env-file=.env.local scripts/verify-published-core.ts https://rioazul.celeriflow.com.br
```

## Histórico preservado

Deployments CLI `A2fxaP9Mhrx5zHDz8VAorL9ZVji1`/`2DfmYuaave2t2Z4T9gR75jeq6amD` e GitHub `3vDS8k4gwcjTMVQYu9yC2NaeJED9` permanecem com erro para rastreabilidade. As falhas de empacotamento local no Windows registradas anteriormente eram tentativas de contorno distintas; a resolução usou o build remoto Linux normal da Vercel.

## Referências consultadas

- https://vercel.com/docs/deployments/troubleshoot-a-build#integration-resource-provisioning-failures
- https://neon.com/docs/guides/vercel-managed-integration#connecting-the-database-to-a-vercel-project
- https://www.vercel-status.com/api/v2/summary.json

Este registro substitui o bloqueio de publicação documentado no fechamento anterior. Homologação municipal e integrações finais mantêm seus próprios critérios.
