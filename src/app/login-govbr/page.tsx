import Link from "next/link";
export default function LoginGovbr() {
  return <section className="card"><h1>Acesso com Gov.br</h1><p>O acesso com Gov.br está indisponível no momento. Utilize suas credenciais institucionais para entrar no sistema.</p><Link className="btn btn-primary" href="/admin">Acesso institucional</Link><Link className="btn" href="/cidadao">Portal do cidadão</Link></section>;
}
