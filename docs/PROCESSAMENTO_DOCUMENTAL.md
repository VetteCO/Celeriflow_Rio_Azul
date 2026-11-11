# Processamento documental — etapas 6–7

**Atualização de 10/11/2026:** configuração operacional atual e aceitação real dos conversores em [PROCESSAMENTO_GED.md](PROCESSAMENTO_GED.md) e [FECHAMENTO_ETAPA_6.md](FECHAMENTO_ETAPA_6.md). Dependências e migrações desta frente foram integradas; PDF/ZIP/PDF-A/OCR já foram executados em rodadas controladas. O suporte Windows usa `JOBS_VERAPDF_BIN=java.exe` com `JOBS_VERAPDF_JAR`, sem launcher `.bat`. Os registros abaixo sobre ausência de execução descrevem a rodada histórica original; operação permanente continua dependente da infraestrutura da etapa 9.

## Entrega e integração

Implementação em arquivos próprios: `src/db/jobs-schema.ts`, migração `004_jobs.sql`, `src/lib/jobs/`, `src/app/api/jobs/`, `src/app/processamento/page.tsx` e `scripts/document-worker.ts`.

- Tela autenticada: **`/processamento`**, com seleção de documentos/anexos, fila, situações, nova tentativa, download e consulta do índice OCR. Utiliza o contrato compartilhado `DataTable`.
- Fila persistente PostgreSQL, com `FOR UPDATE SKIP LOCKED`, leases de 180 segundos, heartbeat de 30 segundos, até três tentativas automáticas e backoff. Uma atualização condicionada pelo token e validade do lease impede publicação por worker substituído.
- Código de negócio de 13 dígitos, gerado pelo default `jobs_next_code()`. Usa a chave diária `business:AAAAMMDD` do `business_counter` compartilhado, no fuso de São Paulo; limite de 99.999 emissões diárias. Identificação de recursos por UUID.
- Idempotência por solicitante/chave UUID. Repetição do mesmo pedido retorna o job; mesma chave com conteúdo diferente retorna 409. A seleção capturada é preservada nas tentativas.
- Artefatos em Blob **privado**, com SHA-256, tamanho, nome e TTL. Endpoints não retornam pathname nem URL do armazenamento. Download é autenticado e transmitido por stream.
- O worker registra o pathname antes do upload; um objeto deixado por uma interrupção continua na lista de expiração para remoção física posterior. A expiração lógica bloqueia downloads mesmo se o worker estiver desligado.
- OCR indexado em PostgreSQL com `to_tsvector('portuguese', text)` e GIN; não usa serviço externo. O índice compartilha o TTL do resultado.

**Pendências para a frente principal:** instalar `playwright-core` e `pdf-lib` com atualização de `package.json`/lock, incluir o link `/processamento` no menu, aplicar explicitamente a migração e provisionar os executáveis abaixo. Esta frente não alterou arquivos de outros responsáveis. Os antigos itens `data.jobs` de módulos não são executados automaticamente: a nova entrada real é `POST /api/jobs` ou a tela `/processamento`. O chamador do módulo pode integrar esse endpoint sem depender do worker dentro da requisição HTTP.

Não foram executados testes, lint, TypeScript, build, migrações, OCR, conversões ou processamento remoto nesta rodada. A implementação exige homologação integrada após configuração; a existência do código não equivale a execução validada dos conversores.

## Preparação do ambiente

