# Validação técnica e migrations — 11/11/2026

## Resultado da rodada

Rodada solicitada para build, lint, tipos, testes, migrations e dados de apresentação. A validação funcional ocorreu em `http://localhost:3100`, com PostgreSQL/Firebase/Blob compartilhados com a publicação. Suítes de escrita foram executadas sequencialmente, com recursos próprios e limpeza. O servidor desta rodada foi encerrado antes do build final.

| Verificação | Resultado |
|---|---|
| `npm run lint` | Aprovado, sem warnings/erros ESLint |
| `npm run build` | Aprovado, compilação, tipos e 64 páginas estáticas concluídos |
| `npx tsc --noEmit` | Aprovado após as alterações dos scripts |
| Testes unitários | 57/57 |
| Etapas 1/2 | 119/119 |
| Etapas 3/4 | 158/158 |
| Etapas 5/7 | 533/533 |
| Etapa 6 | 196/196 |
| Etapas 8/9 | 187/187 |
| Contatos | 86/86 |
| Relatórios operacionais | 92/92 |
| EAD e suporte | 101/101 |
| Aplicação restaurada com armazenamento isolado | 12/12 |

**Total: 1.484 assertivas das suítes integradas/restauração e 57 testes unitários aprovados**, contados apenas os resultados finais das suítes listadas. Suítes podem verificar aspectos sobrepostos; a soma não representa requisitos contratuais únicos.

A etapa 6 teve uma primeira execução com 182 aprovações e duas falhas por ausência dos executáveis locais de conversão. Os instaladores existentes tiveram SHA-256 conferido e as ferramentas foram recuperadas. A reexecução completa terminou em **196/196**, incluindo PDF/A e OCR reais, com limpeza e preservação aprovadas. Esse incidente não foi omitido nem contabilizado como aprovação inicial.

O Next.js 15.5.29 informa depreciação de `next lint`, cuja remoção está prevista para a versão 16; o lint atual foi aprovado.

## Migrations

- Executados `db:migrate -- --check`, `db:migrate -- --apply` e nova conferência.
- **12 migrations históricas já estavam aplicadas**, com 12 checksums válidos e nenhuma pendência. Nenhuma migration nova foi necessária na base preservada.
- `stage0:databases` reconstruiu três bancos novos e isolados: desenvolvimento, homologação e apresentação.
- Cada banco novo contém **52 tabelas**, baseline mais **12 migrations** (13 entradas de histórico), verificações de checksums, chaves estrangeiras, rollback e proteção do envelope de assinatura aprovadas.
- O problema de pipes herdados por `pg_ctl` no Windows foi corrigido no executor local: saída persistente em descritores de arquivo, encerrados ao fim do comando. O cluster criado pela rodada foi encerrado.
- Não foram utilizados `db:push`, seeds históricos, limpeza global ou regravação dos SQL históricos.

## Carga e restauração

- Carga de leitura autenticada: **3.420/3.420 requisições**, 60 identidades distintas, 57 rodadas, 60.917 ms, p50 768 ms e p95 **985 ms**.
- O recorte de carga não comprova a mistura integral de leituras/escritas de uma prefeitura ou SLA de disponibilidade contínua.
- Restauração: 52 tabelas, arquivos locais remapeados, aplicação autenticada, original conferido por bytes/hash e ausência local sem fallback para o Blob de origem; **12/12**.

## Dados de apresentação e preservação

- Inventário inicial: 25/52 tabelas e 0/27 famílias de módulos com registros.
- Inventário final: **45/52 tabelas e 27/27 famílias**, com 41 registros de módulos e exemplos operacionais vinculados.
- Navegador: login com senha e presença de registros nas 27 listagens, projeto e geoportal conferidos.
- Publicação HTTPS: **33/33 consultas autenticadas aprovadas**, com login por senha; presença de exemplos nas 27 famílias e acesso a documentos, cursos, chamados, relatórios prontos e fila de assinaturas. Contagem adicional à das suítes integradas, com escopo de disponibilidade dos exemplos.
- Preservação comparada com o snapshot anterior ao povoamento: 5.507 linhas, nenhuma exclusão ou alteração inesperada, quatro alterações operacionais esperadas (três contadores e um último acesso), anexo anterior de 78 bytes/hash preservado.
- Roteiro, cobertura de todas as tabelas e lacunas: [DADOS_DEMONSTRACAO_2026-11-11.md](DADOS_DEMONSTRACAO_2026-11-11.md).

## Auditoria de dependências

`npm audit --json` retornou **44 vulnerabilidades: 4 baixas, 31 moderadas, 9 altas e zero críticas**. A auditoria permanece com resultado não aprovado. Não foi executado `audit fix` ou atualização automática de dependências nesta rodada; os testes funcionais aprovados não significam aceite integral de segurança.

## Evidências e limites

As pastas abaixo estão sob `%LOCALAPPDATA%\Temp\opencode`; materiais privados não integram o Git:

| Recorte | Pasta |
|---|---|
| Etapas 1/2 | `stages12-1794367629251` |
| Etapas 3/4 | `stages34-1794367737129` |
| Etapas 5/7 | `stages57-1794367866663` |
| Etapa 6 — execução final | `stage6-1794368963321` |
| Etapas 8/9 e carga | `stages89-1794368301208` |
| Contatos | `contacts-d2c3b6d2-b1a1-4375-9ff1-42cf9be35534` |
| Relatórios | `operations-validation-d363eb9e-56a5-4a2a-aba8-4ebcfa3ae663` |
| EAD/suporte | `learning-support-4fece433-51d6-4469-8c6a-644ec66b8215` |
| Restauração | `restore-app-1794369258864` |
| Reconstrução dos bancos | `stage0-1794369838686` |
| Dados de apresentação e auditoria npm | `demo-aurora-20261111` |

Hashes dos principais relatórios estão em `EVIDENCIAS_VALIDACAO_2026-11-11.json`. Inventários são fotografias no instante da coleta; novas navegações e operações podem incrementar auditoria e acesso.

Os fechamentos técnicos anteriores e as lacunas do plano permanecem válidos. Esta rodada não comprova homologação humana integral, 9/9 da POC, operação permanente, retorno Sisobra, autenticação Gov.br, assinatura ICP-Brasil ou recebimento real por Resend. As alterações de código desta rodada são scripts auxiliares/documentação; os novos dados foram persistidos nos serviços usados pela publicação.
