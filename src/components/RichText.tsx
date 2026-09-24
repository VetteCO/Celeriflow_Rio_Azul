"use client";
// Editor rich text mínimo (sem dependências): negrito/itálico/sublinhado + listas.
// Guarda a seleção do texto para funcionar com mouse E teclado.
import { useEffect, useRef } from "react";

export function RichText({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);

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

  function activate(c: string) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && saved.current) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
    document.execCommand(c, false);
    onChange(el.innerHTML);
  }

  return (
    <div>
      <div className="rt-toolbar" role="toolbar" aria-label="Formatação">
        {(
          [
            { c: "bold", label: "Negrito", glyph: "N" },
            { c: "italic", label: "Itálico", glyph: "I" },
            { c: "underline", label: "Sublinhado", glyph: "S" },
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
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Corpo do memorando"
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        dangerouslySetInnerHTML={{ __html: value }}
        className="rt-area"
      />
    </div>
  );
}
