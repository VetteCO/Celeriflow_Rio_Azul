# Urbanismo, fiscalização e operação — etapas 8 e 9

## Escopo e critérios de conclusão

Este dossiê registra o incremento funcional das etapas 8 e 9 e suas execuções de aceite. O aceite contratual integral continua condicionado à base territorial municipal validada, retorno real do Sisobra e infraestrutura permanente. A homologação humana segue o roteiro abaixo.

## Entregas territoriais

- Projetos de construção/parcelamento usam fluxos versionados, participantes, documentos de origem, anexos PDF/DWG, recusa fundamentada, aceitação posterior e decisão multissetorial. Arquivos DWG são preservados como originais; o visualizador e as medições operam sobre a planta PDF.
- Medições vinculam arquivo, hash, página, escala, forma, pontos e apresentação. O servidor baixa e confere o original, recusa página inexistente, coordenadas fora da página e rotação incompatível. Área de retângulo/elipse/polígono e distância de polilinha são calculadas sem aceitar resultado fornecido pelo cliente.
- Cópia anotada recebe desenhos e selo textual explicitamente sem assinatura; o original permanece com o mesmo hash. Não corresponde a assinatura digital ou carimbo criptográfico.
- Parâmetros urbanísticos conferem área de terreno, projeção, construção e permeabilidade; rejeitam alocações impossíveis. A comparação autenticada com legislação ativa identifica as revisões do projeto e da norma, coeficiente, ocupação e permeabilidade, inclusive parâmetro não informado. O enquadramento e a decisão são administrativos.
- Licenciamento ambiental e fiscalização vinculam projeto e protocolo/documento de origem, preservando análises e decisões próprias.
- Vistoria possui API autenticada em `/api/modules/records/[id]/inspections`, localização WGS84, precisão opcional, captura/recebimento separados, constatações, providências e evidências pertencentes ao processo. O formulário captura GPS do dispositivo ou coordenadas informadas.
- `operationId` UUID e hash canônico garantem repetição segura, inclusive após perda da confirmação e em requisições concorrentes. Reutilização com outro conteúdo/autor é recusada. Nova vistoria exige etapa/setor autorizado e processo em andamento. O aplicativo e o armazenamento offline no dispositivo pertencem à etapa móvel.
- Geoportal aceita GeoJSON e SHP/DBF/PRJ, reprojeta para WGS84, conserva atributos e versão anterior e exige publicação explícita. Pesquisa, filtros, distância aproximada, consulta pontual e desenho de área usam bases autorizadas; vazios de polígonos não são tratados como zona preenchida. Nomes SHP `NOME`/`NAME` recebem identificação acessível.

## Sisobra e dados municipais

Os pedidos existentes de envio, retificação, cancelamento e reativação registram intenção/histórico e permanecem **aguardando configuração**. Ainda não comprovam serialização XSD, assinatura, transmissão ou recebimento pela Receita. Não há recibo governamental produzido neste incremento.

Referência oficial consultada: [documentos técnicos SisobraPref](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/sisobrapref), **manual Web Service 1.06 e esquemas XML 1.03, de 01/07/2024**, apresentados como atuais pela Receita na consulta. O manual 1.01 é histórico. A integração final deve validar os esquemas vigentes, assinatura XML e autenticação mútua com certificado institucional, além do credenciamento/DTE aplicável. Integração e homologação efetiva permanecem na etapa 10 conforme o plano; uma fila local não equivale ao serviço integrado.

Legislação/zoneamento/camadas possuem cadastros e versões. Os ensaios usam dados próprios de Aurora das Veredas e não atestam vigência nem exatidão cartográfica de Rio Azul. Fornecimento e validação das bases continuam com a Administração.

## Operação e continuidade

