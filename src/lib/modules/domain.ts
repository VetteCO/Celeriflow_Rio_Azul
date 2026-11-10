import { z } from "zod";

export const families = {
  ged: "Acervo documental", modelos: "Modelos", classificacao: "Plano de classificação",
  parecer: "Pareceres", oficio: "Ofícios", intimacao: "Intimações", pauta: "Pautas de reunião", atos: "Atos oficiais",
  fluxos: "Assuntos e fluxos", processos: "Processos administrativos", chamados: "Chamados técnicos",
  ouvidoria: "Ouvidoria", esic: "Pedidos de informação", pessoal: "Requerimentos pessoais",
  pad: "Processos disciplinares", judicial: "Processos judiciais", seletivo: "Processos seletivos",
  contatos: "Contatos e organizações", procuracoes: "Procurações", delegacoes: "Delegações",
  carta: "Carta de Serviços", diario: "Diário Oficial", projetos: "Projetos e parcelamento",
  ambiental: "Licenciamento ambiental", fiscalizacao: "Fiscalização", camadas: "Camadas geográficas",
  legislacao: "Legislação e zoneamento",
} as const;
export type Family = keyof typeof families;
export const configFamilies: Family[] = ["modelos", "classificacao", "fluxos", "carta", "camadas", "legislacao"];
export const processFamilies: Family[] = ["processos", "chamados", "ouvidoria", "esic", "pessoal", "pad", "judicial", "seletivo", "projetos", "ambiental", "fiscalizacao"];
export const familySchema = z.enum(Object.keys(families) as [Family, ...Family[]]);
const text = z.string().trim().max(5000);
const uuid = z.string().uuid();
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,49}$/), label: text.min(1),
  type: z.enum(["text", "number", "date", "select", "cpfCnpj", "cep", "phone", "currency"]),
  required: z.boolean().default(false), options: z.array(text).max(100).default([]),
  help: text.default(""), condition: z.object({ field: text, equals: text, operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"]).optional() }).optional(),
  calculation: z.object({ operation: z.enum(["sum", "subtract", "multiply", "divide", "min", "max"]), fields: z.array(text.min(1)).min(2).max(20), decimals: z.number().int().min(0).max(6) }).optional(),
});
export const stepSchema = z.object({ name: text.min(1), departments: z.array(uuid).min(1).max(30), hours: z.number().int().min(1).max(87600), decision: z.boolean().default(false) });
export const workflowSchema = z.object({ fields: z.array(fieldSchema).max(80), steps: z.array(stepSchema).min(1).max(50), requiredFiles: z.array(text.min(1)).max(30).default([]), family: familySchema, rhDepartmentId: uuid.optional(), identityDepartmentId: uuid.optional(), businessDays: z.boolean().optional(), routingDepartments: z.array(uuid).max(30).optional() });
export type Workflow = z.infer<typeof workflowSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type FileReview = { fileId: string; status: "ACEITO" | "RECUSADO"; note: string; actorId: string; at: string };
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().max(20000), bold: z.boolean(), italic: z.boolean(), underline: z.boolean(), align: z.enum(["left", "center", "right"]), size: z.number().int().min(10).max(36) }),
  z.object({ type: z.literal("table"), rows: z.array(z.array(z.string().max(1000)).min(1).max(12)).min(1).max(100) }),
  z.object({ type: z.literal("link"), label: z.string().max(1000), url: z.string().url().max(2000).refine(v => /^https?:\/\//i.test(v), "Utilize endereço HTTP ou HTTPS.") }),
  z.object({ type: z.literal("image"), caption: z.string().max(1000), url: z.string().max(3000000).refine(v => /^https:\/\/[^\s]+$/i.test(v) || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v), "Utilize imagem HTTPS, PNG ou JPEG incorporada.") }),
]);
export type ContentBlock = z.infer<typeof blockSchema>;
export type ModuleData = {
  externalSubmission?: boolean;
  evaluation?: { score: number; comment: string; at: string; cycle: number };
  evaluationCycle?: number;
  publishedAt?: string;
  publicationMode?: "INFORMATIVA" | "CERTIFICADA";
  syncHash?: string;
  blocks?: ContentBlock[];
  values?: Record<string, string>;
  workflow?: Workflow; workflowId?: string; workflowRevision?: number; step?: number;
  completedDepartments?: string[]; dueAt?: string; linkedIds?: string[];
  coreDocumentIds?: string[];
  tags?: string[]; classificationId?: string;
  files?: FileReview[];
  identity?: { name: string; email: string; cpfCnpj: string; phone: string };
  identityDepartmentId?: string;
  signatures?: { userId: string; order: number; status: "PENDENTE" | "RECUSADA" | "CANCELADA"; reason?: string; revision: number }[];
  messages?: { text: string; visibility: "INTERNA" | "EXTERNA"; actorId: string; at: string }[];
  agenda?: { title: string; responsible: string; decision: string }[];
  attendees?: string[];
  acknowledgements?: { recipient: string; evidence: string; at: string; actorId: string }[];
  publication?: { title: string; code: string; body: string; blocks?: ContentBlock[]; section: string; subsection?: string; withdrawn?: boolean; revision: number; id: string }[];
  sealedHash?: string;
  geometry?: GeoCollection;
  measurements?: { fileId: string; page: number; scale: number; points: number[][]; type: "distancia" | "area"; result: number; shape?: "polyline" | "polygon" | "rectangle" | "ellipse"; coordinateSystem?: "PDF_VIEWPORT_POINTS"; color?: string; width?: number; opacity?: number; precision?: number; fileHash?: string }[];
  jobs?: { id: string; kind: string; status: "AGUARDANDO_CONFIGURACAO"; at: string }[];
};
export type GeoFeature = { type: "Feature"; properties: Record<string, string | number | boolean | null>; geometry: { type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon"; coordinates: unknown } };
export type GeoCollection = { type: "FeatureCollection"; features: GeoFeature[] };
export const geoSchema = z.object({ type: z.literal("FeatureCollection"), features: z.array(z.object({
  type: z.literal("Feature"), properties: z.record(z.union([z.string().max(5000), z.number().finite(), z.boolean(), z.null()])),
  geometry: z.object({ type: z.enum(["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"]), coordinates: z.unknown() }),
})).max(5000) });

export type FamilyField = { key: string; label: string; required?: boolean; type?: Field["type"]; options?: string[] };
export const familyFields: Partial<Record<Family, FamilyField[]>> = {
  camadas: [{ key: "tipo", label: "Tipo de camada", type: "select", options: ["Zoneamento", "Lotes", "Ambiental", "Equipamentos", "Outra"] }, { key: "legislacao", label: "Referência legal da base" }, { key: "vigencia", label: "Vigência da base", type: "date" }],
  parecer: [{ key: "natureza", label: "Natureza", type: "select", options: ["Técnico", "Jurídico"], required: true }, { key: "conclusao", label: "Conclusão" }],
  oficio: [{ key: "destinatario", label: "Destinatário", required: true }, { key: "email", label: "E-mail do destinatário", required: true }],
  intimacao: [{ key: "destinatario", label: "Destinatário", required: true }, { key: "prazo", label: "Prazo para cumprimento", type: "date", required: true }],
  pauta: [{ key: "reuniao", label: "Data da reunião", type: "date", required: true }, { key: "local", label: "Local", required: true }],
  atos: [{ key: "especie", label: "Espécie", type: "select", options: ["Lei", "Decreto", "Portaria", "Edital", "Ata", "Contrato", "Comunicado"], required: true }],
  ouvidoria: [{ key: "modalidade", label: "Identificação", type: "select", options: ["Identificada", "Sigilosa", "Anônima"], required: true }, { key: "finalidade", label: "Finalidade", type: "select", options: ["Denúncia", "Elogio", "Reclamação", "Solicitação", "Sugestão"], required: true }],
  esic: [{ key: "canal", label: "Canal de recebimento", type: "select", options: ["Presencial", "Telefone", "Correspondência", "Internet"], required: true }],
  chamados: [{ key: "patrimonio", label: "Número do patrimônio" }, { key: "prioridade", label: "Prioridade", type: "select", options: ["Normal", "Alta", "Urgente"], required: true }],
  pad: [{ key: "infracao", label: "Infração em apuração", required: true }, { key: "portaria", label: "Portaria de instauração", required: true }, { key: "comissao", label: "Comissão responsável", required: true }],
  judicial: [{ key: "segmento", label: "Justiça", type: "select", options: ["Estadual", "Federal", "Trabalho", "Eleitoral", "Militar"], required: true }, { key: "numeroProcesso", label: "Número judicial", required: true }, { key: "vara", label: "Vara" }, { key: "autor", label: "Parte autora", required: true }, { key: "pasta", label: "Pasta" }, { key: "tipoAcao", label: "Tipo de ação" }, { key: "liminar", label: "Liminar" }, { key: "precatorio", label: "Precatório/RPV" }],
  seletivo: [{ key: "edital", label: "Edital", required: true }, { key: "vaga", label: "Vaga", required: true }, { key: "candidato", label: "Candidato", required: true }, { key: "cpfCnpj", label: "CPF", type: "cpfCnpj", required: true }],
  contatos: [{ key: "tipo", label: "Tipo", type: "select", options: ["Pessoa física", "Pessoa jurídica", "Setor de organização"], required: true }, { key: "cpfCnpj", label: "CPF/CNPJ", type: "cpfCnpj" }, { key: "email", label: "E-mail" }, { key: "phone", label: "Telefone", type: "phone" }, { key: "cep", label: "CEP", type: "cep" }, { key: "endereco", label: "Endereço" }, { key: "organizacao", label: "Organização" }],
  procuracoes: [{ key: "outorgante", label: "Outorgante", required: true }, { key: "outorgado", label: "Outorgado", required: true }, { key: "poderes", label: "Poderes concedidos", required: true }, { key: "validade", label: "Validade", type: "date", required: true }],
  delegacoes: [{ key: "digitador", label: "Servidor digitador (identificador)", required: true }, { key: "limite", label: "Limite de usos", type: "number", required: true }, { key: "validade", label: "Validade", type: "date", required: true }],
  carta: [{ key: "categoria", label: "Categoria", required: true }, { key: "publico", label: "Público destinatário", required: true }, { key: "requisitos", label: "Requisitos e documentos", required: true }, { key: "canais", label: "Canais e locais de atendimento", required: true }, { key: "prazo", label: "Prazo máximo", required: true }, { key: "etapas", label: "Etapas do atendimento", required: true }, { key: "prioridades", label: "Prioridades" }, { key: "espera", label: "Tempo de espera" }, { key: "manifestacao", label: "Canais de manifestação", required: true }],
  diario: [{ key: "tipo", label: "Edição", type: "select", options: ["Ordinária", "Extraordinária"], required: true }, { key: "data", label: "Data prevista", type: "date", required: true }, { key: "caderno", label: "Caderno", required: true }, { key: "secao", label: "Seção" }],
  projetos: [{ key: "tipo", label: "Projeto", type: "select", options: ["Construção", "Desmembramento", "Remembramento", "Retificação", "Loteamento", "Condomínio"], required: true }, { key: "inscricao", label: "Inscrição imobiliária", required: true }, { key: "proprietario", label: "Proprietário", required: true }, { key: "responsavel", label: "Responsável técnico / conselho", required: true }, { key: "areaTerreno", label: "Área do terreno (m²)", type: "number", required: true }, { key: "areaConstruida", label: "Área construída (m²)", type: "number" }, { key: "areaProjecao", label: "Área de projeção (m²)", type: "number" }, { key: "areaPermeavel", label: "Área permeável (m²)", type: "number" }],
  ambiental: [{ key: "licenca", label: "Licença/estudo", type: "select", options: ["LAP", "LAI", "LAO", "PGRS", "EIA-RIMA"], required: true }, { key: "empreendimento", label: "Empreendimento", required: true }, { key: "atividade", label: "Atividade / CNAE", required: true }, { key: "validade", label: "Validade", type: "date" }],
  fiscalizacao: [{ key: "objeto", label: "Objeto fiscalizado", required: true }, { key: "endereco", label: "Endereço", required: true }, { key: "latitude", label: "Latitude", type: "number", required: true }, { key: "longitude", label: "Longitude", type: "number", required: true }, { key: "checklist", label: "Constatações da diligência", required: true }, { key: "providencias", label: "Providências" }],
  legislacao: [{ key: "numero", label: "Número da legislação", required: true }, { key: "vigencia", label: "Início da vigência", type: "date", required: true }, { key: "zona", label: "Zona" }, { key: "usos", label: "Usos admitidos / CNAE" }, { key: "ocupacaoMaxima", label: "Taxa de ocupação máxima (%)", type: "number" }, { key: "coeficienteMaximo", label: "Coeficiente máximo", type: "number" }, { key: "permeabilidadeMinima", label: "Permeabilidade mínima (%)", type: "number" }],
  classificacao: [{ key: "nivel1", label: "Nível 1 — função", required: true }, { key: "nivel2", label: "Nível 2 — subfunção", required: true }, { key: "nivel3", label: "Nível 3 — atividade", required: true }, { key: "nivel4", label: "Nível 4 — série", required: true }, { key: "retencao", label: "Prazo de guarda" }, { key: "destinacao", label: "Destinação" }],
};

export function validateFields(fields: FamilyField[], values: Record<string, string>) {
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? "";
    if (field.required && !value) throw new Error(`Preencha ${field.label}.`);
    if (!value) continue;
    if (field.type === "number" && !Number.isFinite(Number(value))) throw new Error(`${field.label}: número inválido.`);
    if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) throw new Error(`${field.label}: data inválida.`);
    if (field.options?.length && !field.options.includes(value)) throw new Error(`${field.label}: opção inválida.`);
    if (field.type === "cpfCnpj" && !validTaxId(value)) throw new Error(`${field.label}: CPF/CNPJ inválido.`);
  }
}
export function validTaxId(value: string) {
  const digits = value.replace(/\D/g, "");
  if (![11, 14].includes(digits.length) || /^(\d)\1+$/.test(digits)) return false;
  const n = digits.split("").map(Number);
  if (n.length === 11) {
    return [9, 10].every(length => (n.slice(0, length).reduce((sum, v, i) => sum + v * (length + 1 - i), 0) * 10 % 11) % 10 === n[length]);
  }
  return [12, 13].every(length => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = n.slice(0, length).reduce((sum, v, i) => sum + v * weights[i], 0) % 11;
    return (remainder < 2 ? 0 : 11 - remainder) === n[length];
  });
}
export function validateWorkflowFields(workflow: Workflow, values: Record<string, string>) {
  const pending = new Set(workflow.fields.filter(f => f.calculation).map(f => f.key));
  while (pending.size) {
    let progressed = false;
    for (const field of workflow.fields) {
      const c = field.calculation; if (!c || !pending.has(field.key) || c.fields.some(k => pending.has(k))) continue;
      const numbers = c.fields.map(k => { if (!values[k]?.trim() || !Number.isFinite(Number(values[k]))) throw new Error(`Cálculo ${field.label}: preencha ${k} com número.`); return Number(values[k]); });
      let result = numbers[0];
      for (const n of numbers.slice(1)) { if(c.operation === "divide" && n === 0) throw new Error("Divisão por zero."); result = c.operation === "sum" ? result+n : c.operation === "subtract" ? result-n : c.operation === "multiply" ? result*n : c.operation === "divide" ? result/n : c.operation === "min" ? Math.min(result,n) : Math.max(result,n); }
      if(!Number.isFinite(result)) throw new Error("Resultado de cálculo inválido.");
      values[field.key] = result.toFixed(c.decimals); pending.delete(field.key); progressed = true;
    }
    if(!progressed) throw new Error("Há referência circular nos campos calculados.");
  }
  validateFields(workflow.fields.filter(f => conditionMatches(f, values)), values);
}
export function conditionMatches(field: Field, values: Record<string,string>) {
 const c=field.condition; if(!c) return true; const actual=values[c.field] ?? "", expected=c.equals;
 switch(c.operator ?? "eq") {
 case "eq": return actual===expected; case "neq": return actual!==expected;
 case "contains": return actual.includes(expected); case "in": return expected.split("|").map(v=>v.trim()).includes(actual);
 default: if(!actual.trim() || !expected.trim() || !Number.isFinite(Number(actual)) || !Number.isFinite(Number(expected))) return false;
 return c.operator==="gt" ? Number(actual)>Number(expected) : c.operator==="gte" ? Number(actual)>=Number(expected) : c.operator==="lt" ? Number(actual)<Number(expected) : Number(actual)<=Number(expected);
 }
}
export function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`);
}
export function distanceMeters(a: number[], b: number[]) {
  const rad = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function measure(points: number[][], scale: number, type: "distancia" | "area") {
  if (scale <= 0 || !Number.isFinite(scale) || points.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v)))) throw new Error("Escala ou pontos inválidos.");
  if (type === "distancia") {
    if (points.length < 2) throw new Error("Informe pelo menos dois pontos.");
    return points.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0) * scale;
  }
  if (points.length < 3) throw new Error("Informe pelo menos três pontos.");
  return Math.abs(points.reduce((s, p, i) => { const q = points[(i + 1) % points.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2 * scale ** 2;
}
export function measureShape(points: number[][], scale: number, type: "distancia" | "area", shape = type === "area" ? "polygon" : "polyline") {
  if (type === "area" && (shape === "ellipse" || shape === "rectangle")) {
    measure(points, scale, "distancia");
    if (points.length !== 2) throw new Error("Selecione dois cantos opostos.");
    const area = Math.abs((points[1][0] - points[0][0]) * (points[1][1] - points[0][1])) * scale ** 2;
    return shape === "ellipse" ? area * Math.PI / 4 : area;
  }
  return measure(points, scale, type);
}
export function validateGeometry(input: unknown): GeoCollection {
  const collection = geoSchema.parse(input);
  const point = (p: unknown): boolean => Array.isArray(p) && p.length >= 2 && p.length <= 3 && p.every(v => typeof v === "number" && Number.isFinite(v)) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
  const line = (p: unknown): boolean => Array.isArray(p) && p.length >= 2 && p.every(point);
  const ring = (p: unknown): boolean => Array.isArray(p) && p.length >= 4 && p.every(point) && JSON.stringify(p[0]) === JSON.stringify(p[p.length - 1]);
  const polygon = (p: unknown): boolean => Array.isArray(p) && p.length > 0 && p.every(ring);
  for (const f of collection.features) {
    const c = f.geometry.coordinates;
    const valid = f.geometry.type === "Point" ? point(c) : f.geometry.type === "MultiPoint" ? Array.isArray(c) && c.length > 0 && c.every(point) : f.geometry.type === "LineString" ? line(c) : f.geometry.type === "MultiLineString" ? Array.isArray(c) && c.length > 0 && c.every(line) : f.geometry.type === "Polygon" ? polygon(c) : Array.isArray(c) && c.length > 0 && c.every(polygon);
    if (!valid) throw new Error("Geometria inválida. Utilize coordenadas WGS84 (longitude, latitude).");
  }
  return collection as GeoCollection;
}
