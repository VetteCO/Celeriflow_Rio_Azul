export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <header style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
          <strong>Celeriflow Rio Azul</strong> — POC Pregão 60/2026
        </header>
        <main style={{ padding: 16 }}>{children}</main>
      </body>
    </html>
  );
}
