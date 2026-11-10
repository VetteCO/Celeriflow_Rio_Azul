import * as shapefile from "shapefile";
import proj4 from "proj4";
import { admin, context, failure, ModuleError } from "@/lib/modules/server";
import { validateGeometry } from "@/lib/modules/domain";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const ctx = await context(req, "doc:create"); admin(ctx);
    const form = await req.formData(); const shp = form.get("shp"); const dbf = form.get("dbf"); const prj = form.get("prj");
    if (!(shp instanceof File) || !shp.size || shp.size > 20 * 1024 * 1024) throw new ModuleError("Informe o arquivo SHP, até 20 MB.");
    if (!(prj instanceof File) || prj.size > 100000) throw new ModuleError("Informe o arquivo PRJ com o sistema de referência da base.");
    if (dbf instanceof File && dbf.size > 20 * 1024 * 1024) throw new ModuleError("DBF deve ter até 20 MB.");
    const projection = (await prj.text()).trim();
    let transform: proj4.Converter;
    try { transform = proj4(projection, "EPSG:4326"); } catch { throw new ModuleError("Projeção PRJ não suportada. Converta a base para WGS84 e forneça seu PRJ."); }
    const encoding = String(form.get("encoding") ?? "utf-8");
    if (!["utf-8", "windows-1252", "iso-8859-1"].includes(encoding)) throw new ModuleError("Codificação DBF inválida.");
    const source = await shapefile.open(await shp.arrayBuffer(), dbf instanceof File ? await dbf.arrayBuffer() : undefined, { encoding });
    const features = [];
    const convert = (coordinates: unknown): unknown => {
      if (!Array.isArray(coordinates)) throw new ModuleError("Coordenadas SHP inválidas.");
      if (typeof coordinates[0] === "number") { const transformed = transform.forward([coordinates[0], coordinates[1]]); return [transformed[0], transformed[1]]; }
      return coordinates.map(convert);
    };
    for (;;) {
      const item = await source.read(); if (item.done) break;
      if (features.length >= 5000) { await source.cancel(); throw new ModuleError("Divida a base em camadas de até 5.000 elementos."); }
      if (!item.value.geometry || !("coordinates" in item.value.geometry)) throw new ModuleError("Base contém geometria nula ou não suportada.");
      const properties = Object.fromEntries(Object.entries(item.value.properties ?? {}).map(([key, value]) => [key, value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : String(value)]));
      features.push({ type: "Feature", properties, geometry: { type: item.value.geometry.type, coordinates: convert(item.value.geometry.coordinates) } });
    }
    const geometry = validateGeometry({ type: "FeatureCollection", features });
    return Response.json({ geometry, source: { filename: shp.name, projection, count: features.length, encoding }, message: "Base convertida para WGS84. Salve e ative a camada para disponibilizá-la." });
  } catch (e) { return failure(e); }
}
