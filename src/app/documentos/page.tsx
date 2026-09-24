"use client";
// POC-04 — lista de memorandos + acesso ao novo.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";

type Doc = {
  id: string;
  displayNumber: string;
  subject: string;
  status: string;
  origin: string;
  createdAt: string;
};

export default function DocumentosPage() {
  const { user, role } = useSession();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const canCreate = role === "ADMIN_GERAL";

  useEffect(() => {
    if (user === undefined) return;
    if (!user) return;
    api("/api/documents")
      .then((d) => setDocs(d.documents))
      .catch((e) => setErr((e as Error).message));
  }, [user]);

  if (user === undefined) return <p>Carregando…</p>;
  if (!user) return <p>Faça login em <Link href="/admin">/admin</Link> para ver os memorandos.</p>;

  return (
    <div style={{ maxWidth: 860 }}>
      <h2>Memorandos (POC-04/05)</h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {canCreate && (
        <p>
          <Link href="/documentos/novo">
            <button>+ Novo memorando</button>
          </Link>
        </p>
      )}
      <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
            <th>Número</th>
            <th>Assunto</th>
            <th>Status</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>
                <Link href={`/documentos/${d.id}`}>{d.displayNumber}</Link>
              </td>
              <td>{d.subject}</td>
              <td>{d.status}</td>
              <td>{d.origin}</td>
            </tr>
          ))}
          {docs.length === 0 && (
            <tr>
              <td colSpan={4}>Nenhum memorando ainda.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
