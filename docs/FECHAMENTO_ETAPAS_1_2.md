# Fechamento técnico — etapas 1 e 2

Data: 10/11/2026. Plano vigente: `PLANO_DESENVOLVIMENTO_POC_E_IMPLANTACAO.md`.

**Etapa 1: oito itens técnicos concluídos. Etapa 2: oito itens técnicos concluídos.**
Aceite municipal/formal continua a cargo dos responsáveis. Este fechamento não atribui aprovação aos nove requisitos da POC nem antecipa as integrações das etapas 10 e 11.

## Etapa 1 — administração, perfis e organograma

| Item do plano | Entrega e evidência executada |
|---|---|
| 1.1 — Provisionamento e credenciais | Firebase e SQL pelo sistema; criação suspensa até terminar o provisionamento; compensação/reconciliação de falha parcial; senha informada ou endereço privado de definição. Novo servidor entrou por e-mail/senha no Chrome. Endereço de recuperação gerado foi consumido no Firebase e a senha resultante autenticou. |
| 1.2 — Autorização efetiva | Perfis, ativação e vínculos consultados no banco em cada sessão; escrita revalidada na transação depois da trava de administração. N3 recusado; token anterior à alteração de perfil/suspensão recusado; reativação conferida. |
| 1.3 — Escopo dos recursos | Lista/busca, detalhe, calendário, prazos, anexo e movimentações vinculados ao documento/setor. Transferência remove o acesso residual de autoria; consulta fora do escopo responde 404. |
| 1.4 — Estrutura organizacional | Setores/subsetores com edição, prevenção de ciclos e vínculos principais/secundários. N1 interage nos subordinados; N2 recusado fora dos vínculos autorizados. |
| 1.5 — Preservação e realocação | Suspender não exclui cadastro; transferência mantém autor e histórico. Desativação sem destino recusada; realocação de servidor e trabalho pendente executada, preservando movimento e setor anterior. |
| 1.6 — Seis perfis | Admin Geral gerencia globalmente e lê no escopo documental; Admin Local possui setores administrados independentes da lotação, sem concessão automática de leitura; N1/N2/N3 e Auditor exercitados por API. Admin e N3 também comparados no navegador. |
| 1.7 — Ficha funcional | Sexo, nascimento, foto, cargo/matrícula, telefone, editor, anexos, e-mail secundário, opções de notificação, férias/licenças, último acesso e histórico. Preferência de editor altera a toolbar; telefone oculto/divulgado conferido. Suspensão por inatividade configurável com reativação pelo administrador. |
| 1.8 — Auditoria | Eventos persistidos com ator/data/hora e contexto IP/navegador/versão; histórico cadastral com antes/depois; acessos de sessão e documento registrados. Presença aproximada por heartbeat de um minuto, com indicação online por janela de dois minutos e atualização da lista. |

Referências exercitadas: POC-P25-01; ACE-P31-01; ACE-P31-03; ACE-P32-01; ACE-P32-02.b/c; ACE-P32-03 no recorte de cadastro/preferências; ACE-P32-04.b; ACE-P33-01/02; ACE-P33-03 no mecanismo de presença/último acesso/inatividade. Não atribuir aceite integral às famílias que também incluem notificações externas, relatórios globais ou identidade avançada.

## Etapa 2 — documentos, calendário e tramitação

| Item do plano | Entrega e evidência executada |
|---|---|
| 2.1 — Numeração | Sequência por tipo/ano e código de negócio `aaaammddxxxxx`; concorrência sem repetição/lacuna entre as criações; data civil de São Paulo incluindo virada de ano UTC e ano bissexto. Contadores não avançam após criação rejeitada. |
| 2.2 — Atomicidade | Contadores, documento, participações, prazos, movimentos e auditoria na mesma transação. Falha de FK induzida sem registro parcial nem alteração de contador. Notificação externa preparada contém o código real e permanece pendente. |
| 2.3 — Editor | Formatação sanitizada, persistida e reaberta; conteúdo executável removido e documento vazio recusado. Redação e criação pela interface conferidas. |
| 2.4 — Calendário/atividades | Dois prazos por documento visíveis no detalhe e grade mensal; seleção de mês, agenda, situação e edição/conclusão. Alteração gera evento interno na timeline e auditoria. |
| 2.5 — Transições | Receber/despachar/responder/concluir/arquivar/reabrir com permissão e estado por setor. Corrida de encaminhamento produz um vencedor e um conflito, sem movimentos duplicados. |
| 2.6 — Multissetorial | Cópias na criação e encaminhamento; participação independente; conclusão de um setor não encerra os demais. Percurso A→B→C preserva origem/destino real, ator e data/hora; recebimento remete ao despacho precedente. |
| 2.7 — Anexos | Blob privado; download autenticado por clique no Chrome; hash idêntico ao original; acesso anônimo recusado. Registro e contagem de downloads; tamanho servido usa os bytes reais do armazenamento. |
| 2.8 — Consulta/timeline | Filtros por tipo/situação/setor; pesquisa por assunto, código ou número/ano; paginação padrão de 20; ordenação por data/hora e UUID. Ações de prazos/anexos respeitam participação ativa na interface e na API. |

Referências: POC-P25-04/05; MEM-P52-02; ORG-P66-01/ORG-P67-01 no recorte de participação/tramitação; ANX-P77-01 no recorte de privacidade/download; F06/F11/F12. Complementos de GED, notificações e módulos permanecem nas etapas responsáveis.

## Verificações e preservação

