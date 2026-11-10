# Execução das etapas 0 a 9

**Registro consolidado da entrega:** `ENTREGA_DESENVOLVIMENTO_0_9_2026-11-10.md`. As notas abaixo preservam a sequência de implementação; o registro consolidado contém os resultados finais e as pendências explícitas.

Iniciada em 10/11/2026. Plano de referência: `PLANO_DESENVOLVIMENTO_POC_E_IMPLANTACAO.md`.

## Diretrizes desta execução

- Lint, build e validação integrada concentrados no fechamento das nove etapas; verificações intermediárias apenas quando necessárias para avançar.
- Padrão de tabelas: `Padrão de Tabelas.md`, revisão 1.2. A decisão inicial prevalece sobre trechos antigos: rolagem permitida em tablets/celulares, não em computadores/notebooks.
- Componentes compartilhados de tabelas, shell, detalhes e máscaras. Dados existentes preservados.
- Município de referência fictício: Aurora das Veredas/MG. Dados verossímeis e fictícios; CPF/CNPJ de exemplo devem respeitar a validação matemática para não depender de exceções no cadastro.
- Novos códigos de negócio no formato `aaaammddxxxxx`. Identificadores internos e chaves públicas mantêm requisitos de integridade e imprevisibilidade; numeração documental mantém as regras do edital.
- Interfaces com linguagem operacional, sem rótulos de desenvolvimento; integrações ainda indisponíveis não serão apresentadas como verificadas ou operacionais.

## Inventário inicial de tabelas