- Relatórios reconciliados com SQL, filtros, gráficos, CSV/PDF/XLSX, snapshots, fila assíncrona dirigida e downloads privados reutilizam a implementação de `FECHAMENTO_OPERACAO.md`.
- EAD e suporte usam cursos/aulas ordenadas, progresso, avaliação, nota/certificado PDF e chamados com responsável, escalonamento, histórico, avaliação e prazos. Conteúdo institucional e atividades presenciais precisam de registro real.
- Exportação integral usa snapshot PostgreSQL, NDJSON por tabela, schema/DDL, dump e originais por streaming, com manifesto SHA-256. A divergência de tamanho cadastrado do anexo legado é registrada, preservando seus 78 bytes; não se altera silenciosamente o cadastro original.
- O novo ensaio `validate:restore-app` restaura banco vazio e arquivos em cluster/diretório locais novos, verifica contagens/FKs/hashes e remapeia apenas as chaves do banco restaurado. A aplicação Next usa ponte SQL restrita a loopback e armazenamento local isolado. A ausência de arquivo isolado nunca consulta o Blob de origem.
- O modo de restauração exige nome de banco confirmado, destinos locais e caminho aleatório de 256 bits, sendo recusado no ambiente Vercel. O driver nativo PostgreSQL é dependência de desenvolvimento do executor.
- A carga sustentada cria 60 identidades internas/Firebase distintas, realiza lotes de 60 leituras autenticadas concorrentes por pelo menos 60 segundos e dez rodadas, registra latências/erros e limpa os próprios recursos. Não mede toda a mistura de tramitação/anexos do Município nem disponibilidade contínua.

## Reprodução

Somente uma suíte de escrita por vez; `.env.local` compartilha os provedores de produção. Cada suíte registra os recursos próprios e reconfere os originais após limpeza.

```powershell
npm run validate:stages89 -- --allow-write --base http://localhost:3100
npm run validate:restore-app -- --run --authorize-full-export
npm run validate:operations -- --run --base http://localhost:3100
npm run validate:learning-support -- --allow-write --resolve-admin-from-db --base http://localhost:3100
```

Aceitação HTTPS territorial/carga usa `--allow-production --base https://rioazul.celeriflow.com.br`. O ensaio de restauração permanece no ambiente isolado. Não executar build/dev/start simultâneos sobre a mesma `.next` durante as validações.

## Roteiro de homologação humana

1. Selecionar fluxo territorial, cadastrar participantes e vincular documento de origem; anexar PDF e DWG e protocolar.
2. Recusar fundamentadamente um arquivo e aceitar a revisão; medir distância/área, calibrar escala e gerar cópia anotada; baixar e comparar o original.
3. Comparar o projeto com a revisão legal selecionada e conferir os limites com o responsável técnico; percorrer os setores e fundamentar a decisão.
4. Abrir licenciamento/fiscalização vinculados, capturar GPS, anexar evidência e registrar duas vistorias; conferir histórico e acesso por outro setor/perfil de consulta.
5. Importar base SHP com PRJ e DBF, revisar coordenadas/atributos, ativar sem publicar e confirmar ausência pública; publicar autorizadamente e conferir filtros/proximidade/viabilidade.
6. Gerar relatório com período/setor/módulo, reconciliar com registros de origem e baixar os três formatos; concluir curso e chamado com avaliação.
7. Reproduzir exportação/restauração isolada e conferir documento/anexo pela aplicação; consultar o relatório da carga de 60 identidades e dimensionar a mistura real de uso.
8. Registrar definições municipais de bases/regras, capacitação, responsáveis, visitas e manutenção. O aceite de Sisobra, redundância, alertas e SLA exige suas evidências específicas.

## Execuções e publicação

Versão funcional: **`1f00cc6`**, publicada no deployment **`dpl_4VfwFB5GRdrhbzBNeAGm3o4UJmyZ`**, estado **READY**, com build/lint/tipos remotos aprovados. Endereço: `https://rioazul.celeriflow.com.br`; URL imutável: `https://celeriflow-rio-azul-7tgeoeqep-celeriflow-hub.vercel.app`. Health público retornou `{"ok":true,"service":"celeriflow"}`. O envio ao GitHub foi tentado novamente, mas a autenticação não interativa continua recusada (`Cannot prompt because user interactivity has been disabled`); os commits locais foram preservados.

Cópia Git completa da versão funcional: `%LOCALAPPDATA%/Temp/opencode/stages89-release-20261110/functional-1f00cc6.bundle`, validada por `git bundle verify`. O pacote contém o histórico completo de `main` até `1f00cc6ff158ad2e01a7f0bb1b58584e59df0e9a`; credenciais e artefatos privados de ensaio não são incluídos no Git.

