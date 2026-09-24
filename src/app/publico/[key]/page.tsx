import { maskCpfCnpj } from "@/lib/mask";

// POC-09: página pública sem auth, só DTO mascarado.
// TODO Fase 4: query por publicKey no Neon + QR + histórico limitado (POC-03/09).
export default function PublicoKey({ params }: { params: { key: string } }) {
  const exemplo = maskCpfCnpj("12345678901");
  return (
    <div>
      <h1>Consulta pública</h1>
      <div className="card">
        <p>
          Chave: <code translate="no">{params.key}</code>
        </p>
        <p>
          CPF/CNPJ (mascarado, LGPD): <strong>{exemplo}</strong>
        </p>
        <p className="muted">Fase 4: consulta real por chave/QR com dados limitados.</p>
      </div>
    </div>
  );
}
