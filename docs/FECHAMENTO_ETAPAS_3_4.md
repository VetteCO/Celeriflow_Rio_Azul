# Fechamento técnico — etapas 3 e 4

Data: 10/11/2026. **Etapa 3: 6/6 itens; etapa 4: 9/9 itens tecnicamente concluídos**, implementados, exercitados por API e pelas telas, e publicados no SaaS. Homologação municipal permanece como aceite humano próprio.

## Versão publicada

- SaaS: https://rioazul.celeriflow.com.br
- Deployment: `dpl_Cdhh77Qjnj83sgZMgJnDx9LzHRb7`, estado `READY`, alias confirmado pela API da Vercel.
- URL de versão: https://celeriflow-rio-azul-2jjpczpmf-celeriflow-hub.vercel.app
- Código funcional: `52302eb3dc548407b88425d3db8980acee797c2c`.
- A publicação foi realizada pela CLI autenticada da Vercel. A sincronização GitHub dos commits locais não foi confirmada: `git push` não obteve credencial no ambiente sem interação. O código publicado e o histórico local estão preservados; bundle completo acompanha os artefatos privados da rodada HTTPS.
- Publicação pelo build remoto normal, com a integração Neon usando o banco existente conforme correção já documentada. Compilação, lint e tipos aprovados localmente e na Vercel.
- Migração aditiva `011_circulars_citizen_completion.sql`: modo de resposta da circular, responsável individual e proteção de primeira leitura. Migrações anteriores intactas. Banco existente: 11 históricos válidos, nenhuma pendência. Reconstrução de três bancos independentes: 52 tabelas e 12 históricos em cada um (inclui baseline), checksums/FKs/rollback aprovados.

## Etapa 3 — critérios e evidências

| Item do plano | Entrega e verificação |
|---|---|
| Contagem individual uniforme | `circularPopulation` é comum à lista e ao detalhe. População distinta por servidor destinatário, excluindo cancelados e recibos alheios à população. Filtro de não lidos não altera os totais do detalhe. Lista/detalhe/filtro comparados na suíte. Paginação padrão de 20. |
| Contexto autorizado e recibos pertinentes | Origem setorial, destinatário individual com vínculo autorizado e Auditor definem a consulta. Administração global de usuários não gera acesso documental global. Setor removido perde acesso; abertura pelo remetente/observador não gera recibo se não for destinatário. Escritas revalidam papel/ativação/escopo após trava compartilhada com a administração. |
| Primeira leitura imutável e concorrente | Oito confirmações concorrentes produziram um recibo com um único timestamp. `ON CONFLICT DO NOTHING`, unicidade documento/usuário e trigger que recusa alteração de identidade/data da primeira leitura. Recibo anterior preservado após remoção/reinclusão. |
| Vários setores e subsetores; alterações | Organograma hierárquico comum à criação e à edição, seleção individual/todos/limpar e inclusão de descendentes. A edição atualiza o setor de destinatários transferidos, encerra participação removida, preserva recibos e revalida a população na transação. Criação e alteração exercitadas no Chrome. |
| Urgente e Meramente Informativa | Ambos os tipos em cadastro/lista/detalhe. Informativa nega resposta e encaminhamento também na API, mantendo leitura, anexos e atividades autorizadas. |
| Respostas, anexos, atividades e arquivo | Seleção entre respostas abertas e restritas ao setor remetente. Abertas chegam a todos os envolvidos; restritas somente ao remetente setorial, ao próprio autor da resposta e Auditor. Projeção comum protege os dois endpoints de detalhe. Upload privado, prazos e conclusão/arquivamento por setor exercitados sem encerrar demais destinatários. |

**Regra da população:** a circular registra os servidores destinatários no envio/edição, não uma lista que muda silenciosamente com toda alteração de pessoal. Uma transferência revoga o contexto anterior; o remetente pode atualizar os destinatários pelo organograma. Recibos antigos continuam históricos e não são reiniciados ao reincluir o mesmo servidor. Arquivos anexados ao documento são compartilhados com os envolvidos autorizados; não são anexos privados de uma resposta restrita.

O encerramento atende aos seis itens da etapa. Arquivamento automático por data, execução contínua de rotinas e interrupção de notificações futuras continuam associados aos critérios específicos de implantação/infraestrutura das etapas 6/9/11; não foram declarados homologados neste recorte de antecipação.

