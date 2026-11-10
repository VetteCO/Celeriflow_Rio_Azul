import Link from "next/link";
import { ReportNotice } from './report-notice';
export default function Layout({children}:{children:React.ReactNode}){
 return <section><nav aria-label="Gestão e operação" style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:8}}>
  <Link href="/operacao">Relatórios</Link><Link href="/operacao/contratos">Contratos</Link><Link href="/operacao/delegacoes">Delegações</Link><Link href="/operacao/mapa">Mapa</Link><Link href="/operacao/ead">Capacitação</Link><Link href="/operacao/suporte">Suporte</Link><Link href="/operacao/auditoria">Auditoria</Link><Link href="/operacao/continuidade">Continuidade</Link>
  <ReportNotice/></nav>{children}</section>;
}
