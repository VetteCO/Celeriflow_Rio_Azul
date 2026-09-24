"use client";
// POC-04 — lista de memorandos + acesso ao novo.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";

type Doc = {
  id: string;
  type: string;
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

  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user)
    return (
      <div className="card">
        <h1>Documentos</h1>
        <p>
          Faça login em <Link href="/admin">/admin</Link> para ver os documentos.
        </p>
      </div>
    );

  return (
    <div>
      <h1>Documentos</h1>
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}
      {canCreate && (
        <p>
          <Link href="/documentos/novo" className="btn btn-primary">
            + Novo memorando
          </Link>
        </p>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Número</th>
              <th scope="col">Tipo</th>
              <th scope="col">Assunto</th>
              <th scope="col">Status</th>
              <th scope="col">Origem</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/documentos/${d.id}`}>{d.displayNumber}</Link>
                </td>
                <td>{d.type === "OFICIO" ? "Ofício" : "Memorando"}</td>
                <td>{d.subject}</td>
                <td>
                  <span className={`badge badge-${d.status}`}>{d.status}</span>
                </td>
                <td>{d.origin}</td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum documento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
