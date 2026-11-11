# Revisão incremental de formulários — etapas 0–9

Data: 10/11/2026. Estado: complemento implementado, verificado e publicado no incremento `381d54f`, mantido na publicação das etapas 3/4 (`52302eb`). As verificações isoladas descritas abaixo são o registro histórico do complemento. O fechamento integral de 0–9 permanece aberto.

## Lacunas encontradas e correções

| ID/alínea | Lacuna constatada no código | Alteração | Evidência e limite |
|---|---|---|---|
| FOR-P86-02.c/d | Apenas entrada de texto curta, sem limites configuráveis nem placeholder | Texto curto/longo com mínimo, máximo e orientação; validação no servidor | Testes de domínio e controle textarea no Chrome local; falta roteiro persistido em ambiente publicado |
| FOR-P86-02.f/g | Ausência de radio e checkbox nos formulários de workflow | Controles compartilhados nos canais interno, externo identificado e anônimo; checkbox serializado como array JSON dentro do contrato de valores string | Testes de opções inválidas, repetidas, vazias, obrigatoriedade e envio no navegador |
| FOR-P87-01.a | Número sem distinção entre inteiro e decimal | Tipo inteiro, validação de inteiro seguro no servidor e step correspondente no navegador | Fração recusada no navegador e no domínio; decimal continua disponível |
| FOR-P87-01.b/c | Editor de regras expunha apenas igualdade; Ouvidoria anônima não filtrava campos condicionais | Comparadores existentes acessíveis na configuração; renderização condicional comum; comparação de opção múltipla por pertencimento exato | Cenários radio/checkbox no Chrome; não representa entrega das ações independentes de exibir/obrigar/ocultar |
| FOR-P87-01.d | Sem prévia dos controles na configuração | Prévia interativa dos campos não calculados, com condições | Build/tipos; prévia integral com todos os recursos contratuais ainda não comprovada |
| FOR-P87-02.e | Date.parse normalizava datas civis inexistentes, aceitando 30 de fevereiro | Validação por comparação com a data ISO resultante, incluindo regras de ano bissexto | Regressões 1900/2000/2024/2026 e meses inválidos; data atual automática permanece pendente |
| PRO-P56-01.f; URB-P38-01.b | Falha posterior ao cálculo deixava valores parcialmente calculados no objeto recebido | Cálculo em cópia, incorporada apenas após validação integral; recusa de chaves duplicadas | Regressão prova preservação de valores originais após erro e incorporação no sucesso |

Configuração também recusa limites textuais invertidos e opções vazias/duplicadas. Os formatos históricos de campos permanecem disponíveis. Nenhuma migração foi criada ou executada neste incremento.

## Verificações executadas

- `npm run build`: aprovado, incluindo lint e TypeScript.
- `npx tsc --noEmit`: aprovado, também após inclusão do roteiro de navegador.
- `npx tsx --env-file=.env.local --test src/lib/modules/*.test.ts src/lib/operations/formats.test.ts`: **32/32**. Seis testes novos em `workflow-validation.test.ts`.
- `npx tsx scripts/validate-workflow-browser.ts`: **5/5**, Chrome local contra `localhost:3100`, respostas de API interceptadas e nenhuma gravação municipal. Exercita controles condicionais, inteiro, obrigatoriedade do grupo e payload.
- A primeira tentativa da suíte sem `--env-file` falhou na inicialização de `business-hours.test.ts` por ausência de `DATABASE_URL`; a execução corrigida acima passou. Não se trata de teste de integração com banco.
- Nova tentativa de `git push origin main`: encerrou por timeout de 120 segundos, sem confirmação de sincronização. Não inferir sucesso do push.

Esses resultados são de um complemento posterior à publicação `4rCT9aejbqj2eorMQKR9sGFiyYgN`. Não somar os cinco cenários isolados aos 586 testes integrados como se tivessem o mesmo escopo.

## Pendências programáveis desta família

- FOR-P86-01: ajuda por imagem, bloqueio e permissão de edição pós-protocolo, visibilidade interna/externa e tamanho configurável precisam de implementação/conferência individual.
- FOR-P86-02.a/b: títulos e parágrafos de apresentação formatados no formulário não estão cobertos por este complemento.
- FOR-P87-01.c: ações condicionais independentes de exibir, obrigar e ocultar ainda não comprovadas; implementada a condição de aplicabilidade do campo.
- FOR-P87-02.a–c: vínculo CEP→campos de endereço e verificação de existência cadastral CPF/CNPJ precisam de aceite próprio. Dígitos verificadores não provam existência cadastral.
- FOR-P87-02.e: preenchimento automático da data atual ainda não implementado no configurador.
- Falta validar criação/persistência/reabertura pela interface dos três canais com os novos tipos no ambiente publicado.

## Pendências transversais mantidas

Conferência de todas as demais famílias da matriz, aplicação restaurada com armazenamento isolado, carga sustentada com 60 identidades distintas, parametrização municipal, provisionamento da operação contínua e homologação pelas telas continuam pendentes. Este registro não encerra etapas nem autoriza avanço para a etapa 10.
