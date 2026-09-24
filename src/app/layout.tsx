export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <header style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
          <strong>Celeriflow Rio Azul</strong> — POC Pregão 60/2026
          <nav style={{ display: "inline", marginLeft: 16, fontSize: 14 }}>
            <a href="/admin" style={{ marginRight: 12 }}>Admin</a>
            <a href="/documentos" style={{ marginRight: 12 }}>Memorandos</a>
            <a href="/cidadao" style={{ marginRight: 12 }}>Cidadão</a>
          </nav>
        </header>
        <main style={{ padding: 16 }}>{children}</main>
      </body>
    </html>
  );
}
