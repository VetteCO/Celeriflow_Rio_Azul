import Link from "next/link";
import { families } from "@/lib/modules/domain";
export default function GestaoPage() {
  return <section><h1>Gestão municipal</h1><p>Documentos, atendimento e território.</p><div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>{Object.entries(families).map(([key, name]) => <Link className="card" href={`/gestao/${key}`} key={key}>{name}</Link>)}</div><p><Link href="/gestao/central">Central de atendimento</Link> · <Link href="/gestao/anonimo">Ouvidoria sem identificação</Link> · <Link href="/gestao/classificacao/lote">Classificação hierárquica e em lote</Link> · <Link href="/gestao/expediente">Expediente por setor</Link> · <Link href="/gestao/diario/catalogo">Catálogo e organização do Diário</Link> · <Link href="/gestao/servicos">Consultar Carta de Serviços</Link> · <Link href="/gestao/edicoes">Edições públicas</Link> · <Link href="/gestao/geoportal">Geoportal</Link></p></section>;
}
