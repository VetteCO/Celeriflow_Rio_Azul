import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <header className="topbar">
          <div className="topbar-inner">
            <div>
              <div className="mark">Celeriflow Rio Azul</div>
              <div className="sub">Prefeitura Municipal de Rio Azul · PR — POC Pregão 60/2026</div>
            </div>
            <nav className="tabs" aria-label="Seções">
              <a href="/">Início</a>
              <a href="/admin">Administração</a>
              <a href="/documentos">Documentos</a>
              <a href="/circulares">Circulares</a>
              <a href="/cidadao">Cidadão</a>
            </nav>
          </div>
        </header>
        <main id="conteudo" className="container">{children}</main>
        <footer className="footer">
          Prefeitura Municipal de Rio Azul · PR — Gestão Eletrônica de Documentos · LGPD: dados
          pessoais protegidos na consulta pública
        </footer>
      </body>
    </html>
  );
}
