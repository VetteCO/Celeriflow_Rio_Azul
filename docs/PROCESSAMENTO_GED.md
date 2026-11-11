# Operação do processamento documental

## Contratos e resultados

- Entrada autenticada: `POST /api/jobs`; tipos `PDF`, `PDFA`, `OCR`, `ZIP`, seleção completa/personalizada e chave de idempotência. Captura revisão, conteúdo e originais autorizados; reavalia o acesso na execução e no download.
- Execução direcionada: `npm run worker:documents -- --job <UUID>`. Esse modo reclama somente o trabalho indicado e não consome/limpa a fila de outras contas.
- Execução contínua: provisionar o worker e a rotina de limpeza da etapa 9. A execução manual de aceitação não oferece disponibilidade contínua.
- Resultados privados possuem SHA-256, tamanho, nome, prazo de expiração e download autenticado. OCR conserva o original e grava índice textual separado; PDF/A só é disponibilizado depois da validação independente.

## Dependências do worker

Configuração protegida a partir de `config/environment.example`:

| Variável | Configuração |
|---|---|
| `DATABASE_URL`, Firebase Admin e Blob | Mesmo ambiente lógico da fila; conta e arquivos privados autorizados. |
| `JOBS_CHROMIUM_BIN` | Chrome/Chromium executável para compilar os blocos HTML em PDF. JavaScript e service workers desabilitados no renderizador. |
| `JOBS_IMAGE_ORIGINS` | Origens HTTPS explicitamente permitidas para imagens externas. Imagens PNG/JPEG incorporadas também são aceitas. |
| `JOBS_GHOSTSCRIPT_BIN` | Executável Ghostscript com `pdfwrite`; conversão PDF/A-2. |
| `JOBS_PDFA_DEFINITION` | Arquivo PostScript de definição PDF/A com referência absoluta ao perfil ICC. |
| `JOBS_PDFA_ICC` | Caminho do perfil ICC para a permissão explícita de leitura do Ghostscript em modo `SAFER`. |
| `JOBS_VERAPDF_BIN` | Executável veraPDF, ou `java.exe` quando se usa o JAR. |
| `JOBS_VERAPDF_JAR` | Opcional: caminho do CLI veraPDF. A execução usa `java -jar`, sem shell ou `.bat`. |
| `JOBS_TESSERACT_BIN` | Executável Tesseract; `JOBS_OCR_LANG=por`. |
| `TESSDATA_PREFIX` | Pasta com `por.traineddata` correspondente à instalação. |
| `JOBS_PDFTOTEXT_BIN`, `JOBS_PDFTOPPM_BIN` | Poppler: extração textual e rasterização de cada página, incluindo PDFs híbridos. |
| `JOBS_TEMP_DIR` | Pasta privada temporária do executor, com espaço para originais e derivados. |
| `JOBS_OUTPUT_TTL_HOURS` | Expiração entre 1 e 168 horas; padrão 24. |

A definição pode ser preparada a partir de `lib/PDFA_def.ps` distribuído pelo Ghostscript, substituindo a referência `srgb.icc` pelo caminho absoluto do perfil. No Windows, usar `/` no caminho PostScript. O perfil deve ser autorizado por `JOBS_PDFA_ICC`.

O leitor do relatório veraPDF aceita `validationResult` singular ou em lista e exige conformidade em todos os resultados. Relatório vazio, resultado negativo ou perfil divergente não libera PDF/A. O relatório aprovado é preservado com o hash exato do artefato em `/api/jobs/<UUID>/validation`.

## PDF e prévia nativos

No detalhe do registro, **PDF**, **Folha de rosto** e **Pré-visualizar PDF** usam o mesmo renderizador A4. Há fontes em negrito/itálico, alinhamento/sublinhado, tabelas paginadas, hyperlinks, imagens PNG/JPEG incorporadas e paginação. Ofícios e atos incluem QR para consulta institucional autenticada. Esse QR identifica o registro; não atesta entrega ou assinatura.

Imagens HTTPS externas são incorporadas pelo worker com origens permitidas. O PDF nativo informa essa necessidade quando o conteúdo referencia uma imagem externa. A exportação nativa é PDF comum; a conformidade PDF/A pertence ao resultado validado da fila. Importação Word preserva o original e converte seu conteúdo para blocos editáveis; não promete equivalência tipográfica absoluta ao Word.

## Assinaturas preparadas

O detalhe documental e `/gestao/assinaturas` permitem solicitação individual/em lote, etapas simultâneas ou sequenciais, recusa e cancelamento justificados, resultado por documento e histórico. Cada solicitação preserva um envelope com conteúdo, metadados, revisão e hashes dos originais. A migração 012 protege esse envelope contra alterações e contra reescrita por unificação de contatos.

O hash identifica o conteúdo preparado. Execução criptográfica, certificados, PAdES, validação de autoria e notificações externas permanecem nos marcos 10/11. Não há transição fictícia para assinatura realizada.

## Reprodução da aceitação

```powershell
npm run validate:stage6 -- --allow-write --base http://localhost:3100 --tools "C:\caminho\worker.json"
```

`worker.json` é um objeto privado com as variáveis de ferramentas acima. O runner aceita apenas nomes `JOBS_*` e `TESSDATA_PREFIX`. Para o SaaS, informar `--allow-production --base https://rioazul.celeriflow.com.br`. O runner registra snapshot, cria recursos próprios, executa somente seus trabalhos, arquiva históricos, limpa seus recursos e reconfere os registros e o anexo originais. `.env.local` conectado aos provedores compartilhados exige esses mesmos cuidados mesmo usando localhost.
