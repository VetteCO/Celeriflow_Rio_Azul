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
              <a href="/admin">Admin</a>
              <a href="/documentos">Memorandos</a>
              <a href="/circulares">Circulares</a>
              <a href="/cidadao">Cidadão</a>
            </nav>
          </div>
        </header>
        <main id="conteudo" className="container">{children}</main>
        <footer className="footer">
          Ambiente de demonstração da POC — dados fictícios · LGPD: documentos pessoais mascarados
          na consulta pública
        </footer>
      </body>
    </html>
  );
}
