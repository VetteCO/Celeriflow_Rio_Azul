# Validação das etapas 0 a 9

## Sequência para validação pelas telas

Executar somente após migrações e verificações técnicas de fechamento. A aprovação de uma tela não homologa integrações externas nem todos os requisitos da família.

1. **Administração:** entrar com administrador, cadastrar servidor com senha inicial, CPF/telefone formatados, setor e vínculos secundários. Entrar com o novo acesso; alterar perfil e conferir ações disponíveis. Suspender e confirmar recusa de acesso com sessão anterior.
2. **Organograma:** criar subsetor, editar sigla, cadastrar servidor pelo perfil autorizado e conferir limites da subárvore. Desativar setor mediante realocação.
3. **Documentos:** elaborar com texto formatado, listas, tabela, link e imagem HTTPS; conferir formatação persistida. Criar prazos e anexos, verificar código de 13 dígitos e número documental, baixar original autenticado.
4. **Tramitação:** encaminhar para dois setores, receber em cada um e conferir situação independente. Encaminhar novamente, conferir origem do novo despacho. Separar nota interna de resposta ao requerente. Concluir, arquivar e reabrir com perfil permitido.
5. **Calendário:** navegar entre meses, localizar prazo, abrir documento, editar/concluir/cancelar prazo e cadastrar feriado. Conferir cálculo de prazo útil.
6. **Circulares:** selecionar destinatários/setores/subsetores, conferir população única e total na lista/detalhe. Abrir como destinatário e confirmar primeira leitura imutável; confirmar que não destinatário não recebe recibo.
7. **Cidadão:** criar conta, confirmar e-mail, registrar requerimento, acompanhar na caixa pessoal, complementar e anexar arquivo. Confirmar que outra conta não acessa o processo. Liberar um anexo internamente e conferir disponibilidade ao titular.
8. **Consulta pública:** conferir código público imprevisível, CPF/CNPJ mascarados e ausência de corpo/notas/anexos internos. Documentos internos/sigilosos devem retornar indisponíveis.
9. **Gestão municipal:** cadastrar modelos, contatos, assunto e fluxo; percorrer as transições próprias da família. Conferir revisão concorrente, histórico, controle setorial e imutabilidade de publicação. Validar requisitos específicos conforme a matriz rastreável.
10. **Relatórios e operação:** filtrar relatórios e auditoria; exportar CSV/PDF/XLSX; conferir indicadores contra a origem. Publicar curso, concluir aulas na ordem, responder avaliação e obter certificado. Abrir chamado, responder, escalar, encerrar e avaliar.
11. **Tabelas:** conferir 20 registros, última página incompleta, filtros antes da paginação, ordenação estável, redimensionamento adjacente e restauração. Em notebook/computador, medir ausência de rolagem e paginação visível; em tablet/celular, conferir acesso por rolagem autorizada. Abrir conteúdo cortado e retornar ao acionador pelo teclado.

## Regras de dados

- Preservar registros existentes. Dados de exemplo devem ficar em ambiente próprio, com município fictício Aurora das Veredas/MG e pessoas fictícias verossímeis.
- CPF/CNPJ precisam ter dígitos verificadores válidos; um exemplo ilustrativo não autoriza exceção na validação.
- Não usar rótulos de desenvolvimento como nomes de servidores, documentos ou setores apresentados nas telas.
- Cenários visuais podem interceptar respostas apenas no navegador de validação, sem persistir registros artificiais no banco.

## Evidências obrigatórias para fechamento

- Resultado de lint/build, versão e migrações aplicadas.
- HTTP/autorização dos fluxos efetivamente executados; distinguir verificações de leitura de operações de gravação.
- Medidas reais de viewport, grade, última linha e paginação, com screenshots.
- Lista de requisitos implementados, parciais e dependentes de configuração externa.
- Restauração/backup, redundância e capacidade somente podem ser declarados demonstrados quando houver execução e evidência próprias.
