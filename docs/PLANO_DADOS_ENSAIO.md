# Dados de desenvolvimento, homologação e apresentação

Plano atualizado em 11/11/2026. Substitui as antigas instruções de seed e reset manual deste arquivo. Para a massa persistente de apresentação preparada na base da aplicação, consultar [DADOS_DEMONSTRACAO_2026-11-11.md](DADOS_DEMONSTRACAO_2026-11-11.md).

## Separação efetivamente preparada

`npm run stage0:databases` cria um cluster PostgreSQL 18 **novo**, restrito a `127.0.0.1:55439`, e três bancos independentes:

| Finalidade | Banco | Dados | Arquivos |
|---|---|---|---|
| Desenvolvimento | `rio_desenvolvimento` | IDs/e-mails exclusivos, cadastro fictício | Diretório `desenvolvimento/files` |
| Homologação | `rio_homologacao` | IDs/e-mails exclusivos, cadastro fictício | Diretório `homologacao/files` |
| Apresentação | `rio_apresentacao` | IDs/e-mails exclusivos, cadastro fictício | Diretório `apresentacao/files` |

Cada execução fica em `%LOCALAPPDATA%/Temp/opencode/stage0-<instante>`, contendo cluster, `results.json`, configuração privada de acesso e `fixture.json` por finalidade. O executor ignora `DATABASE_URL` e `DIRECT_URL`, não copia dados da base existente, não usa os seeds históricos e encerra o cluster após verificar os resultados. Execuções simultâneas na mesma porta falham sem substituir o cluster existente.

Essas são **bases locais de preparação de dados**, não três implantações completas do SaaS. Firebase, Blob remoto e login das contas ainda precisam ser provisionados nos respectivos ambientes antes de executar fluxos HTTP. As bases usam PostgreSQL nativo; o driver Neon da aplicação requer um destino compatível ou adaptador próprio. Não apontar a aplicação para esses bancos presumindo compatibilidade de transporte. A execução completa da aplicação restaurada e a infraestrutura contínua pertencem à etapa 9.

## Massa reproduzível

- Município fictício: Aurora das Veredas/MG.
- Secretaria Municipal de Administração e subsetor Protocolo Geral.
- Helena Duarte, papel `ADMIN_GERAL`; Rafael Nogueira, papel `NIVEL_3_VISUALIZACAO`.
- E-mails distintos por finalidade, no domínio fictício `aurora.mg.gov.br`; nenhum envio habilitado.
- Contas de banco sem `firebase_uid`, sem senha embutida e sem indicação de login provisionado.
- CPF `529.982.247-25` e CNPJ `11.222.333/0001-81` matematicamente válidos para roteiro; não comprovam existência cadastral.
- UUIDs internos distintos entre as três bases. Códigos de negócio devem ser emitidos pela aplicação no formato vigente; não confundir UUIDs internos com códigos de negócio.
- Cenários associados: Admin × leitura; memorando com dois prazos; circular/subsetores; requerimento no Protocolo; consulta com sigilo. Os roteiros funcionais constam em `VALIDACAO_INTEGRADA_ROTEIRO.md` e `TAREFAS_REGRESSAO_F01_F12.md`.

## Reexecução e preservação

1. Executar a partir da raiz interna do projeto, com Node 24 e ferramentas PostgreSQL em `%LOCALAPPDATA%/Temp/opencode/postgresql18/pgsql/bin`.
2. Rodar `npm run stage0:databases`. Não necessita `.env.local` nem credenciais de produção.
3. Conferir três resultados com 52 tabelas, 13 entradas de histórico (baseline + 12 migrations), hashes corretos, zero FKs não validadas e rollback aprovado. Esse histórico inclui o bootstrap local; na base preservada, `db:migrate -- --check` confere as 12 migrations existentes.
4. Manter os artefatos privados fora do Git. Para nova massa, executar novamente: um diretório e cluster novos serão criados; nenhuma exclusão anterior é necessária.
5. Para retomar o cluster, usar `pg_ctl` com o `-D` do diretório gerado e a mesma porta/host do executor. A senha está no arquivo privado, não neste documento. Não manter o cluster aberto após o uso.

O `.env.local` atual referencia serviços usados pela publicação. **Servidor web em localhost não significa banco de desenvolvimento isolado.** Os ensaios integrados anteriores nessa base tiveram autorização específica e limpeza por manifesto; não devem ser tratados como implantação de ambientes independentes. Novos ensaios de escrita precisam conferir o destino e o manifesto antes de usar `--allow-write`.

Não executar `db:seed`, `db:seed:cenario`, `db:push`, apagar tabelas ou usar listas de nomes como critério de limpeza sobre a base preservada. A preparação local aqui descrita não altera José Antunes, Maria Goulart, vínculos, documentos ou anexos existentes.
