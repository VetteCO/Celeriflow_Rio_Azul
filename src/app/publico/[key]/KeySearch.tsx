"use client";
// Busca manual por chave pública (POC-09): navega para /publico/[chave].
import { useState } from "react";
import { useRouter } from "next/navigation";

export function KeySearch({ current }: { current?: string }) {
  const [key, setKey] = useState(current ?? "");
  const router = useRouter();
  return (
    <form
      className="form-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim()) router.push(`/publico/${encodeURIComponent(key.trim())}`);
      }}
    >
      <input
        style={{ flex: 2 }}
        placeholder="digite a chave pública"
        aria-label="Chave pública para consulta"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <button type="submit" className="btn btn-primary">
        Consultar
      </button>
    </form>
  );
}