| Rota | Implementação | Problema | Migração |
|---|---|---|---|
| /admin | Tabela HTML local | Sem paginação, formulário e tabela empilhados | Em desenvolvimento |
| /documentos | Tabela HTML local | Sem filtros/paginação; API limitada a 100 | Em desenvolvimento |
| /circulares | Tabela HTML local | Sem paginação; contagens divergentes | Em desenvolvimento |
| /circulares/[id] | Tabela HTML local | Nome/e-mail empilhados; sem paginação | Em desenvolvimento |
| /gestao/* | Novos módulos | Usar componente compartilhado desde criação | Em desenvolvimento |
| /operacao/* | Novos módulos | Usar componente compartilhado desde criação | Em desenvolvimento |

## Estado

Implementação em andamento. Nenhuma etapa adicional foi declarada homologada. Evidências de execução e dependências serão consolidadas ao final.

## Base compartilhada implementada

- `AppShell`: navegação lateral expansível/recolhível, barra de ícones, contexto institucional e foco de teclado.
- `DataTable`: paginação de 20, busca/ordenação do conjunto fornecido, ajuste de colunas com compensação adjacente, preferências por usuário e detalhes paginados.
- `MaskedInput` e normalização de valores brasileiros: CPF/CNPJ, CEP, telefone e moeda.
- Executor de migrações versionadas com trava, checksum e transação por arquivo; nenhum banco alterado por esse executor nesta fase.
- Rotas antigas de vínculo autodeclarado Gov.br desabilitadas; recebimento sem configuração rejeitado. Configuração real dos provedores permanece nas etapas finais.
- Página inicial, páginas de erro e identidade do shell com linguagem operacional.

## Preparação da verificação final

O navegador integrado do harness não está conectado. Chrome e Edge locais foram encontrados; `playwright-core` foi instalado exclusivamente no diretório temporário aprovado para permitir medição no fechamento. Não foram executados lint, build ou bateria de testes intermediária.

## Preservação pré-migração

Cópia consistente dos registros, metadados de schema, índices, constraints e enums em `C:\Users\trici\AppData\Local\Temp\opencode\rio-before-migrations-1794322496266.json`, com original do anexo e hash SHA-256. O arquivo contém dados internos e não integra o repositório. Captura anterior a qualquer alteração de schema nesta execução: 15 servidores, 5 setores, 5 documentos, 1 anexo e 32 eventos históricos. Esta cópia local não comprova a rotina contratual de backup redundante nem restauração.

Alguns agentes executaram verificações pontuais de tipos/formatos durante suas entregas, apesar da orientação de concentração no fechamento. Não houve bateria integrada intermediária; lint/build e validação funcional final continuam pendentes.

## Destino do portal autorizado

O proprietário escolheu criar um setor de Protocolo. Criado `Protocolo Geral` (`PROTOCOLO`), vinculado à Secretaria Municipal de Administração, e configurado `DEFAULT_INTAKE_DEPARTMENT_ID` no ambiente local. Criação registrada na auditoria. A base passou a 6 setores; servidores/documentos existentes preservados. Os vínculos dos responsáveis devem ser definidos na Administração.

## Processamento e operação

Incorporada fila persistente de PDF/PDF-A/OCR/ZIP com worker separado, artefatos privados e revalidação de acesso. Chromium local configurado; PDF/A e OCR exigem os conversores/validador documentados. Adicionados executores de relatório mensal idempotente e monitoramento externo com alertas. Agendamento, infraestrutura redundante e comprovação de disponibilidade continuam dependentes do ambiente operacional.

O proprietário escolheu **definir a infraestrutura de processamento depois**. Fila e executores integram esta entrega de código; instalação e operação dos conversores PDF/A/OCR ficam dependentes de provisionamento posterior. Não estão instalados Ghostscript, veraPDF, Tesseract ou Poppler neste computador.

## Revisão estática de integração

Corrigidos antes da rodada final: autorização concorrente na administração de usuários, população destinatária após encaminhamento de circular urgente, vazamento de texto livre na consulta anônima, contorno da reserva CPF/e-mail por submissão anônima e bloqueio indevido de anexos para vínculos secundários. A revisão estática identifica e corrige caminhos de código; não substitui evidência funcional de todos esses cenários.

A central de ajuda em `/ajuda` documenta os fluxos implementados, os perfis, a navegação das tabelas, o portal e o suporte. PDF/A/OCR e serviços externos não são apresentados como operacionais sem configuração.

## Atualização cadastral autorizada

Após conferência visual, o proprietário solicitou substituir duas contas antigas com nomenclatura de desenvolvimento:

- José Antunes — `jose.antunes@aurora.mg.gov.br`;
- Maria Goulart — `maria.goulart@aurora.mg.gov.br`.

Atualizados nome/e-mail no banco e Firebase, preservando UID, senha, perfil, vínculos e histórico. Os novos endereços não foram marcados como verificados automaticamente. Eventos de atualização registrados na auditoria; cópia anterior preservada em diretório temporário privado.

## Primeira conferência integrada

- Migrações `0001_core`, `002_modules`, `003_operations` e `004_jobs` aplicadas pelo executor, com checksum.
- Build de produção passou, incluindo lint e tipos, após corrigir a compatibilidade do sanitizador e servir o worker PDF.js como ativo local gerado no prebuild.
- 26 verificações HTTP passaram: consultas autorizadas, recusas por ausência de sessão/perfil, consulta pública respeitando classificação e serviços finais desativados.
- 11 testes de domínio/formatos passaram.
- Medição real em Chrome: listagens centrais sem rolagem em 1366×768; grade com 20 linhas sem rolagem também em 1280×720 e 1920×1080. Paginação de dados somente do navegador: 20/20/3, sem inserir esses registros no banco.
- Restam incrementos programáveis documentados dos módulos avançados; estão sendo fechados antes do parecer final. Estas verificações não homologam as alterações posteriores.

## Compatibilidade e dependências no fechamento

Atualização do Next.js 14.2.5 para 15.5.29 e do sanitizador para 2.18.1. Contratos assíncronos de parâmetros/cabeçalhos estão sendo incorporados. O sanitizador é dependência externa do servidor; requer Node.js 22.13+. O resultado da primeira conferência não substitui o build da versão atualizada.

O disco C: chegou a zero espaço durante a instalação. Removidos apenas o cache gerado do build e o cache reconstruível de downloads do npm, liberando aproximadamente 8 GB. Dados, anexos e cópias de preservação mantidos.
