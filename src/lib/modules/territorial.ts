import { z } from "zod";
export const inspectionSchema = z.object({
  operationId: z.string().uuid(), capturedAt: z.string().datetime({ offset: true }),
  latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100000).optional(),
  findings: z.string().trim().min(3).max(5000), measures: z.string().trim().max(5000).default(""),
  fileIds: z.array(z.string().uuid()).max(50).default([]),
});
export function urbanParameters(values: Record<string, string>) {
  const terrain = Number(values.areaTerreno);
  if (!(terrain > 0) || !Number.isFinite(terrain)) throw new Error("A área do terreno deve ser positiva.");
  const area = (key: string) => { const number = Number(values[key] || 0); if (!Number.isFinite(number) || number < 0) throw new Error("Áreas devem ser números não negativos."); return number; };
  const built = area("areaConstruida"), footprint = area("areaProjecao"), permeable = area("areaPermeavel");
  if (footprint > terrain || permeable > terrain || footprint + permeable > terrain + 0.000001) throw new Error("Projeção e área permeável devem caber na área do terreno.");
  return { coefficient: built / terrain, occupation: 100 * footprint / terrain, permeability: 100 * permeable / terrain };
}
export function checkUrbanLimits(values: Record<string, string>, law: Record<string, string>) {
  const metrics = urbanParameters(values);
  return ([ ["coeficienteMaximo", metrics.coefficient, "Coeficiente de aproveitamento", "max"], ["ocupacaoMaxima", metrics.occupation, "Taxa de ocupação (%)", "max"], ["permeabilidadeMinima", metrics.permeability, "Permeabilidade (%)", "min"] ] as const)
    .map(([key, actual, label, direction]) => ({ key, label, actual, limit: law[key]?.trim() ? Number(law[key]) : null, conforms: !law[key]?.trim() ? null : direction === "max" ? actual <= Number(law[key]) : actual >= Number(law[key]) }));
}