1. Instalar as dependências JavaScript `playwright-core` e `pdf-lib` na frente que controla o manifesto de pacotes. `playwright-core` não instala um navegador automaticamente.
2. Aplicar `src/db/migrations/004_jobs.sql` **após o núcleo e `002_modules.sql`**. O schema é importado diretamente; não depende de alteração de `src/db/index.ts`. Não usar `db:push` como substituto da função/default e tabelas auxiliares desta migração.
3. Executar o worker em host/container **Node.js 22+**, com disco temporário e executáveis instalados. O processo Next.js recebe pedidos e serve resultados; não executa conversores na requisição nem requer binários durante o build.
4. Configurar acesso ao mesmo PostgreSQL e à mesma loja Blob privada usados pela aplicação.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL da aplicação, obrigatório para o worker |
| `BLOB_READ_WRITE_TOKEN` | Token da loja privada, obrigatório para entradas/saídas |
| `JOBS_CHROMIUM_BIN` | Caminho absoluto do executável Chromium/Chrome para PDF e PDF/A |
| `JOBS_IMAGE_ORIGINS` | Lista de origens HTTPS confiáveis, separadas por vírgula, para imagens do conteúdo. Ex.: `https://imagens.municipio.gov.br`. Sem curingas. Imagem bloqueada/inacessível impede conclusão em vez de sumir silenciosamente |
| `JOBS_GHOSTSCRIPT_BIN` | Caminho absoluto de `gs` ou `gswin64c.exe`, para PDF/A |
| `JOBS_PDFA_DEFINITION` | Caminho de arquivo PostScript de definição PDF/A com OutputIntent/perfil ICC RGB válido e instalado. Deve ser provisionado e confiável; o arquivo padrão de exemplo do Ghostscript precisa de adaptação do caminho ICC |
| `JOBS_VERAPDF_BIN` | Executável/launcher veraPDF com suporte a `--format json --flavour 2b`. Precisa executar diretamente sem shell; em Windows, um `.bat` não atende ao contrato `spawn(..., shell:false)`: provisionar launcher executável compatível ou usar host Linux |
| `JOBS_PDFTOTEXT_BIN` | Caminho absoluto de `pdftotext` (Poppler), para texto incorporado de PDFs |
| `JOBS_PDFTOPPM_BIN` | Caminho absoluto de `pdftoppm` (Poppler), para rasterização das páginas OCR |
| `JOBS_TESSERACT_BIN` | Caminho absoluto de Tesseract CLI, para OCR |
| `JOBS_OCR_LANG` | Idiomas Tesseract, padrão `por`; instalar os respectivos `traineddata` e configurar `TESSDATA_PREFIX` se necessário |
| `JOBS_OUTPUT_TTL_HOURS` | Validade de resultados e índice textual: 1–168 horas; padrão 24 |
| `JOBS_TEMP_DIR` | Diretório temporário preexistente, gravável e privado do worker; padrão temporário do sistema |

Os caminhos são passados como argumentos separados, sem shell. As configurações de origem de imagens e de perfil ICC são administrativas. Usar origens de imagens estáveis, controladas e sem redirecionamento para outra origem; toda requisição do navegador é filtrada, JavaScript e service workers ficam desabilitados. Fontes e dependências de sistema do Chromium devem ser instaladas no host para preservar o layout esperado. LibreOffice não é presumido nem utilizado.

Executar a partir da raiz interna do projeto:

```text
npx tsx --env-file=.env.local scripts/document-worker.ts
```

Para uma passagem (limpeza + no máximo um job):

```text
npx tsx --env-file=.env.local scripts/document-worker.ts --once
```

Esses comandos são instruções de operação; não foram executados nesta entrega. O worker mantém polling quando não recebe `--once`. SIGINT/SIGTERM impedem nova passagem após o job atual. Um encerramento forçado deixa o lease expirar e permite retomada. Cada job tem limite global de uma hora; conversores têm limite por chamada de dois minutos. Rodar sob supervisor e dimensionar CPU/memória por worker.

## Formatos e fidelidade

### PDF

O servidor captura assunto, corpo, blocos formatados, códigos/revisões e referências dos anexos. O worker sanitiza HTML, preserva tabelas, parágrafos, estilos permitidos e imagens autorizadas, e usa **Chromium headless** para impressão com fundo e CSS de página. Inclui folha de rosto e índice dos documentos/anexos. Depois incorpora páginas dos anexos PDF e imagens PNG/JPEG e adiciona faixa própria de rodapé com código e paginação global, sem sobrepor conteúdo original.

O PDF compilado é uma representação visual; não preserva assinaturas digitais, formulários interativos ou metadados/links de todos os PDFs originais. Nenhuma assinatura é executada ou declarada válida. Os bytes originais permanecem nos anexos e são preservados integralmente no ZIP.

Anexos não suportados para incorporação (DOCX, DWG etc.) **interrompem o PDF com motivo explícito**. Selecione subconjunto compatível ou solicite ZIP. Não são omitidos silenciosamente. Chromium indisponível ou imagem não carregada mantém o pedido bloqueado/configurável.

### PDF/A-2b

O PDF completo é convertido por Ghostscript com `-dPDFA=2`, RGB e `-dPDFACompatibilityPolicy=1`. O resultado é submetido ao veraPDF, perfil **2b**, e só recebe nome `-PDFA-2b.pdf`/situação concluída quando o relatório JSON possui resultado de validação explicitamente conforme. Binário/definição ausente bloqueia a solicitação. Falha de execução ou relatório inválido/reprovado não publica arquivo com rótulo PDF/A.