## Etapa 4 — critérios e evidências

| Item do plano | Entrega e verificação |
|---|---|
| CPF/CNPJ, duplicidade e titularidade | Validação matemática de CPF/CNPJ; cadastro por perfil vinculado a UID/e-mail confirmado, proteção de identidade fiscal e revisão otimista. CPF inválido, e-mail sem confirmação, duplicidade fiscal entre contas e revisão antiga recusados. CPF e CNPJ válidos exercitados. Atualização de contato salva no cadastro, não por sobrescrita anônima no ato de protocolar. |
| ViaCEP e confirmação | Busca real de CEP, formato inválido e CEP inexistente exercitados. Tela permite conferir/corrigir o endereço e acrescentar número/complemento. Falha do provedor foi induzida somente no navegador, para conferir mensagem e edição manual; busca real executada em seguida. Portal convencional também exige confirmação do endereço preenchido. |
| Protocolo externo → caixa interna | Criação atômica abre participação `PENDING` no Protocolo Geral configurado, subordinado à Administração. Servidor encontra o atendimento pelo código `aaaammddxxxxx` na busca de Documentos e acessa pela navegação normal, sem conhecer UUID. |
| Assunto, responsável e histórico | Assunto do requerimento preservado; novo seletor atribui servidor ativo vinculado a participação aberta/pendente. Atribuição registra movimento e auditoria/evento interno. Responsável fora dos setores participantes é recusado. “Nota interna” e “Resposta ao cidadão” possuem visibilidade e eventos distintos. |
| Política comum de sigilo | `document-visibility.ts` centraliza classificação e projeções. Público: apenas `PUBLIC`, assunto genérico, CPF/CNPJ mascarado, situação e ações de andamento permitidas; sem corpo, notas, responsáveis, nomes internos ou anexos. Titular autenticado: requerimentos próprios `PUBLIC`/`INTERNAL`, respostas explicitamente `CITIZEN` e anexos liberados. `CONFIDENTIAL` é recusado também na caixa pessoal, detalhe, download e complementação do cidadão. |
| Máscaras e texto público derivado | CNPJ usa `**.***.ddd/dddd-**`, com grupos corretos. As consultas públicas não derivam assunto, corpo, nomes ou notas de texto interno. E-mail, CPF integral, UUID, nota interna e nome de anexo não apareceram nos DTOs públicos. Ações internas de atribuição/atividades também não integram o andamento externo. |
| Chave e QR mobile | `/publico`, API pública e acompanhamento por chave compartilham a projeção. No SaaS, QR contém `https://rioazul.celeriflow.com.br/publico/<chave>`. Página aberta em viewport móvel de 390×844, com protocolo e QR. Ambiente local respeita sua própria variável de URL; o ensaio HTTPS confirmou a URL canônica publicada. |
| Conta, caixa, anexos e complementação | Login por e-mail/senha real no Firebase, caixa pessoal, abertura pela tela, anexos autorizados com download por clique, complementação e recusa de outra conta exercitados. Retirada da liberação bloqueia novo download. Complementação após encerramento é recusada; escrita revalida estado/classificação/titularidade com a trava do documento. |
| Eventos e estados verdadeiros de notificação | Protocolo inicial e resposta ao cidadão geram `email_message` `PENDING`, sem `sent_at` ou ID de provedor. Resposta enfileira aviso genérico sem copiar conteúdo reservado para e-mail. Atribuição e complementação registram eventos internos em auditoria. Resposta de abertura mantém `AWAITING_CHANNEL_CONFIGURATION`; nenhum teste foi contado como entrega de e-mail. Resend real pertence à etapa 11. |

O selo de e-mail confirmado é do Firebase. As contas de ensaio tiveram `emailVerified` definido explicitamente pelo administrador para executar os fluxos; não representa ensaio de recebimento da confirmação na caixa postal, nem comprovação civil por Gov.br/ICP-Brasil.

## Validação e preservação

