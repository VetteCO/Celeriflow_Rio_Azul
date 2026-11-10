"use client";
// Editor rich text mínimo (sem dependências): negrito/itálico/sublinhado + listas.
// Guarda a seleção do texto para funcionar com mouse E teclado.
import { useEffect, useRef, useState } from "react";

export function RichText({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [insert, setInsert] = useState<"link" | "image" | "table" | null>(null);
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [error, setError] = useState("");
  const saved = useRef<Range | null>(null);

  // Update only external values; replacing HTML on every keystroke loses the caret.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
      saved.current = null;
    }
  }, [value]);

  useEffect(() => {
    function track() {
      const sel = window.getSelection();
      if (
        sel &&
        sel.rangeCount > 0 &&
        ref.current?.contains(sel.anchorNode ?? null)
      ) {
        saved.current = sel.getRangeAt(0).cloneRange();
      }
    }
    document.addEventListener("selectionchange", track);
    return () => document.removeEventListener("selectionchange", track);
  }, []);

   function activate(c: string, value?: string) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
     if (sel && saved.current && el.contains(saved.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
     document.execCommand(c, false, value);
    onChange(el.innerHTML);
  }

  return (
    <div ref={wrapper} className="rich-text-editor">
      <div className="rt-toolbar" role="toolbar" aria-label="Formatação">
        {(
          [
            { c: "bold", label: "Negrito", glyph: "N" },
            { c: "italic", label: "Itálico", glyph: "I" },
             { c: "underline", label: "Sublinhado", glyph: "S" },
             { c: "undo", label: "Desfazer", glyph: "Desfazer" },
             { c: "redo", label: "Refazer", glyph: "Refazer" },
             { c: "justifyLeft", label: "Alinhar à esquerda", glyph: "Esquerda" },
             { c: "justifyCenter", label: "Centralizar", glyph: "Centro" },
             { c: "justifyRight", label: "Alinhar à direita", glyph: "Direita" },
             { c: "removeFormat", label: "Limpar formatação", glyph: "Limpar" },
          ] as const
        ).map(({ c, label, glyph }) => (
          <button
            key={c}
            type="button"
            className="btn"
            aria-label={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => activate(c)}
          >
            {glyph}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          aria-label="Lista com marcadores"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => activate("insertUnorderedList")}
        >
          • lista
        </button>
        <button
          type="button"
          className="btn"
          aria-label="Lista numerada"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => activate("insertOrderedList")}
        >
          1. lista
        </button>
        <button type="button" className="btn" onMouseDown={e => e.preventDefault()} onClick={() => { setInsert("link"); setUrl(""); setError(""); }}>Link</button>
        <button type="button" className="btn" onMouseDown={e => e.preventDefault()} onClick={() => { setInsert("image"); setUrl(""); setError(""); }}>Imagem</button>
        <button type="button" className="btn" onMouseDown={e => e.preventDefault()} onClick={() => { setInsert("table"); setError(""); }}>Tabela</button>
        <button type="button" className="btn" onClick={() => { if (document.fullscreenElement === wrapper.current) void document.exitFullscreen(); else void wrapper.current?.requestFullscreen().catch(() => setError("O navegador não permitiu a tela cheia.")); }}>Tela cheia</button>
      </div>
      {insert && <div className="rt-insert-panel">
        {insert === "table" ? <><label>Linhas<input type="number" min={1} max={30} value={rows} onChange={e => setRows(Number(e.target.value))} /></label><label>Colunas<input type="number" min={1} max={10} value={columns} onChange={e => setColumns(Number(e.target.value))} /></label></> : <label>{insert === "image" ? "Endereço HTTPS da imagem" : "Endereço do link"}<input type="url" value={url} placeholder="https://" onChange={e => setUrl(e.target.value)} /></label>}
        <button type="button" className="btn" onClick={() => {
          if (insert === "table") {
            if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || rows > 30 || columns < 1 || columns > 10) { setError("Informe de 1 a 30 linhas e de 1 a 10 colunas."); return; }
            activate("insertHTML", `<table><tbody>${Array.from({ length: rows }, () => `<tr>${Array.from({ length: columns }, () => "<td><br></td>").join("")}</tr>`).join("")}</tbody></table><p><br></p>`);
          } else {
            try { const parsed = new URL(url); if (!(insert === "image" ? ["https:"] : ["http:", "https:", "mailto:"]).includes(parsed.protocol)) throw new Error(); } catch { setError("Informe um endereço válido com o protocolo permitido."); return; }
            activate(insert === "image" ? "insertImage" : "createLink", url);
          }
          setInsert(null); setError("");
        }}>Inserir</button><button type="button" className="btn" onClick={() => { setInsert(null); setError(""); }}>Cancelar</button>
      </div>}
      {error && <p role="alert">{error}</p>}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
         aria-label="Conteúdo do documento"
         onPaste={(event) => {
           event.preventDefault();
           document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
           onChange(ref.current?.innerHTML ?? "");
         }}
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className="rt-area"
      />
    </div>
  );
}