O relatório JSON completo aprovado é preservado em `document_job.validation`, junto de perfil, nome do validador, data da validação e SHA-256 do PDF resultante. Essa evidência é gravada na mesma atualização protegida pelo lease que publica o resultado. A coluna é criada idempotentemente em `004_jobs.sql`. A API retorna `validationUrl` e `downloadUrl` somente enquanto o resultado estiver concluído e dentro do TTL. A tela oferece **Relatório veraPDF** e **Baixar**, ambos enviando autenticação. `GET /api/jobs/:id/validation` exige solicitante/responsável e acesso atual a todas as fontes, registra auditoria e devolve 410 após expiração, assim como o PDF. O relatório permanece no banco como evidência histórica após o TTL, mas não fica acessível por esses endpoints; não há URL pública ou arquivo auxiliar de relatório no Blob.

### OCR

PDFs passam por `pdftotext` e rasterização por página com `pdftoppm`; Tesseract processa **todas** as páginas, inclusive PDFs híbridos com outras páginas já textuais. O JSON separa texto incorporado e reconhecimento por página. PNG, JPEG, TIFF e BMP são processados diretamente pelo Tesseract. O resultado é texto pesquisável/JSON, não um PDF com camada OCR. Reconhecimento pode produzir texto vazio quando não há caracteres reconhecíveis; não há texto artificial ou substituição por resposta fictícia.

### ZIP

ZIP padrão STORE (sem recompressão), com CRC32, descritores e nomes UTF-8, escrito em chunks sobre disco, sem carregar todos os arquivos em memória. Contém:

- `originais/{sourceId}/{fileId}-{nome-seguro}` — bytes originais, sem conversão;
- `manifesto.json` — documento, revisão, anexo, nome original, tipo, tamanho, SHA-256 efetivamente calculado e caminho no ZIP;
- `conteudo.html` — captura sanitizada dos corpos/blocos e folha de rosto.

O HTML pode referenciar imagens HTTPS; essas imagens remotas não são automaticamente arquivadas como originais. Para preservação independente, cadastrar as imagens como anexos e selecioná-las. Hash e tamanho dos anexos são confrontados com os metadados existentes, quando disponíveis. ZIP32 tem limite explícito; ZIP64 não é gerado.

## Seleção e autorização

Seleção **personalizada** usa a ordem de `sources` e os `fileIds` fornecidos (lista vazia = nenhum anexo; ausência = todos os anexos dos documentos selecionados). Seleção **completa** inclui todos os anexos e percorre recursivamente `linkedIds`/`coreDocumentIds` dos módulos, com proteção contra ciclos; ignora filtro `fileIds`. No núcleo não há relação hierárquica adicional a percorrer: entram os documentos explícitos e os vinculados pelos módulos. Vínculo sem acesso faz a solicitação falhar, não gera compilação aparentemente completa com omissões.

Sessão exige servidor ativo e `doc:view`. Cada documento é autorizado por `canAccessDocument`; módulos usam `getRecord`/política existente, incluindo proprietário, setores secundários e signatários/delegados admitidos pela política. Administrador geral não ganha acesso global por ser administrador.

Jobs são consultáveis pelo **solicitante ou responsável atribuído (`assigneeId`)**, desde que ambos tenham acesso atual a **todos** os documentos. O responsável opcional é validado na criação. O worker reconstrói permissões/setores atuais do solicitante antes de processar e antes de publicar. Lista, detalhe, texto e download revalidam o escopo de quem acessa. O conteúdo sensível de identidade da Ouvidoria e metadados internos do módulo não são incluídos na captura de exportação.

Documentos/anexos excluídos ou substituídos após a captura não são recuperados de pathname antigo. Alterações de corpo/revisão posteriores não modificam a seleção capturada. Uma nova seleção exige nova chave de idempotência; reprocessar um job bloqueado/fracassado conserva a captura original. Apenas o solicitante pode reenfileirar. Eventos de criação, consulta, conclusão, pesquisa e download são registrados em `audit_log`.

## API

Todas as rotas exigem `Authorization: Bearer <Firebase ID token>`.

| Método/rota | Função |
|---|---|
| `GET /api/jobs?page=1&q=termo&sort=createdAt&desc=true&status=SUCCEEDED` | Paginação de 20 itens no servidor, busca/ordenação/filtro antes da paginação e `total` exclusivamente autorizado; sem corte em 200 jobs |
| `POST /api/jobs` | Valida seleção, captura conteúdos e enfileira; HTTP 202 |
| `GET /api/jobs/:id` | Situação, tentativas, motivo, datas, hash/tamanho e fontes; sem chave Blob |
| `POST /api/jobs/:id` | Reenfileira `BLOCKED`/`FAILED`, após corrigir configuração/causa |
| `GET /api/jobs/:id/download` | Stream autenticado; 409 pendente e 410 expirado |
| `GET /api/jobs/:id/validation` | JSON completo da validação veraPDF com vínculo ao hash do PDF; autorização e TTL idênticos ao resultado |
| `GET /api/jobs/:id/text?q=termos` | Pesquisa local no OCR; prévia de até 10.000 caracteres por anexo; texto integral no JSON |
| `GET /api/jobs/options?q=assunto` | Até 100 documentos + 100 módulos no escopo, busca por assunto/código, `limitPerType: 100` e `truncated` explícito; não informa 100 como total do acervo |
| `GET /api/jobs/options?type=module&id=UUID` | Anexos autorizados do módulo; `type=document` para núcleo |

