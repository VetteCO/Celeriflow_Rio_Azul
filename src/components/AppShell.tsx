"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/components/session";

const links = [
  ["/", "Início", "M3 10 12 3l9 7v11h-6v-7H9v7H3Z"],
  ["/admin", "Administração", "M4 21v-5h16v5M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0"],
  ["/setores", "Organograma", "M9 3h6v5H9ZM3 16h6v5H3Zm12 0h6v5h-6ZM12 8v4M6 16v-4h12v4"],
  ["/documentos", "Documentos", "M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h8"],
  ["/circulares", "Circulares", "M3 9h5l12-5v16L8 15H3ZM8 15l2 6"],
  ["/calendario", "Calendário", "M3 5h18v16H3ZM7 2v6M17 2v6M3 10h18"],
  ["/processamento", "Processamento", "M12 3a9 9 0 1 1-9 9M3 3v6h6M12 7v5l3 3"],
  ["/gestao", "Gestão municipal", "M3 21h18M5 21V9h14v12M3 9l9-6 9 6ZM9 12v6M15 12v6"],
  ["/operacao", "Gestão e serviços", "M3 21V3M3 21h18M7 18v-7M12 18V6M17 18V9"],
  ["/cidadao", "Atendimento", "M4 4h16v12H9l-5 5ZM8 8h8M8 12h6"],
  ["/publico", "Consulta pública", "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6"],
  ["/ajuda", "Ajuda", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17v1"],
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, role } = useSession();
  const visibleLinks = links.filter(([href]) => role || ["/", "/cidadao", "/publico", "/ajuda"].includes(href));
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => setExpanded(pathname === "/"), [pathname]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape" && expanded && !e.defaultPrevented && !document.querySelector("dialog[open]")) { setExpanded(false); toggle.current?.focus(); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);
  return <div className={`app-shell ${expanded ? "nav-expanded" : "nav-collapsed"}`}>
    <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
    <header className="app-header"><button ref={toggle} className="nav-toggle" aria-label={expanded ? "Recolher menu" : "Expandir menu"} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg></button><Link href="/" className="app-brand">Celeriflow</Link><span className="app-description">Gestão municipal</span><Link className="app-account" href={user && !role ? "/cidadao/conta" : "/admin"}>{user ? "Minha conta" : "Acesso institucional"}</Link></header>
    {expanded && <button className="nav-backdrop" aria-label="Recolher navegação" onClick={() => { setExpanded(false); toggle.current?.focus(); }} />}
    <aside className="app-sidebar"><nav aria-label="Navegação principal">{visibleLinks.map(([href, label, icon]) => <Link key={href} href={href} title={label} aria-label={label} aria-current={(href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "page" : undefined}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon} /></svg><span>{label}</span></Link>)}</nav></aside>
    <main id="conteudo" className="app-content">{children}</main>
  </div>;
}
