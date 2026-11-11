"use client";
import { useEffect, useState } from "react";
import { getToken } from "@/components/session";
export function PdfPreview({ id, revision }: { id: string; revision: number }) {
  const [url, setUrl] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    let stopped = false, objectUrl = ""; const controller = new AbortController();
    void (async () => {
      const token = await getToken(); const response = await fetch(`/api/modules/records/${id}/export?inline=1`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal });
      if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível gerar a prévia.");
      const blob = await response.blob(); if (stopped) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    })().catch(e => { if (!stopped) setError(e.message); });
    return () => { stopped = true; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, revision]);
  return <section><h2>Pré-visualização do PDF</h2>{error ? <p role="alert">{error}</p> : url ? <><p><a href={url} target="_blank" rel="noopener noreferrer">Abrir PDF em outra aba</a></p><iframe title="Prévia do documento em PDF" src={url} style={{ width: "100%", height: "70vh", border: "1px solid #ccc" }} /></> : <p role="status">Gerando prévia…</p>}</section>;
}