- **156/156 verificações finais locais** de API/Chrome: `stages12-1794350180674`.
- **156/156 verificações finais HTTPS** da mesma suíte: `stages12-1794350593052`.
- **119/119 verificações de regressão das etapas 1/2** no incremento local final: `stages12-1794350310708`.
- Índice de resultados, fontes e hashes: [EVIDENCIAS_ETAPAS_3_4.json](EVIDENCIAS_ETAPAS_3_4.json). Os 119 testes de regressão estão identificados como rodada própria, não como novos critérios das etapas 3/4.
- Reconstrução de bancos: `stage0-1794349190780/results.json`, no diretório temporário aprovado.
- Comparação do snapshot anterior à migração com o posterior confirmou os valores das colunas originais. Em cada rodada final, limpeza exclusivamente por IDs próprios, auditoria mantida e sete fingerprints originais reconferidos: servidores, documentos, anexos, setores, cidadãos, vínculos e papéis. Bytes do anexo original revalidados por SHA-256.
- Permanecem **15 servidores, cinco documentos, seis setores e um anexo original**. Perfis/contatos/contas/arquivos criados pela suíte foram removidos; histórico técnico próprio foi arquivado antes da limpeza, com triggers reativados na mesma transação.

As rodadas interrompidas estão preservadas nos diretórios privados: `1794348642680` (expectativa de status do roteiro e ajuste do teardown), `1794348903479`/`1794349338104` (seletores de navegação), `1794349534052` (carregamento do titular antes do envio, corrigido na interface), `1794349812210`/`1794349985809` (expectativa local do QR, ajustada para distinguir a configuração local e a URL HTTPS publicada). Não são somadas como rodadas aprovadas. Limpeza/preservação foi executada e reconferida antes das rodadas seguintes.

## Reprodução técnica

Não executar em paralelo com outras suítes de escrita. `.env.local` aponta para provedores compartilhados; localhost não isola o banco.

```powershell
npm run db:migrate -- --check
npm run build
npm run start -- --port 3100
# Em outro terminal, obtenha o diretório do snapshot:
npm run validate:stages12 -- --snapshot
npm run validate:stages34 -- --allow-write --base http://localhost:3100 --directory "<diretório do snapshot>"
# Para SaaS, somente com destino explícito e --allow-production:
npm run validate:stages34 -- --allow-write --allow-production --base https://rioazul.celeriflow.com.br --directory "<novo snapshot>"
# Recuperação idempotente de limpeza interrompida:
npm run validate:stages34 -- --cleanup --allow-write --base http://localhost:3100 --directory "<diretório da rodada>"
```

## Roteiro curto de homologação pelas telas

Usar contas/cadastros de homologação aprovados pelo responsável. As contas e protocolos temporários automatizados já foram removidos.

1. **Circulares → Nova circular:** selecionar origem, dois subsetores no organograma, tipo Urgente e respostas restritas. Enviar, abrir destinatários e conferir total de servidores, não total de setores.
2. Abrir com dois destinatários diferentes; atualizar/reabrir e conferir que a primeira leitura não muda. Conferir os mesmos totais na lista e no detalhe.
3. Receber no setor destinatário e responder em **Anexos, prazos e tramitação**. Remetente vê a resposta; outro destinatário não. Repetir com resposta aberta. Criar Informativa e conferir os bloqueios de resposta/encaminhamento.
4. Como remetente, **Alterar destinatários**; remover/reincluir setor e conferir revogação e manutenção da primeira leitura. Anexar arquivo, criar prazo e concluir/arquivar somente no setor atuante.
5. **Portal do cidadão → Minha conta → Meu cadastro:** preencher o perfil aprovado, consultar CEP, conferir endereço e salvar. Abrir requerimento pelo portal e guardar o número/chave.
6. Como servidor do Protocolo Geral, buscar pelo número em **Documentos**, abrir, marcar recebido, escolher o setor atuante e atribuir responsável. Registrar uma nota interna e uma resposta ao cidadão.
7. Pela conta do cidadão, abrir o processo na caixa pessoal, conferir somente a resposta liberada, complementar e baixar o próprio anexo. Conferir concessão/revogação do acesso a anexo interno pelo servidor.
8. Abrir **Consulta pública / QR**, inclusive no celular. Conferir protocolo, CPF/CNPJ protegido e histórico resumido; corpo, notas, responsáveis e anexos não devem aparecer.

**Estado de aceite:** encerramento técnico das etapas 3/4, publicação e validação automatizada concluídos. Homologação humana, autenticação avançada, canais reais, rotinas permanentes e demais critérios da implantação mantêm seus próprios marcos. A POC integral 9/9 não foi declarada concluída por este fechamento.
