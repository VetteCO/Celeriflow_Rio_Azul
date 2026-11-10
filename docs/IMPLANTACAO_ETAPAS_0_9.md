# Instalação do incremento 0–9

## Ambiente e dados

- Raiz da aplicação: pasta interna `Celeriflow_Rio_Azul`.
- Node.js 22.13 ou superior, PostgreSQL/Neon, Firebase Auth e Blob privado.
- Manter `.env.local` fora do Git; cadastrar as mesmas variáveis no ambiente de publicação.
- `DIRECT_URL` deve apontar ao endpoint PostgreSQL direto, sem pool transacional, para migrações com lock de sessão.
- `DEFAULT_INTAKE_DEPARTMENT_ID` aponta para **Protocolo Geral**, criado por autorização do proprietário como subsetor da Secretaria Municipal de Administração. No ambiente local foi usado `379a1186-9a99-4eb4-94a4-fc2f5795562d`.
- Cadastrar os responsáveis do Protocolo com vínculo principal ou secundário. Criar setor não atribui automaticamente acesso documental a todos os administradores.

## Instalação

1. Preservar banco e anexos originais. Registrar contagens, checksums e destino da cópia.
2. Revisar `src/db/migrations/0001_core.sql`, `002_modules.sql`, `003_operations.sql`, `004_jobs.sql` e `005_modules_completion.sql`.
3. Listar com `npm run db:migrate`.
4. Na primeira instalação deste executor sobre o banco existente revisado, executar `npm run db:migrate -- --apply --existing-schema`. Nas seguintes, usar `npm run db:migrate -- --apply`.
5. Executar `npm run lint` e `npm run build` após integrar os módulos. Publicar somente o build conferido.
6. Configurar a URL pública correta em `NEXT_PUBLIC_APP_URL` e nos provedores Firebase. Configurações locais não são comprovação de publicação SaaS.
7. Executar os cenários aplicáveis de `ROTEIRO_VALIDACAO_ETAPAS_0_9.md`, registrar evidências e disponibilizar as telas ao proprietário.

As migrações são incrementais. Não executar `db:push`, seeds históricos ou exclusão de tabelas para resolver conflitos de instalação. Uma migração já aplicada não deve ser alterada; criar novo incremento. Rollback da aplicação deve preservar tabelas e dados aditivos.

## Worker documental — infraestrutura adiada pelo proprietário

O proprietário escolheu definir a infraestrutura depois. Código, fila e APIs integram o incremento; a operação de PDF/A e OCR depende dos executáveis e do host descritos em `PROCESSAMENTO_DOCUMENTAL.md`.

- `npm run worker:documents`: processamento e limpeza contínuos.
- `npm run worker:documents -- --once`: uma passagem, para operação controlada.
- Chromium local foi identificado; Ghostscript, veraPDF, Tesseract e Poppler não estão instalados neste computador.
- Não executar conversores dentro da requisição web. Dimensionar worker separado, disco temporário, memória, supervisão e restrições de rede.

## Operação contratual

- Relatórios mensais: `npm run operations:report`, após configurar conta operacional. Também há endpoint protegido para agendador externo.
- Monitoramento: `npm run operations:monitor`, em ambiente independente, com armazenamento dos resultados e canal de alerta.
- Backup: `npm run operations:backup -- <diretório-novo>`, com PostgreSQL `pg_dump` instalado. Replicar e ensaiar restauração conforme a política contratual.
- Redundância geográfica, restauração, carga de 60 usuários, disponibilidade contínua, treinamento presencial e visitas mensais exigem evidências operacionais próprias.

## Etapas finais preservadas

Gov.br/ICP-Brasil/assinaturas/Tramita, Resend e canais externos, seguidos dos aplicativos, permanecem na ordem do plano vigente. Nenhum vínculo autodeclarado constitui identidade verificada e nenhum hash isolado constitui assinatura digital.
