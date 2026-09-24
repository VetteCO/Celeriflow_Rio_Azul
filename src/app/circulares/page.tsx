"use client";
// POC-06 — lista de circulares com placar de leitura.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useSession } from "@/components/session";

type Cir = {
  id: string;
  displayNumber: string;
  subject: string;
  urgency: string | null;
  status: string;
  createdAt: string;
  total: number;
  read: number;
  unread: number;
};

export default function CircularesPage() {
  const { user, role } = useSession();
  const [items, setItems] = useState<Cir[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api("/api/circulars")
      .then((d) => setItems(d.circulars))
      .catch((e) => setErr((e as Error).message));
  }, [user]);

  if (user === undefined) return <p role="status">Carregando…</p>;
  if (!user)
    return (
      <p>
        Faça login em <Link href="/admin">/admin</Link>.
      </p>
    );

  return (
    <div>
      <h1>Circulares</h1>
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}
      {role === "ADMIN_GERAL" && (
        <p>
          <Link href="/circulares/nova" className="btn btn-primary">
            + Nova circular
          </Link>
        </p>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Número</th>
              <th scope="col">Assunto</th>
              <th scope="col">Tipo</th>
              <th scope="col">Lidos</th>
              <th scope="col">Não lidos</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/circulares/${c.id}`}>{c.displayNumber}</Link>
                </td>
                <td>{c.subject}</td>
                <td>
                  <span className={`badge ${c.urgency === "URGENT" ? "badge-IN_TRANSIT" : "badge-DRAFT"}`}>
                    {c.urgency === "URGENT" ? "Urgente" : "Informativa"}
                  </span>
                </td>
                <td>{c.read}/{c.total}</td>
                <td>{c.unread > 0 ? <strong>{c.unread}</strong> : "0"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhuma circular ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
