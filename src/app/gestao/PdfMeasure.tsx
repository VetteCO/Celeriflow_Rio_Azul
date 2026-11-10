"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { getToken } from "@/components/session";
import { measureShape, type ModuleData } from "@/lib/modules/domain";
type Measurement = NonNullable<ModuleData["measurements"]>[number];
type FileInfo = { id: string; filename: string; mimeType: string; sha256: string };
export function PdfMeasure({ recordId, files, measurements, save, busy }: { recordId: string; files: FileInfo[]; measurements: Measurement[]; save: (payload: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [fileId, setFileId] = useState(""); const [pdf, setPdf] = useState<PDFDocumentProxy>(); const [page, setPage] = useState(1); const [zoom, setZoom] = useState(1); const [size, setSize] = useState({ width: 0, height: 0 }); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<number[][]>([]); const [shape, setShape] = useState<"polyline" | "polygon" | "rectangle" | "ellipse">("polyline"); const [denominator, setDenominator] = useState("100"); const [calibrating, setCalibrating] = useState(false); const [knownDistance, setKnownDistance] = useState(""); const [calibratedScale, setCalibratedScale] = useState<number>();
  const [color, setColor] = useState("#d91d48"); const [width, setWidth] = useState(2); const [opacity, setOpacity] = useState(0.8); const [precision, setPrecision] = useState(2); const [dragging, setDragging] = useState<number>(); const canvas = useRef<HTMLCanvasElement>(null);
  const file = files.find(f => f.id === fileId); const metricScale = calibratedScale ?? Number(denominator) * 0.0254 / 72; const type = shape === "polyline" ? "distancia" : "area";
  useEffect(() => {
    if (!fileId) return; let cancelled = false; let document: PDFDocumentProxy | undefined; const abort = new AbortController();
    setLoading(true); setError(""); setPdf(undefined); setSize({ width: 0, height: 0 }); setPage(1); setPoints([]); setCalibratedScale(undefined);
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      const token = await getToken(); const response = await fetch(`/api/modules/records/${recordId}/files/${fileId}`, { headers: { authorization: `Bearer ${token}` }, signal: abort.signal });
      if (!response.ok) throw new Error("Não foi possível abrir o PDF autorizado.");
      const bytes = new Uint8Array(await response.arrayBuffer()); if (cancelled) return;
      document = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
      if (cancelled) { await document.destroy(); return; } setPdf(document);
    })().catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; abort.abort(); void document?.destroy(); };
  }, [recordId, fileId]);
  useEffect(() => {
    if (!pdf) return; let cancelled = false; let task: RenderTask | undefined;
    (async () => {
      const selectedPage = await pdf.getPage(page); if (cancelled || !canvas.current) return;
      const base = selectedPage.getViewport({ scale: 1 }); const dpr = Math.min(window.devicePixelRatio || 1, 2); const viewport = selectedPage.getViewport({ scale: zoom * dpr });
      const target = canvas.current; target.width = viewport.width; target.height = viewport.height;
      target.style.width = `${base.width * zoom}px`; target.style.height = `${base.height * zoom}px`; setSize({ width: base.width, height: base.height });
      const context = target.getContext("2d"); if (!context) throw new Error("Renderização indisponível neste navegador.");
      task = selectedPage.render({ canvasContext: context, viewport }); await task.promise;
    })().catch(e => { if (!cancelled && e.name !== "RenderingCancelledException") setError(e.message); });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, page, zoom]);
  let result: number | undefined;
  try { if (!calibrating) result = measureShape(points, metricScale, type, shape); } catch { /* An unfinished drawing has no measurement. */ }
  const pointAt = (event: React.PointerEvent<SVGSVGElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return [Math.max(0, Math.min(size.width, (event.clientX - rect.left) / rect.width * size.width)), Math.max(0, Math.min(size.height, (event.clientY - rect.top) / rect.height * size.height))]; };
  const outline = (m: Pick<Measurement, "points" | "shape" | "type" | "color" | "width" | "opacity">, key: string) => {
    if (!m.points.length) return null; const attributes = { stroke: m.color ?? color, strokeWidth: m.width ?? width, opacity: m.opacity ?? opacity, fill: m.type === "area" ? `${m.color ?? color}22` : "none", pointerEvents: "none" as const };
    if ((m.shape === "rectangle" || m.shape === "ellipse") && m.points.length === 2) { const [a, b] = m.points; const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]); return m.shape === "ellipse" ? <ellipse key={key} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...attributes} /> : <rect key={key} x={x} y={y} width={w} height={h} {...attributes} />; }
    return <path key={key} d={`M${m.points.map(p => p.join(",")).join(" L")}${m.type === "area" && m.points.length > 2 ? " Z" : ""}`} {...attributes} />;
  };
  return <fieldset><legend>Medição gráfica da planta PDF</legend><label>Original PDF<select value={fileId} onChange={e => setFileId(e.target.value)}><option value="">Selecione</option>{files.filter(f => f.mimeType === "application/pdf").map(f => <option key={f.id} value={f.id}>{f.filename}</option>)}</select></label>{error && <p role="alert">{error}</p>}{loading && <p role="status">Abrindo PDF…</p>}
    {pdf && <><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><label>Página<select value={page} onChange={e => { setPage(Number(e.target.value)); setPoints([]); setCalibratedScale(undefined); }}>{Array.from({ length: pdf.numPages }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label><label>Zoom<select value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[0.5, 0.75, 1, 1.5, 2].map(z => <option key={z} value={z}>{z * 100}%</option>)}</select></label><label>Ferramenta<select value={shape} onChange={e => { setShape(e.target.value as typeof shape); setPoints([]); setCalibrating(false); }}><option value="polyline">Distância / polilinha</option><option value="polygon">Área poligonal</option><option value="rectangle">Área retangular</option><option value="ellipse">Área elíptica</option></select></label><label>Escala nominal 1:<input type="number" min={1} step="any" value={denominator} onChange={e => { setDenominator(e.target.value); setCalibratedScale(undefined); }} /></label></div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}><label>Cor<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label><label>Espessura<input type="number" min={0.5} max={10} step={0.5} value={width} onChange={e => setWidth(Number(e.target.value))} /></label><label>Opacidade<input type="range" min={0.1} max={1} step={0.1} value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label><label>Casas decimais<select value={precision} onChange={e => setPrecision(Number(e.target.value))}>{[0, 1, 2, 3, 4].map(p => <option key={p}>{p}</option>)}</select></label><button type="button" className="btn" onClick={() => { setCalibrating(true); setPoints([]); }}>Calibrar por distância conhecida</button><button type="button" className="btn" onClick={() => setPoints(p => p.slice(0, -1))}>Desfazer ponto</button><button type="button" className="btn" onClick={() => { setPoints([]); setCalibrating(false); }}>Limpar desenho</button></div>
    <p>{calibrating ? "Clique nos dois extremos de uma distância conhecida na planta." : "Clique diretamente na planta para marcar vértices. Arraste os marcadores para ajustar a medição."} Unidade de referência: ponto PDF (1/72 polegada).</p>
    <div style={{ maxWidth: "100%", overflow: "auto", maxHeight: "70vh", border: "1px solid #bbb" }}><div style={{ position: "relative", width: size.width * zoom || undefined, height: size.height * zoom || undefined }}><canvas ref={canvas} aria-label={`Planta original, página ${page}`} /><svg viewBox={`0 0 ${size.width || 1} ${size.height || 1}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }} aria-label="Desenho de medições sobre a planta" onPointerDown={e => { const target = e.target as SVGElement; const index = target.getAttribute("data-point"); if (index !== null) { setDragging(Number(index)); e.currentTarget.setPointerCapture(e.pointerId); return; } const point = pointAt(e); setPoints(p => calibrating || shape === "rectangle" || shape === "ellipse" ? p.length < 2 ? [...p, point] : [point] : [...p, point]); }} onPointerMove={e => { if (dragging === undefined) return; const point = pointAt(e); setPoints(p => p.map((v, i) => i === dragging ? point : v)); }} onPointerUp={() => setDragging(undefined)}>
      {measurements.filter(m => m.fileId === fileId && m.page === page && m.coordinateSystem === "PDF_VIEWPORT_POINTS").map((m, i) => outline(m, `saved-${i}`))}{outline({ points, shape: calibrating ? "polyline" : shape, type: calibrating ? "distancia" : type, color, width, opacity }, "current")}{points.map((p, i) => <circle key={i} data-point={i} cx={p[0]} cy={p[1]} r={5 / zoom} fill="white" stroke={color} strokeWidth={1.5 / zoom} style={{ cursor: "move" }} />)}
    </svg></div></div>
    {calibrating && <div><label>Distância real entre os dois pontos (metros)<input type="number" min={0.0001} step="any" value={knownDistance} onChange={e => setKnownDistance(e.target.value)} /></label><button type="button" disabled={points.length !== 2 || !(Number(knownDistance) > 0)} className="btn" onClick={() => { const length = Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]); if (!length) { setError("Selecione pontos distintos."); return; } setCalibratedScale(Number(knownDistance) / length); setCalibrating(false); setPoints([]); }}>Aplicar calibração à página</button></div>}
    <p>{calibratedScale ? "Escala calibrada" : `Escala nominal 1:${denominator}`} — {metricScale.toFixed(8)} metros por ponto PDF.{result !== undefined && Number.isFinite(result) ? ` Resultado: ${result.toFixed(precision)} ${type === "area" ? "m²" : "m"}.` : ""}</p>
    <button type="button" className="btn btn-primary" disabled={busy || !file || result === undefined || !Number.isFinite(result) || result <= 0 || calibrating} onClick={async () => { if (!file) return; try { await save({ fileId, fileHash: file.sha256, page, points, type, shape, scale: metricScale, coordinateSystem: "PDF_VIEWPORT_POINTS", color, width, opacity, precision }); setPoints([]); } catch (e) { setError((e as Error).message); } }}>Preservar medição</button>
    <h3>Medições preservadas nesta página</h3>{measurements.filter(m => m.fileId === fileId && m.page === page).map((m, i) => <p key={i}>{m.result.toFixed(m.precision ?? 4)} {m.type === "area" ? "m²" : "m"} — {m.coordinateSystem === "PDF_VIEWPORT_POINTS" ? "Desenho sobre o PDF" : "Registro numérico anterior"} {m.coordinateSystem === "PDF_VIEWPORT_POINTS" && <button type="button" className="btn" onClick={() => { setPoints(m.points); setShape(m.shape ?? (m.type === "area" ? "polygon" : "polyline")); setCalibratedScale(m.scale); }}>Inspecionar e gerar nova revisão</button>}</p>)}</>}
  </fieldset>;
}
