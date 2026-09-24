import { KeySearch } from "./[key]/KeySearch";

export default function PublicoHome() {
  return (
    <div>
      <h1>Consulta pública</h1>
      <div className="card">
        <p>
          Acompanhe documentos e protocolos por QR Code ou chave pública. Dados pessoais
          aparecem mascarados, conforme a LGPD.
        </p>
        <KeySearch />
      </div>
    </div>
  );
}
