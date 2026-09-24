import Link from "next/link";

// Painel objetivo: 9 requisitos da POC com situação atual.
const ITEMS: Array<{ poc: string; titulo: string; status: "Pronto" | "Em obra" | "Planejado"; href: string }> = [
  { poc: "POC-01", titulo: "Usuários e níveis de acesso", status: "Pronto", href: "/admin" },
  { poc: "POC-02", titulo: "Login Gov.br / ICP-Brasil", status: "Planejado", href: "/admin" },
  { poc: "POC-03", titulo: "Mascaramento LGPD", status: "Pronto", href: "/publico/TESTE" },
  { poc: "POC-04", titulo: "Abertura de memorando", status: "Pronto", href: "/documentos/novo" },
  { poc: "POC-05", titulo: "Tramitação e linha do tempo", status: "Pronto", href: "/documentos" },
  { poc: "POC-06", titulo: "Circular + leitura individual", status: "Pronto", href: "/circulares" },
  { poc: "POC-07", titulo: "Portal do cidadão + CEP", status: "Pronto", href: "/cidadao" },
  { poc: "POC-08", titulo: "Resposta por e-mail automática", status: "Pronto", href: "/documentos" },
  { poc: "POC-09", titulo: "Consulta pública por QR/chave", status: "Pronto", href: "/publico/TESTE" },
];

const BADGE: Record<string, string> = {
  Pronto: "badge-OPEN",
  "Em obra": "badge-IN_TRANSIT",
  Planejado: "badge-DRAFT",
};

export default function Home() {
  return (
    <div>
      <h1>Painel da POC — 9 requisitos</h1>
      <p className="muted">
        Demonstração ao vivo em até 2h. Verde = demonstrável agora; o resto segue o plano Fase a
        Fase.
      </p>
      <div className="grid-3">
        {ITEMS.map((i) => (
          <div key={i.poc} className="card plain">
            <span className={`badge ${BADGE[i.status]}`}>{i.status}</span>
            <h2 style={{ fontSize: 20, margin: "8px 0 4px" }}>
              {i.poc} — {i.titulo}
            </h2>
            <Link href={i.href} aria-label={`Abrir ${i.poc} — ${i.titulo}`}>
              Abrir →
            </Link>
          </div>
        ))}
      </div>
      <div className="card">
        <strong>Atalhos operacionais</strong>
        <div className="form-row" style={{ marginTop: 8 }}>
          <Link href="/documentos/novo" className="btn btn-primary">
            Novo memorando
          </Link>
          <Link href="/admin" className="btn">
            Gerir usuários
          </Link>
          <Link href="/cidadao" className="btn">
            Área do cidadão
          </Link>
        </div>
      </div>
    </div>
  );
}
