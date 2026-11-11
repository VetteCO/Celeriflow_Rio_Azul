# Dados persistentes para apresentação — 11/11/2026

## Resultado

A base consultada passou de **25/52 para 45/52 tabelas com registros** e de **0/27 para 27/27 famílias de módulos populadas**. Foram acrescentados 41 registros de módulos, oito setores, seis servidores, dois documentos do núcleo, arquivos, tramitações e registros operacionais relacionados. Os números representam o inventário desta rodada, não limites mínimos do sistema.

O cenário é a adequação do **Centro Cultural das Veredas**, em **Aurora das Veredas/MG**. Município, pessoas, legislação local e expedientes são fictícios e verossímeis. Os documentos fiscais têm verificadores matematicamente válidos; não comprovam identidade civil ou existência cadastral. A linguagem das telas é operacional.

A aplicação local utilizada aponta para os mesmos serviços de dados da publicação. Os exemplos persistem na base acessada por `https://rioazul.celeriflow.com.br`. A navegação das 27 famílias, do projeto e do geoportal foi conferida no navegador contra o build local. Na publicação HTTPS, o login por senha e 33 consultas autenticadas confirmaram registros nas 27 famílias e acesso ao memorando, circular, cursos, chamados, relatórios prontos e fila de assinaturas. Essa conferência de disponibilidade não equivale à homologação integral por HTTPS.

## Acesso

- Entrada: `https://rioazul.celeriflow.com.br/admin`.
- Conta principal: **Helena Duarte**, `helena.duarte@auroradasveredas.example`, Administrador Geral, vinculada aos setores do cenário.
- Demais contas: Marcos Azevedo (Nível 1), Clara Ribeiro (Nível 2), Rafael Nogueira (Nível 3), Laura Antunes (Auditor), Renata Paiva (Administrador Local).
- Senhas aleatórias e dados de acesso estão somente em `%LOCALAPPDATA%\Temp\opencode\demo-aurora-20261111\access.private.json`. O arquivo não integra o repositório.
- Para exibir o certificado de EAD, entrar como **Rafael Nogueira**: o progresso é individual. Helena pode administrar os cursos e atender os chamados.
- Os e-mails `.example` são endereços reservados de exemplo; não há caixa postal ou recebimento de mensagem comprovado.

## Roteiro de apresentação

1. **Administração e setores:** apresentar o organograma e os seis perfis, vínculos secundários, expediente de oito setores e feriado nacional de 20/11.
2. **Documentos:** abrir “Adequação do Centro Cultural das Veredas”. Apresentar dois prazos, plano de trabalho PDF, recebimento e resposta de Engenharia. Mostrar também a circular “Organização do atendimento e encaminhamento de documentos”.
3. **Contatos:** Beatriz Moreira, Associação Cultural das Veredas e Gustavo Almeida, com perfil de atendimento e lista “Conselho de Desenvolvimento Cultural”.
4. **Configuração documental:** modelo de parecer técnico, plano de classificação de equipamentos culturais e 11 assuntos/fluxos ativos.
5. **Acervo e expedientes:** memorial concluído, parecer concluído, ofício com destinatário vinculado, intimação e pauta de reunião. O memorial tem dois signatários pendentes; nenhuma assinatura certificada foi criada.
6. **Atendimento e processos:** aquisição de mobiliário deferida, chamado técnico em andamento, ouvidoria identificada e anônima, pedido de informação deferido, requerimento pessoal, apuração disciplinar, acompanhamento judicial e inscrição em seleção.
7. **Urbanismo:** projeto do centro cultural com terreno de 1.200 m², construção de 720 m², projeção de 540 m² e permeabilidade de 360 m²; planta, medição, anexo aceito, cópia anotada e comparação com a regra urbanística selecionada. Outro pedido mostra o indeferimento de desmembramento por falta de matrícula e confrontações.
8. **Ambiente e fiscalização:** licença vinculada ao projeto e vistoria com coordenadas, evidência PDF, constatações, providências e histórico. No geoportal, localizar o centro cultural e a Zona Central.
9. **Diário e serviços:** edição organizada em caderno/seção, aguardando assinatura institucional, e Carta de Serviços ativa. A edição não é uma publicação oficial autenticada.
10. **Operação:** dois cursos, progresso e certificado do usuário de exemplo, chamado em atendimento, chamado resolvido com avaliação, relatório de novembro e saídas CSV/PDF/XLSX; processamento PDF/ZIP/PDF-A/OCR executado de verdade.

Os arquivos de processamento e relatórios prontos têm retenção e podem expirar. Para uma apresentação posterior, gerar novas saídas pelas telas e executar o worker correspondente. O preenchimento atual não provisiona workers ou scheduler permanentes.

## Cobertura das tabelas

Contagens anteriores ao povoamento e após sua conclusão, com inventários privados disponíveis para reconferência. As categorias descrevem o papel predominante da tabela, não um requisito de preenchimento.

