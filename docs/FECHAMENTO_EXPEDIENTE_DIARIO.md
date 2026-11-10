# Fechamento — expediente e catálogo do Diário

Data: 10/11/2026. Implementação desta frente, pendente do fechamento integrado da sessão principal. Nenhum teste, lint, TypeScript, build, seed, migração remota, deploy ou commit foi executado nesta frente.

## Entrega

- `src/lib/modules/business-hours.ts`: configuração versionada por setor, turnos múltiplos por dia e intervalos; rejeição de sobreposição/turno invertido. Cálculo em milissegundos úteis, inclusive horas fracionárias, usando `America/Sao_Paulo` via Intl, excluindo fins de semana e `calendar_holiday`. Sem aproximação por dias ou arredondamento por hora inteira.
- Campos existentes reutilizados: `workflow.steps[].hours`, `workflow.steps[].departments`, `workflow.businessDays`. Etapas simultâneas calculam o prazo de cada setor e adotam o maior vencimento. SLA corrido continua corrido. SLA útil exige expediente ativo em todos os setores, com erro operacional explícito se faltar configuração. Não existe jornada municipal presumida no cálculo. A tela oferece modelo editável de turnos, persistido somente ao salvar.
- Protocolo interno e avanço real em `src/lib/modules/server.ts` já usam esse cálculo. Prazos já emitidos não são recalculados retroativamente.
- `src/lib/modules/diary-catalog.ts`: caderno obrigatório, seção/subseção opcionais, pais do nível imediatamente anterior (portanto ciclos impossíveis), ordem, ativação/inativação, reparenting e revisão otimista. Tipo de um item existente é imutável. Descendentes devem ser inativados antes do pai.
- Organização real da edição: seleciona catálogo por ato, reordena, retira/reativa com justificativa, preserva conteúdo dos atos, gera nova revisão/auditoria, atualiza hash e limpa solicitações de assinatura anteriores à alteração. Snapshots de classificação são armazenados junto a cada ato da edição; mudar o cadastro não reescreve edições.
- Publicação real em `server.ts` valida o snapshot completo, rótulos, hierarquia e ativação; se o catálogo mudou, o operador precisa salvar novamente a organização antes de publicar. Trigger adicional valida classificação no banco durante a publicação e compartilha lock com alterações do catálogo. Publicações anteriores permanecem com o conteúdo histórico original.
- Publicadores existentes continuam usando a permissão atual: publicar exige ADMIN_GERAL; organizar exige `doc:edit` e gestão autorizada do registro. Cadastro de expediente/catálogo exige ADMIN_GERAL. Consultas exigem servidor ativo com `doc:view`.
- Auditoria de configuração contém antes/depois, autor, justificativa, revisão e timestamp do evento. Organização usa o histórico/auditoria já existentes em `module_record`/`module_version`.

## Migração aditiva

Aplicar **somente `src/db/migrations/007_workflow_diary.sql`**, pelo executor principal após conferir a ordenação com a 006 da outra frente. Migrações 0001–005 não foram alteradas. Novas tabelas: `module_business_hours`, `module_diary_catalog`. Schemas Drizzle definidos nos próprios módulos novos, sem editar schemas compartilhados.

## Entradas entregues

- `/gestao/expediente`: seleção de setor, turnos semanais, ativação, justificativa, gravação, simulação de vencimento usando configuração salva e relação de feriados consultados.
- `/gestao/diario/catalogo`: cadastro/edição/movimentação/ordem/ativação de itens; seleção de edição autorizada e organização/classificação/retirada/reativação de seus atos. Tem links para listagens e detalhe de edição.
- `/api/modules/business-hours`: GET configuração/feriados; PUT configuração com revisão e justificativa; POST simulação.
- `/api/modules/diary-catalog`: GET catálogo; PUT cadastro/alteração com revisão e justificativa.
- `/api/modules/diary-catalog/editions/[id]`: PUT `{ revision, note, items: [{ id, catalogId, withdrawn }] }`. A ordem do array é a ordem final dos atos. Exige exatamente os atos preservados na composição, sem excluir snapshots.