Corpo de criação:

```json
{
  "kind": "PDF",
  "sources": [{ "type": "module", "id": "UUID_DO_REGISTRO" }],
  "selection": "custom",
  "fileIds": [],
  "idempotencyKey": "UUID_DA_SOLICITACAO"
}
```

`kind`: `PDF`, `PDFA`, `OCR`, `ZIP`. `assigneeId` é opcional; aceita UUID de servidor ativo que tenha acesso integral. A UI mantém a chave em falhas de envio para evitar duplicação por repetição acidental.

### Paginação, escopo e integração da listagem

`GET /api/jobs` responde `{ jobs, total, page, pageSize: 20 }`. `page` inicia em 1; `q` aceita até 200 caracteres; `sort` aceita `code`, `kind`, `status`, `error`, `expires`, `createdAt` e `actions`; `desc` é `true` ou `false`. O filtro opcional `status` aceita os estados persistidos e `EXPIRED`. A expiração lógica é considerada nos filtros/ordenação mesmo antes da passagem de limpeza do worker. A busca consulta código, formato, estado e detalhes/assuntos capturados; a ordenação tem desempate por UUID.

O predicado SQL combina propriedade/atribuição do job com autorização atual de **cada** fonte, reutilizando `documentScope` e `modules.scope`. Documentos removidos ou com acesso revogado excluem o job tanto das linhas quanto do `total`, antes de `LIMIT/OFFSET`; não há contagem de jobs invisíveis. Detalhes, downloads e evidência continuam revalidando `canAccessDocument`/`getRecord`. A UI passa `pagination={{ page, total, onPageChange }}`, `onSearch`, `onSort` e `filters` ReactNode à DataTable; o filtro de situação e novas buscas retornam à primeira página.

A busca de opções consulta uma linha adicional por origem apenas para detectar truncamento, sem expor contagens fora do escopo. A tela explica que sua tabela de seleção contém opções carregadas e solicita refinamento quando há mais resultados. Esse limite de sugestões não limita a quantidade de jobs pagináveis.

A integração do intake e a atribuição posterior de usuários são responsabilidade da frente principal e não foram alteradas nestes ajustes. A migração `004_jobs.sql` não contém `BEGIN`/`COMMIT` externos: o `BEGIN` dentro de `jobs_next_code()` pertence ao corpo PL/pgSQL e é necessário. Nenhum teste, lint, tsc, build ou migração foi executado nesta rodada de ajustes.

## Limites e operação

- Até 100 documentos e 200 anexos por solicitação.
- 128 MiB por anexo; entradas somadas de até 256 MiB para PDF/OCR ou 1,8 GB para ZIP; artefato final até 2 GB.
- Compilação PDF limitada a 1.000 páginas; OCR até 200 páginas por anexo PDF e rasterização com maior dimensão de 3.000 pixels.
- Saída de conversor limitada a 8 MiB por chamada; texto extraído/recognizado limitado e índice total até 10 MiB.
- ZIP e transferência Blob usam streams; mesclagem PDF usa memória por exigência de `pdf-lib`. Prover memória suficiente e limitar quantidade de processos paralelos no supervisor. O download HTTP é streaming; o botão do navegador usa Blob local e requer memória proporcional ao arquivo.
- A limpeza roda a cada passagem do worker. Jobs expirados deixam de baixar imediatamente por TTL; exclusão física do Blob e índice é repetida enquanto houver pendências. Falha de exclusão não reabre download.
- Diretórios temporários são removidos em `finally`. Um processo morto abruptamente pode deixar diretório temporário no host: configurar política de expiração no volume temporário do supervisor, sem tocar em originais.
- Não há envio de e-mail/SMS, assinatura criptográfica, LibreOffice ou execução remota automática incorporados.

Para homologação futura: aplicar/reaplicar migração; verificar concorrência com dois workers e perda de lease; repetir chave idempotente com payload igual/diferente; revogar escopo antes do download; verificar PDF com tabelas/imagens/anexos; validar PDF/A com relatório real; OCR em PDF híbrido; conferir hashes do ZIP; simular interrupção no upload e expiração TTL. Nenhuma dessas verificações foi executada nesta rodada por instrução expressa.