| Tabela | Antes | Depois | Papel |
|---|---:|---:|---|
| `app_user` | 15 | 21 | Negócio |
| `application_migration` | 12 | 12 | Técnico |
| `attachment` | 1 | 2 | Negócio |
| `audit_log` | 5356 | 5634 | Técnico |
| `business_counter` | 5 | 5 | Técnico |
| `calendar_holiday` | 0 | 1 | Negócio |
| `citizen` | 2 | 2 | Negócio |
| `citizen_identity` | 2 | 2 | Negócio |
| `department` | 6 | 14 | Negócio |
| `document` | 5 | 7 | Negócio |
| `document_access` | 0 | 1 | Negócio |
| `document_deadline` | 2 | 4 | Negócio |
| `document_job` | 2 | 6 | Negócio |
| `document_job_blob` | 2 | 6 | Técnico |
| `document_job_text` | 0 | 1 | Técnico |
| `document_movement` | 9 | 29 | Negócio |
| `document_participation` | 9 | 16 | Negócio |
| `document_read_receipt` | 2 | 3 | Negócio |
| `document_recipient` | 21 | 25 | Negócio |
| `email_message` | 3 | 3 | Negócio |
| `external_request` | 2 | 2 | Negócio |
| `module_anonymous_access` | 0 | 1 | Negócio |
| `module_anonymous_operation` | 0 | 1 | Técnico |
| `module_business_hours` | 0 | 8 | Negócio |
| `module_citizen_alias` | 0 | 0 | Técnico |
| `module_contact_account` | 0 | 0 | Negócio |
| `module_contact_legacy` | 0 | 0 | Técnico |
| `module_contact_merge` | 0 | 0 | Técnico |
| `module_contact_profile` | 0 | 1 | Negócio |
| `module_contact_segment` | 0 | 1 | Negócio |
| `module_diary_catalog` | 0 | 2 | Negócio |
| `module_edit_lease` | 0 | 0 | Temporário |
| `module_file` | 0 | 5 | Negócio |
| `module_mandate` | 0 | 0 | Negócio |
| `module_passcode` | 0 | 0 | Temporário |
| `module_record` | 0 | 41 | Negócio |
| `module_sector_tag` | 0 | 2 | Negócio |
| `module_version` | 0 | 120 | Negócio |
| `operation_course` | 0 | 2 | Negócio |
| `operation_page_metric` | 3 | 3 | Técnico |
| `operation_participation_history` | 9 | 17 | Negócio |
| `operation_progress` | 0 | 1 | Negócio |
| `operation_report` | 0 | 1 | Negócio |
| `operation_report_job` | 0 | 3 | Negócio |
| `operation_ticket` | 0 | 2 | Negócio |
| `organization` | 1 | 1 | Negócio |
| `permission` | 8 | 8 | Técnico |
| `role` | 6 | 6 | Técnico |
| `user_admin_department` | 0 | 1 | Negócio |
| `user_department` | 0 | 14 | Negócio |
| `user_profile` | 9 | 15 | Negócio |
| `user_role` | 15 | 21 | Negócio |

### Cobertura ainda parcial

- `module_contact_account`: falta o vínculo de cadastro de uma conta externa com e-mail efetivamente confirmado em caixa controlada.
- `module_mandate`: falta uma outorga e aceite pelo representante nas contas externas correspondentes. Existe exemplo documental de procuração, distinto do mandato eletrônico aceito.
- `module_citizen_alias`, `module_contact_legacy`, `module_contact_merge`: históricos técnicos de sincronização/unificação, atualmente vazios. Não representam três módulos de tela sem cadastro.
- `module_edit_lease` e `module_passcode`: reservas/chaves temporárias, criadas quando a operação exige; não precisam permanecer preenchidas.
- Gov.br, ICP-Brasil, entrega por Resend, retorno Sisobra e publicação oficial autenticada continuam dependentes das respectivas integrações. Registros de exemplo não equivalem a comprovantes desses serviços.

Assim, **27/27 famílias com exemplos não significa todas as funcionalidades e integrações integralmente demonstráveis**. Os limites das etapas 0–9 e da homologação continuam no plano vigente.

## Preservação e execução

O snapshot imediatamente anterior ao povoamento contém **5.507 linhas em 52 tabelas**. A comparação de todas essas linhas não identificou exclusão nem alteração inesperada. Houve avanço monotônico de três contadores e atualização da data de último acesso do administrador autenticado. O anexo anterior manteve seus 78 bytes reais e SHA-256.

Comandos adicionados:

```powershell
npm run audit:demo -- --output "$env:LOCALAPPDATA\Temp\opencode\cobertura-atual.json"
npm run demo:verify-preservation -- --directory "$env:LOCALAPPDATA\Temp\opencode\demo-aurora-20261111"
```

`demo:prepare` usa `--apply`, `--base`, `--directory` e `--tools`, chama as APIs operacionais e mantém manifesto privado por ação. A preparação concluída desta rodada está em `demo-aurora-20261111`; retomar com **o mesmo diretório** evita recriar os recursos já registrados. Uma escrita de resultado incerto interrompe a retomada até a conferência do manifesto. O script não é seed de inicialização e não é executado pelo build/deploy.

Evidências em `%LOCALAPPDATA%\Temp\opencode\demo-aurora-20261111`: `coverage-after.json`, `preservation.json`, `summary.json`, `geoportal.png` e `project.png`. Snapshot, manifesto, credenciais e diagnósticos permanecem privados. Resumo dos testes desta rodada: [VALIDACAO_COMPLETA_2026-11-11.md](VALIDACAO_COMPLETA_2026-11-11.md).