## Conexões necessárias pela sessão principal (arquivos fora do escopo desta frente)

1. Acrescentar no menu/entrada da Gestão os links **Expediente por setor** → `/gestao/expediente` e **Diário — Catálogo e organização** → `/gestao/diario/catalogo`. No detalhe da edição acrescentar o segundo link após “Preparar edição”. A tela dedicada já opera as ações reais.
2. Substituir as três chamadas restantes do calendário antigo por `workflowDeadline`, importado de `@/lib/modules/business-hours` (ou `./business-hours`):
   - `src/lib/modules/external.ts`: `workflowDeadline(data.workflow.steps[0].hours, data.workflow.businessDays, data.workflow.steps[0].departments)` na protocolização externa.
   - `src/app/api/modules/anonymous/route.ts`: `workflowDeadline(workflow.steps[0].hours, workflow.businessDays, workflow.steps[0].departments)` na abertura anônima.
   - `src/app/api/modules/records/[id]/completion/route.ts`: `workflowDeadline(p.hours, data.workflow.businessDays, [sector.id])` na diligência.
   Sem essas conexões as entradas citadas continuam usando a função histórica em `calendar.ts`; não considerar o SLA útil integralmente integrado antes de concluí-las.
3. Se desejar tipagem central: acrescentar ao item de `ModuleData.publication` o opcional `catalogPath?: { id: string; parentId: string | null; kind: string; name: string; position: number; revision: number }[]`. A implementação atual usa tipo ampliado local e já persiste os campos sem precisar dessa alteração.
4. A composição antiga `PREPARAR_EDICAO` permanece sendo o primeiro passo: seleciona/copía os atos; depois a tela nova classifica-os. O comando `PUBLICAR` agora recusa composição sem catálogo. A organização legada de rótulos livres em ferramentas pode divergir do snapshot e será recusada ao publicar; substituir seus controles por link para a tela nova para unificar a experiência.
5. Exportações públicas existentes continuam legíveis porque `section` contém “Caderno / Seção” e `subsection` contém a subseção, além do snapshot estruturado completo.

## Aceite integrado a executar

Referências: PRZ-P70-01.a–c, PRO-P57-01.g, DIO-P47-02.d, DIO-P48-03.a–b, DIO-P49-01.a/e (recorte desta frente; não equivalem ao aceite integral dos grupos).

1. Configurar segunda–sexta 08–12/13–17. Início sexta 11:30, SLA 2h → sexta 14:30. Início sexta 16:30, SLA 2h → segunda 09:30; se segunda for feriado → terça 09:30. Início no intervalo deve consumir a partir das 13h. SLA de 0,25h deve preservar minutos/segundos sem arredondamento.
2. Configurar dois setores com jornadas distintas; protocolar fluxo paralelo e conferir maior vencimento. Alterar jornadas e confirmar que prazo já emitido permanece e próxima etapa usa a nova configuração. Recusar SLA útil quando um setor não tem expediente ativo.
3. Percorrer protocolo interno, externo, anônimo, avanço e diligência após as conexões da principal. Conferir prazo corrido independente de expediente.
4. Criar caderno, seção, subseção; recusar pai incompatível/ciclo, tipo alterado, ativação sob pai inativo e inativação de pai com filho ativo. Conferir antes/depois na auditoria e conflito 409 de revisão.
5. Preparar edição, classificar atos em níveis diferentes, reordenar, retirar/reativar com justificativa e conferir versões. Recusar alteração por usuário fora do escopo e por perfil de consulta.
6. Alterar nome/posição/pai do catálogo após classificação; publicar deve exigir atualização dos snapshots. Reclassificar, publicar e conferir leitura/PDF públicos, sem os retirados. Renomear/reparentar catálogo depois da publicação e confirmar snapshot publicado intacto.
7. Tentar publicação direta pela API sem catálogo e organização de edição publicada; ambas devem falhar. Conferir concorrentemente gravação de catálogo e publicação na validação do banco.

Publicação permanece informativa conforme o fluxo já existente. Assinatura/certificação pertence às integrações posteriores.
