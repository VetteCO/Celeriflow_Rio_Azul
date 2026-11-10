import Link from "next/link";

// Mesa de trabalho: módulos do sistema em linguagem de produto.
const MODULES = [
  { titulo: "Gestão municipal", desc: "Processos, serviços, modelos e atendimento integrado.", href: "/gestao", cta: "Acessar gestão" },
  { titulo: "Gestão e serviços", desc: "Indicadores, capacitação e acompanhamento do suporte.", href: "/operacao", cta: "Acessar serviços" },
  { titulo: "Calendário", desc: "Prazos e atividades vinculados aos documentos do setor.", href: "/calendario", cta: "Consultar calendário" },
  {
    titulo: "Documentos",
    desc: "Memorandos e ofícios: elaborar, numerar, tramitar e acompanhar.",
    href: "/documentos",
    cta: "Abrir documentos",
  },
  {
    titulo: "Circulares",
    desc: "Comunicados urgentes e informativos com confirmação de leitura.",
    href: "/circulares",
    cta: "Abrir circulares",
  },
  {
    titulo: "Portal do cidadão",
    desc: "Receber requerimentos externos com protocolo e acompanhamento.",
    href: "/cidadao",
    cta: "Abrir portal",
  },
  {
    titulo: "Consulta pública",
    desc: "Acompanhar documentos por QR Code ou chave pública, com sigilo LGPD.",
    href: "/publico",
    cta: "Consultar",
  },
  {
    titulo: "Administração",
    desc: "Usuários, setores e níveis de acesso do sistema.",
    href: "/admin",
    cta: "Administrar",
  },
];

export default function Home() {
  return (
    <div>
      <h1>Mesa de trabalho</h1>
      <p className="muted">
        Gestão eletrônica de documentos, tramitação e
        atendimento ao cidadão.
      </p>
      <div className="grid-3">
        {MODULES.map((m) => (
          <div key={m.titulo} className="card plain">
            <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>{m.titulo}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {m.desc}
            </p>
            <Link href={m.href} className="btn" aria-label={`${m.cta} — ${m.titulo}`}>
              {m.cta} →
            </Link>
          </div>
        ))}
      </div>
      <div className="card">
        <strong>Ações rápidas</strong>
        <div className="form-row" style={{ marginTop: 8 }}>
          <Link href="/documentos/novo" className="btn btn-primary">
            Novo documento
          </Link>
          <Link href="/circulares/nova" className="btn">
            Nova circular
          </Link>
          <Link href="/cidadao" className="btn">
            Novo requerimento
          </Link>
        </div>
      </div>
    </div>
  );
}
