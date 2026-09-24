export default function Home() {
  return (
    <div>
      <h1>POC — 9 requisitos</h1>
      <ul>
        <li><a href="/admin">Área interna (admin/servidor)</a></li>
        <li><a href="/cidadao">Área externa (cidadão)</a></li>
        <li><a href="/publico/TESTE">Consulta pública (QR/chave)</a></li>
      </ul>
      <p>Health: <a href="/api/health">/api/health</a></p>
    </div>
  );
}