Aceite local final `stages89-1794363212328`: **187/187 PASS**, zero falhas/bloqueios, limpeza própria e reconferência dos originais aprovadas. Carga: **3.180/3.180 requisições**, 60 identidades, 53 rodadas, 61.169 ms, p50 753 ms, p95 1.015 ms, máximo 2.487 ms. Relatórios: **92/92**, `operations-validation-e6c0e7f0-20d9-41e6-8e1a-37ddf2f1a9c6`; EAD/suporte: **101/101**, `learning-support-63ae355e-87d7-43d4-b8cf-dc8dfd080996`. Build/lint/tipos aprovados; 56 testes de domínio e um teste adicional de guarda do ambiente restaurado aprovados. Checagem de banco: 12 checksums válidos, nenhuma migração pendente.

Aceite HTTPS final `stages89-1794363930834`: **187/187 PASS**, zero falhas/bloqueios, limpeza e reconferência de preservação aprovadas. Carga de leitura autenticada: **2.580/2.580**, 60 identidades distintas, 43 rodadas concorrentes, **61.141 ms**, p50 **942 ms**, p95 **1.281 ms**, máximo **3.113 ms**. Os 60 usuários próprios foram removidos após a rodada, preservando os usuários originais. Relatórios HTTPS: **92/92**, `operations-validation-9377dd3c-1bba-41e6-9c9d-1c11ccf530c4`; EAD/suporte HTTPS: **101/101**, `learning-support-41047831-5ce3-4742-80f8-bf0e60a2a9f6`, limpeza completa. Inventário verificável: `EVIDENCIAS_ETAPAS_8_9.json`, com assertivas, resumos das cargas e hashes de artefatos/fontes.

**Situação final:** incremento funcional publicado e validado nos recortes descritos. As etapas 8/9 não recebem aceite integral: faltam a integração técnica e o retorno real do Sisobra, bases/regras municipais validadas, operação contínua e redundância contratada, dimensionamento da mistura real de uso e homologação/atividades humanas. As lacunas avançadas de formulários registradas em `REVISAO_FORMULARIOS_0_9_2026-11-10.md` continuam abertas; a suíte territorial não comprova essas alíneas. O checklist do plano conserva os itens pendentes explicitamente.

Rodada diagnóstica posterior `stages89-1794362594147`: **183 PASS / 1 FAIL**, limpeza/preservação aprovadas. A interação real do mapa revelou regra global `.app-shell svg` que forçava gráficos/mapas a 22 px de altura. A regra foi limitada aos ícones de navegação/detalhes; a rodada final exige altura útil do mapa e gráfico, interação com a feição importada e tabela de relatórios ajustada ao desktop. Ajuda operacional foi ampliada e o formulário remove precisão de GPS quando há alteração manual de coordenadas, além de atualizar o histórico antes da revisão de operação pendente.

Rodada diagnóstica `stages89-1794361617847`: **178 PASS / 1 FAIL**, limpeza e preservação aprovadas. A falha foi o seletor acessível de feição SHP com atributo `NOME` em maiúsculas; o mapa foi corrigido para reconhecer `NOME`/`NAME`. Os resultados reprovados são mantidos. A carga desta rodada aprovou **3.540/3.540 requisições**, 60 identidades, 59 rodadas, 60.505 ms, p95 1.185 ms e máximo 2.692 ms.

Primeiro diagnóstico de restauração `restore-app-1794362037831`: exportação integral concluída; execução interrompida após o início do cluster por herança de pipes do processo PostgreSQL no Windows. Cluster próprio encerrado. O executor foi corrigido para gravar diretamente em descritores de log, e a aplicação/ponte agora reservam portas locais livres, recusando processos encerrados durante a prontidão.

Restauração final `restore-app-1794362542089`: **12/12 PASS**, 52 tabelas e três referências de arquivos restauradas/remapeadas, aplicação autenticada e original de 78 bytes/SHA-256 conferidos. Resposta HTTP de streaming usou `Transfer-Encoding: chunked` sem `Content-Length`; o ensaio foi corrigido para aceitar essa transferência legítima e conferir os bytes contra o arquivo isolado, recusando comprimento divergente quando informado. Rodadas diagnósticas `restore-app-1794362411151` e `restore-app-1794362476987` preservam as assertivas anteriores reprovadas de cabeçalho; seus clusters foram encerrados. Rodada final: 11/11/2026, 02:02:22–02:02:59 UTC, **37.551 ms** para cópia/recuperação/conferências deste acervo; amostra técnica, não RTO contratual de desastre. Aplicação, ponte e cluster próprios encerrados ao final.
