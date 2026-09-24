"use client";
// Editor rich text mínimo (sem dependências): negrito/itálico/sublinhado + listas.
import { useRef } from "react";

export function RichText({
  value,
  onChange,
  minHeight = 160,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function cmd(c: string) {
    document.execCommand(c, false);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? "");
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {(["bold", "italic", "underline"] as const).map((c) => (
          <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); cmd(c); }}>
            {c === "bold" ? "N" : c === "italic" ? "I" : "S"}
          </button>
        ))}
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("insertUnorderedList"); }}>• lista</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("insertOrderedList"); }}>1. lista</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        dangerouslySetInnerHTML={{ __html: value }}
        style={{
          border: "1px solid #999",
          padding: 8,
          minHeight,
          background: "#fff",
        }}
      />
    </div>
  );
}
