# Ambientes, versões e reconstrução

## Registro de ambientes — 10/11/2026

| Ambiente | Destino | Estado e uso |
|---|---|---|
| SaaS publicado | `https://rioazul.celeriflow.com.br` | Deployment `Cdhh77Qjnj83sgZMgJnDx9LzHRb7`, commit `52302eb`; Vercel `celeriflow-hub`, conta autorizada `celeriflow@gmail.com`. Fechamento em `FECHAMENTO_ETAPAS_3_4.md`; correção do Neon em `DIAGNOSTICO_VERCEL_2026-11-10.md`. |
| Execução web local anterior | `http://localhost:3100` | Build local; `.env.local` aponta a serviços reais compartilhados com a publicação. Não é isolamento de dados. Servidor encerrado após os ensaios. |
| Preparação de desenvolvimento | `rio_desenvolvimento`, PostgreSQL local, porta 55439 | Banco novo, massa fictícia própria, arquivos privados em diretório exclusivo. |
| Preparação de homologação | `rio_homologacao`, mesmo cluster local | Banco independente, UUIDs/e-mails próprios, sem cópia da produção. |
| Preparação de apresentação | `rio_apresentacao`, mesmo cluster local | Banco independente, massa própria. Não representa apresentação homologada nem login Firebase provisionado. |

Os três bancos locais são reprodutíveis por `stage0:databases`, permanecem preservados após o ensaio e ficam parados. Não têm endpoint Neon/WebSocket, conta Firebase ou Blob remoto próprios. A etapa 0 entrega separação da massa e reconstrução estrutural; publicação de novos SaaS e ativação de provedores são trabalhos posteriores de implantação. Worker, redundância e restauração integral da aplicação continuam na etapa 9.

## Configuração

- Modelo versionado: `config/environment.example`. O antigo `.env.example` é legado; não usar sua menção a mock de identidade como descrição da implementação atual.
- Banco: `DATABASE_URL` para aplicação; `DIRECT_URL` direto para migrações/exportação. Confirmar que ambos identificam a mesma base lógica.
- Identidade: as variáveis Firebase client/admin devem referenciar o projeto do ambiente. Não reutilizar contas de apresentação em desenvolvimento.
- Arquivos: token Blob privado por destino operacional; diretórios separados no ensaio local não equivalem a stores Blob provisionados.
- URL: `NEXT_PUBLIC_APP_URL` deve corresponder à implantação efetiva; usar também nos domínios autorizados e retornos dos provedores.
- Entrada: `DEFAULT_INTAKE_DEPARTMENT_ID` é o UUID do Protocolo do ambiente; não copiar o UUID de produção para uma base nova.
- Segredos: somente arquivos `.env*` ignorados ou configuração protegida do provedor. Não incluir tokens, senha de banco, chaves, manifests privados ou dumps no Git.
- Integrações não configuradas ficam pendentes; não atribuir identidade verificada/envio/assinatura concluídos por existir variável ou tela.

## Reconstrução de código e dados

1. Obter o código da versão pretendida e conferir o inventário SHA-256 em `EVIDENCIAS_ETAPA_0.json` para os arquivos organizacionais/instalação.
2. Node **24.x**, `npm ci` a partir de `package-lock.json`. Não reutilizar `.next` de outra versão.
3. Preparar configuração privada a partir do modelo, sem sobrescrever o `.env.local` existente.
4. Banco novo: `npm run db:migrate -- --apply --initialize-empty`. Banco existente revisado: `npm run db:migrate -- --apply`. Checagem: `npm run db:migrate -- --check`.
5. `npm run lint` e `npm run build`. Encerrar `next dev` antes de build/start na mesma pasta.
6. `npm run start -- --port 3100`; confirmar `/api/health` e executar o roteiro de aceitação aplicável. O health não prova funcionamento das integrações.
7. Recuperação de dados reais: `operations:restore` em destino vazio isolado, com dump/manifesto/originais conferidos. Procedimento em `IMPLANTACAO_ETAPAS_0_9.md`; nunca restaurar sobre a base original como teste.

## Release e reversão

- Referência publicada atual: commit funcional `52302eb`, deployment acima, etapas 3/4 com 156/156 verificações HTTPS. Versão anterior: `381d54f`, deployment `8vT9ccYuszhZmw8SdCrfnTJzjSBQ`, etapas 1/2. Consultar `git status` e os dossiês para os registros documentais posteriores.
- Roteiro: conferir diff → testes afetados → build/lint/tipos → registrar commit e artefatos → push → conferir remoto → publicar com CLI Vercel autenticada → smoke HTTPS e conferência visual → registrar URL/ID e resultado.
- Publicação direta pela CLI foi usada anteriormente; não presumir que um deployment sincroniza o GitHub. Remoto desejado: `https://github.com/Celeriflow-Hub/Celeriflow_Rio_Azul`.
- Se o push falhar, preservar código/commit local e registrar bloqueio; não pedir tokens em conversa nem gravá-los em arquivos versionados.
- Reverter aplicação para deployment conhecido só após conferir compatibilidade com schema aditivo. Não remover colunas/tabelas, editar migrações aplicadas ou truncar registros como rollback.
- Migração com falha: transação por arquivo; corrigir pendência ainda não aplicada ou criar nova migração se já houver aplicação. Histórico/checksum divergente interrompe o executor.
- Versionamento da baseline é exclusivo de instalações novas; nenhum dos nove arquivos históricos foi alterado nesta etapa.

## Incremento das etapas 1 e 2 — 10/11/2026

- Commit funcional `381d54f`, confirmado também no deployment de origem GitHub `3vDS8k4gwcjTMVQYu9yC2NaeJED9` (branch `main`).
- Migração 010 aplicada com estratégia aditiva; banco existente com dez históricos válidos e nenhuma pendência. Novas instalações têm baseline + dez migrações, 52 tabelas.
- 119 verificações integradas locais/Chrome e 44 testes de domínio aprovados. Evidências e limites em `FECHAMENTO_ETAPAS_1_2.md` e `EVIDENCIAS_ETAPAS_1_2.json`.
- Duas publicações CLI e uma GitHub falharam antes do build remoto com `Resource provisioning timed out`. Tentativa de empacotamento local no Windows também não gerou artefato publicável. Não promover saídas incompletas de `.vercel/output`.
- O alias SaaS permanece no deployment `4rCT9aejbqj2eorMQKR9sGFiyYgN`; o incremento das etapas 1/2 e o complemento local de formulários ainda aguardam publicação e validação HTTPS.

**Atualização posterior nesta mesma data — resolvido:** o bloqueio estava na ação Neon `Create database branch for deployment`, obrigatória e habilitada em produção; banco existente pronto. A conexão passou a usar a branch existente, com `deployments.required=false` e `actions=[]`, mantendo variáveis/ambientes. Commit `381d54f` publicado como `8vT9ccYuszhZmw8SdCrfnTJzjSBQ`, incluindo formulários e etapas 1/2. Suite HTTPS: 119/119 aprovadas, preservação e limpeza conferidas. O parágrafo anterior registra apenas o estado durante o bloqueio. Detalhes e reprodução em `DIAGNOSTICO_VERCEL_2026-11-10.md`.
