import Link from "next/link";

export default function NotFound() {
  return <section className="card"><h1>Página não encontrada</h1><p>Confira o endereço ou use o menu para localizar o serviço desejado.</p><Link className="btn btn-primary" href="/">Ir para a mesa de trabalho</Link></section>;
}
