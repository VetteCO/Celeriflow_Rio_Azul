"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { useSession } from "@/components/session";

export const PAGE_SIZE = 20;
export type TableColumn<T> = {
  key: string; label: string; value: (row: T) => string | number;
  sortValue?: (row: T) => string | number;
  render?: (row: T) => ReactNode; minWidth?: number; width?: number; align?: "left" | "right" | "center";
};
type Props<T> = { id: string; title: string; rows: T[]; columns: TableColumn<T>[]; rowKey: (row: T) => string; actions?: ReactNode; loading?: boolean; error?: string | null; filters?: ReactNode; pagination?: { page: number; total: number; onPageChange: (page: number) => void }; onSearch?: (query: string) => void; onSort?: (sort: { key: string; desc: boolean }) => void };

function DetailCell({ text, children, context, interactive = false }: { text: string; children: ReactNode; context: string; interactive?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [interactiveContent, setInteractiveContent] = useState(false);
  const [part, setPart] = useState(0);
  const [blocks, setBlocks] = useState<string[]>([text]);
  function openDetails() {
    setPart(0);
    const probe = document.createElement("div");
    Object.assign(probe.style, { position: "fixed", visibility: "hidden", left: "0", top: "0", width: `${Math.min(560, window.innerWidth - 32) - 42}px`, fontSize: "14px", lineHeight: "21px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
    document.body.appendChild(probe);
    const limit = Math.max(21, window.innerHeight - 240);
    const pages: string[] = [];
    let remaining = text;
    while (remaining.length) {
      let low = 1, high = remaining.length, best = 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        probe.textContent = remaining.slice(0, middle);
        if (probe.getBoundingClientRect().height <= limit) { best = middle; low = middle + 1; } else high = middle - 1;
      }
      pages.push(remaining.slice(0, best)); remaining = remaining.slice(best);
    }
    probe.remove();
    setBlocks(pages.length ? pages : ["—"]);
    dialog.current?.showModal();
  }
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setOverflow(el.scrollWidth > (el.parentElement?.clientWidth ?? el.clientWidth));
      setInteractiveContent(!!el.querySelector("a,button,input,select,textarea,[role=button]"));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el); measure();
    document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [text, children]);
  return <div className="grid-cell-content"><span className="grid-cell-preview" ref={ref}>{children}</span>{overflow && <button ref={button} className="grid-details" aria-label={`Ver ${context}`} onClick={openDetails}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v7M12 6v1" /></svg></button>}
    <dialog ref={dialog} className="grid-dialog" aria-label={context} onClose={() => button.current?.focus()}><h2>{context}</h2>{interactive || interactiveContent ? <div className="grid-detail-actions">{children}</div> : <p className="grid-detail-text" aria-live="polite">{blocks[part]}</p>}<div className="grid-dialog-controls">{!interactive && !interactiveContent && <><button onClick={() => setPart(part - 1)} disabled={!part}>Anterior</button><span aria-live="polite">{part + 1} / {blocks.length}</span><button onClick={() => setPart(part + 1)} disabled={part === blocks.length - 1}>Próximo</button><button onClick={() => navigator.clipboard.writeText(text)}>Copiar tudo</button></>}<button autoFocus onClick={() => dialog.current?.close()}>Fechar</button></div></dialog>
  </div>;
}

export function DataTable<T>({ id, title, rows, columns, rowKey, actions, loading, error, filters, pagination, onSearch, onSort }: Props<T>) {
  const { user } = useSession();
  const container = useRef<HTMLDivElement>(null);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const [width, setWidth] = useState(1000);
  const [weights, setWeights] = useState<number[]>([]);
  const [mobile, setMobile] = useState(false);
  const [height, setHeight] = useState(700);
  const preferenceKey = user ? `celeriflow:columns:${user.uid}:${id}` : null;
  useEffect(() => {
    setWeights([]);
    if (!preferenceKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? "null");
      if (Array.isArray(saved) && saved.length === columns.length && saved.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)) setWeights(saved);
    } catch { /* Storage may be disabled by browser policy. */ }
  }, [preferenceKey, columns.length]);
  function saveWeights(next: number[]) {
    setWeights(next);
    if (preferenceKey) {
      try { localStorage.setItem(preferenceKey, JSON.stringify(next)); } catch { /* Widths remain available in this session. */ }
    }
  }
  useEffect(() => {
    // A narrow window alone never enables the mobile/tablet scrolling exception.
    const ua = navigator.userAgent;
    const touchDevice = /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setMobile(touchDevice);
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const main = el.closest("main");
      const bottom = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0 : 6;
      setWidth(el.clientWidth); setHeight(window.innerHeight - el.getBoundingClientRect().top - bottom);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.parentElement) observer.observe(el.parentElement);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const minimums = columns.map(c => c.minWidth ?? 80);
  const totalMinimum = minimums.reduce((a, b) => a + b, 0);
  const available = Math.max(width - 2, mobile ? totalMinimum : 0);
  const hasWeights = weights.some(n => n > 0);
  const basis = columns.map((c, i) => hasWeights ? weights[i] ?? c.width ?? 150 : c.width ?? 150);
  const basisTotal = basis.reduce((a, b) => a + b, 0) || 1;
  const surplus = Math.max(0, available - totalMinimum);
  const sizes = minimums.map((min, i) => min + surplus * basis[i] / basisTotal);
  const conflict = !mobile && (available < totalMinimum || height < 594);
  const filtered = useMemo(() => {
    if (pagination) return rows;
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const result = rows.filter(row => !needle || columns.some(c => String(c.value(row) ?? "").toLocaleLowerCase("pt-BR").includes(needle)));
    const col = columns.find(c => c.key === sort?.key);
    if (!col) return result;
    return [...result].sort((a, b) => {
      const normalize = (value: string | number | undefined) => {
        if (typeof value !== "string") return value;
        const date = /^(\d{2})\/(\d{2})\/(\d{4})(?:[, ]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
        return date ? Date.UTC(Number(date[3]), Number(date[2]) - 1, Number(date[1]), Number(date[4] ?? 0), Number(date[5] ?? 0), Number(date[6] ?? 0)) : value;
      };
      const av = normalize(col?.sortValue ? col.sortValue(a) : col?.value(a)), bv = normalize(col?.sortValue ? col.sortValue(b) : col?.value(b));
      const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR", { numeric: true });
      return (sort?.desc ? -comparison : comparison) || rowKey(a).localeCompare(rowKey(b));
    });
  }, [rows, columns, query, sort, rowKey, pagination]);
  const total = pagination?.total ?? filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(pagination?.page ?? page, pages);
  const visible = pagination ? filtered : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const changePage = (next: number) => pagination ? pagination.onPageChange(next) : setPage(next);
  function changeSort(key: string) {
    const next = { key, desc: sort?.key === key ? !sort.desc : false };
    setSort(next); changePage(1); onSort?.(next);
  }
  function resize(index: number, delta: number) {
    const next = index + 1 < columns.length ? index + 1 : index - 1;
    if (next < 0) return;
    const change = Math.max(minimums[index] - sizes[index], Math.min(delta, sizes[next] - minimums[next]));
    const result = sizes.map((s, i) => Math.max(0, s - minimums[i]));
    result[index] += change; result[next] -= change;
    saveWeights(result);
  }
  function drag(event: PointerEvent<HTMLButtonElement>, index: number) {
    event.preventDefault(); event.stopPropagation();
    const start = event.clientX;
    const control = event.currentTarget;
    control.setPointerCapture(event.pointerId);
    const move = (e: globalThis.PointerEvent) => resize(index, e.clientX - start);
    const stop = () => { control.removeEventListener("pointermove", move); control.removeEventListener("pointerup", stop); control.removeEventListener("pointercancel", stop); };
    control.addEventListener("pointermove", move); control.addEventListener("pointerup", stop); control.addEventListener("pointercancel", stop);
  }
  return <section ref={container} style={mobile ? undefined : { height: Math.max(594, height) }} className={`data-grid ${mobile ? "data-grid-touch" : "data-grid-desktop"}`} data-table-id={id}>
    <header className="grid-heading"><h1>{title}</h1><div className="grid-actions">{actions}</div></header>
    <div className="grid-toolbar"><label className="sr-only" htmlFor={`${id}-search`}>Pesquisar em {title}</label><input id={`${id}-search`} type="search" placeholder="Pesquisar registros" value={query} onChange={e => { setQuery(e.target.value); changePage(1); onSearch?.(e.target.value); }} />{filters && <button ref={filterButton} type="button" onClick={() => filterDialog.current?.showModal()}>Filtros</button>}<button type="button" onClick={() => saveWeights([])}>Restaurar colunas</button></div>
    {filters && <dialog ref={filterDialog} className="grid-dialog grid-filter-dialog" aria-label={`Filtros de ${title}`} onClose={() => filterButton.current?.focus()}><h2>Filtros</h2>{filters}<button type="button" onClick={() => filterDialog.current?.close()}>Voltar à listagem</button></dialog>}
    {conflict && <p className="grid-space-notice" role="status">Área disponível: {Math.round(width)} × {Math.round(height)} px. Esta grade precisa de pelo menos {totalMinimum + 2} × 594 px para exibir 20 linhas e todos os controles. Amplie a área da janela.</p>}
    <div className="grid-body"><table style={{ width: Math.max(available, totalMinimum) }}><colgroup>{columns.map((c, i) => <col key={c.key} style={{ width: sizes[i] }} />)}</colgroup><thead><tr>{columns.map((c, i) => <th key={c.key} scope="col" aria-sort={sort?.key === c.key ? sort.desc ? "descending" : "ascending" : "none"}><button className="grid-sort" onClick={() => changeSort(c.key)}>{c.label}{sort?.key === c.key ? sort.desc ? " ↓" : " ↑" : ""}</button>{columns.length > 1 && <button className="grid-resizer" aria-label={`Ajustar largura de ${c.label}`} onPointerDown={e => drag(e, i)} onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); resize(i, e.key === "ArrowLeft" ? -10 : 10); } }} />}</th>)}</tr></thead><tbody>
      {loading ? <tr><td colSpan={columns.length}>Carregando registros…</td></tr> : error ? <tr><td colSpan={columns.length} role="alert">{error}</td></tr> : !visible.length ? <tr><td colSpan={columns.length}>Nenhum registro encontrado.</td></tr> : visible.map(row => <tr key={rowKey(row)}>{columns.map(c => <td key={c.key} style={{ textAlign: c.align ?? "left" }}><DetailCell text={String(c.value(row) ?? "—")} context={`${c.label} — ${String(columns[0]?.value(row) ?? rowKey(row)).slice(0, 80)}`} interactive={!!c.render && /action|acoes|ações|acao|ação/i.test(c.key)}>{c.render ? c.render(row) : String(c.value(row) ?? "—")}</DetailCell></td>)}</tr>)}
    </tbody></table></div>
    <footer className="grid-pagination"><span>{total ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, total)} de {total} registros</span><div><button disabled={safePage === 1 || loading} onClick={() => changePage(1)} aria-label="Primeira página">«</button><button disabled={safePage === 1 || loading} onClick={() => changePage(safePage - 1)}>Anterior</button><span>{safePage} / {pages}</span><button disabled={safePage === pages || loading} onClick={() => changePage(safePage + 1)}>Próxima</button><button disabled={safePage === pages || loading} onClick={() => changePage(pages)} aria-label="Última página">»</button></div></footer>
  </section>;
}
