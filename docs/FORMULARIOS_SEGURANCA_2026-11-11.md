# Incremento de formulários e segurança — 11/11/2026

## Entrega

- Configurador com visibilidade interna/externa, bloqueio de valores, permissão por canal para edição pós-protocolo, valor inicial, data atual de Brasília, largura e ordenação dos campos.
- Títulos/parágrafos de apresentação com formatação e ajuda por imagem HTTPS ou incorporada.
- Regras independentes de exibir, ocultar e obrigar; ocultar prevalece e obrigatoriedade é aplicada apenas a campos visíveis.
- CEP associado a logradouro, bairro, cidade e UF. Consulta pelo proxy existente, retorno visível e proteção contra respostas atrasadas/sobrescrita de digitação posterior.
- Componentes compartilhados nos canais interno, externo identificado e anônimo, incluindo reabertura e edição autorizada após protocolo.
- Política de escrita no servidor preserva valores protegidos e impede injeção por outro canal. Cálculos são refeitos pelo servidor; conteúdo com assinatura pendente permanece bloqueado.
- Edição anônima com revisão otimista, chave protegida, idempotência e histórico, pela migration aditiva `013_workflow_field_update.sql`.
- Atualização de dependências e ajustes de compatibilidade Zod/Resend/Drizzle; conflitos de banco encapsulados pelo ORM retornam 409 em vez de erro 500.

## Verificações

Suítes de escrita executadas sequencialmente contra `http://localhost:3100`, com recursos próprios, limpeza e conferência de preservação. A base é compartilhada com a publicação.

| Verificação | Resultado final deste incremento | Evidência privada em `%LOCALAPPDATA%/Temp/opencode` |
|---|---|---|
| Build, lint e tipos da aplicação | Aprovados | `npm run build` |
| TypeScript incluindo scripts novos | Aprovado | `npx tsc --noEmit` |
| Unitários | 63/63 | Execução `tsx --test` com conexão de banco inoperante |
| Formulários nos três canais, persistência, reabertura e CEP real | 81/81 | `workflow-fields-1794411501742/acceptance.json` |
| Etapas 1/2 | 120/120 | `closure-stages12-final-20261111/results.json` |
| Etapas 3/4 | 159/159 | `closure-stages34-20261111/results.json` |
| Etapas 5/7 | 531/531 | `stages57-1794412694471/acceptance.json` |
| Etapas 8/9 | 188/188 | `stages89-1794415828109/acceptance.json` |
| Contatos, incluindo conflito de revisão | 86/86, limpeza aprovada | `contacts-e5ffdd96-6731-4597-aefc-9021ab38aba0/results.redacted.json` |
| Auditoria de dependências | Zero vulnerabilidades | `closure-audit-final-20261111.json` |
| Reconstrução em três bancos novos | 52 tabelas, baseline + 13 migrations, checksums/FKs/rollback e proteção de campos anônimos aprovados | `stage0-1794410451887/results.json` |

As seis suítes integradas acima somam **1.165 assertivas**, além dos 63 unitários. Contagens não equivalem a requisitos contratuais únicos. Os demais resultados do relatório anterior continuam históricos, sem reclassificação como testes desta versão.

A migration 013 foi aplicada à base preservada pelo executor próprio. As migrations anteriores não foram reescritas. O teste de etapas 5/7 foi ajustado ao modo de cadastro por perfil já habilitado: o requerimento legado sem autenticação deve ser recusado, sem criar cidadão. Os testes de navegador também passaram a aguardar a tela apropriada ao perfil, em vez de depender da presença do usuário na primeira página de uma tabela com 20 registros.

## Ghostscript

Após autorização expressa do usuário, Ghostscript **10.08.0** disponibilizado em `%LOCALAPPDATA%/Temp/opencode/stage6-tools/ghostscript/bin/gswin64c.exe`. Instalador conferido por SHA-256 `52a91b8bf09298788d7a57b9206127026c23eacd75405f0a131e26dc381dce50`.

Verificação de versão e conversão local de um PDF de três páginas aprovadas, produzindo `ghostscript-authorized-20261111.pdf` com 56.834 bytes. Essa conversão isolada não comprova conformidade PDF/A: a validação por veraPDF permanece necessária.

A tentativa anterior de reexecução da etapa 6 terminou com 183 aprovações e duas falhas por ferramentas locais indisponíveis. Ghostscript está agora disponível, mas Java/veraPDF executável, Poppler e Tesseract nos caminhos configurados ainda precisam de preparação para repetir a suíte completa. Nenhuma aprovação antiga de PDF/A/OCR foi atribuída a esta rodada. Instaladores e artefatos privados ficam fora do Git.

## Limites de encerramento

- O incremento fecha as implementações de interface/política de campos listadas acima; não declara encerramento integral das etapas 0–9.
- Validação de existência cadastral de CPF/CNPJ depende de serviço externo próprio; verificadores matemáticos não comprovam existência ou identidade civil.
- Falta comprovar os novos formulários na versão publicada e realizar homologação humana.
- Sisobra, bases municipais validadas, operação permanente/redundância e dimensionamento municipal continuam com os limites do plano vigente.
- Gov.br, certificados, entrega real de e-mail e aplicativos seguem nas etapas finais.