- Build de produção concluído, com lint e tipos sem advertências.
- **44 testes de domínio/formatos/perfis aprovados**.
- **119 verificações integradas locais aprovadas**, incluindo Chrome real com contas temporárias, APIs reais Firebase/Neon/Blob e limpeza própria.
- **119 verificações integradas no SaaS HTTPS aprovadas** após correção da ação de criação de branch do Neon; mesma suíte, com cadastro/login, documentos/calendário, anexos e preservação conferidos na versão publicada.
- Reconstrução da migração aditiva 010 aprovada nos três bancos locais: **52 tabelas e 11 históricos** por banco novo, checksums/FKs/rollback aprovados. Banco existente: dez migrações aplicadas; baseline não reaplicada.
- Snapshots privados anteriores à migração e às rodadas preservados; sete conjuntos de dados originais comparados por fingerprint após limpeza. Bytes do anexo original novamente conferidos por SHA-256.
- Artefatos, cenários e hashes: `EVIDENCIAS_ETAPAS_1_2.json`. Dados privados, credenciais e arquivos originais ficam exclusivamente no diretório temporário protegido.
- Rodadas interrompidas preservadas: suspensão por inatividade com parâmetro SQL sem cast, corrigido; seletor exato de origem no roteiro Chrome, corrigido. Rodadas finais completas registradas separadamente.

## Reprodução

1. Conferir configuração e `npm run db:migrate -- --check`.
2. `npm run build`; iniciar `npm run start -- --port 3100` sem outro processo sobre a mesma `.next`.
3. `npm run validate:stages12 -- --snapshot`; anotar o diretório retornado.
4. `npm run validate:stages12 -- --allow-write --base http://localhost:3100 --directory "<diretório>"`.
5. Em interrupção de limpeza: `npm run validate:stages12 -- --cleanup --directory "<diretório>"`. Somente IDs de recursos criados pelo roteiro são removidos; a auditoria permanece.
6. O SaaS exige `--allow-production --base https://rioazul.celeriflow.com.br`, além das opções explícitas anteriores; executar sequencialmente às demais suítes de escrita.

## Versão e histórico do bloqueio de publicação

**Bloqueio resolvido nesta mesma data:** [DIAGNOSTICO_VERCEL_2026-11-10.md](DIAGNOSTICO_VERCEL_2026-11-10.md). A ação Neon de criação de branch em cada deploy de produção foi desativada na conexão existente. Deployment `8vT9ccYuszhZmw8SdCrfnTJzjSBQ` publicado no alias público; 119/119 verificações HTTPS aprovadas. Os itens abaixo preservam o diagnóstico anterior à resolução.

- Implementação e fechamento local: commit `381d54f6cbea38553abb6529bb867475d20936ef`.
- O push pela CLI desta execução exigiu autenticação; depois, `origin/main` foi sincronizado por outra operação. A Vercel confirmou o mesmo SHA em um deployment de origem GitHub (`3vDS8k4gwcjTMVQYu9yC2NaeJED9`, repositório 1385843702, branch `main`). Portanto o código chegou ao remoto, apesar da falha da primeira tentativa da CLI.
- **Bloqueio anterior:** deployments CLI `A2fxaP9Mhrx5zHDz8VAorL9ZVji1` e `2DfmYuaave2t2Z4T9gR75jeq6amD`, e deployment GitHub `3vDS8k4gwcjTMVQYu9yC2NaeJED9`, todos com `BUILD_FAILED / Resource provisioning timed out`, antes da compilação remota. Causa depois identificada na ação da integração Neon, com banco existente pronto.
- Recuperação local de empacotamento também não produziu artefato publicável: CLI 65 exigiu privilégios de symlink do Windows; CLI 48 compilou a aplicação, mas o empacotador não encontrou a lambda de `/cidadao/conta/cadastro`. Nenhum desses artefatos foi promovido. A configuração privada original foi preservada; o arquivo gerado pela CLI teve seus placeholders restaurados.
- Durante o bloqueio, produção permaneceu no deployment anterior `4rCT9aejbqj2eorMQKR9sGFiyYgN`. As verificações locais desse momento não foram contadas como publicação.
- Release concluída após a correção: commit funcional `381d54f`, deployment `8vT9ccYuszhZmw8SdCrfnTJzjSBQ`. A migração 010 aditiva continua compatível com a versão anterior. Homologação humana permanece pendente.

## Roteiro curto para conferência do proprietário

1. **Servidores:** cadastrar servidor, entrar com a nova conta e comparar Admin × N3. Transferir ou suspender e confirmar a mudança de acesso; consultar o histórico.
2. **Setores:** conferir hierarquia e vínculos; para Admin Local, configurar setores administrados separadamente da lotação. Abrir servidores/telefones e verificar privacidade.
3. **Documentos:** criar dois memorandos sucessivos, formatar o corpo e cadastrar dois prazos. Reabrir e conferir código e sequência documental.
4. **Calendário:** selecionar o mês, abrir ambos os prazos e concluir uma atividade; conferir o evento na timeline.
5. **Tramitação:** despachar A→B→C com contas dos setores, recebendo em cada destino. Testar cópia, conclusão setorial e reabertura.
6. **Anexos:** anexar e baixar por clique com sessão; conferir recusa sem autorização. N3 deve consultar sem botões de escrita.

Recuperação por endereço privado e alteração de senha foram executadas no Firebase. Entrega de e-mail à caixa do destinatário, confirmação de troca de e-mail e notificações operacionais reais devem ser homologadas com os canais configurados nas etapas finais. Presença é estimada pelo heartbeat; não comprova conexão de rede instantânea. Nenhum ensaio automatizado substitui homologação humana.
