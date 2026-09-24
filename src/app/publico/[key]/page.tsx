import { maskCpfCnpj } from "@/lib/mask";

// POC-09: página pública sem auth, só DTO mascarado.
// TODO: buscar document/externalRequest por publicKey no Neon.
export default function PublicoKey({ params }: { params: { key: string } }) {
  const exemplo = maskCpfCnpj("12345678901");
  return (
    <div>
      <h2>Consulta pública</h2>
      <p>Chave: {params.key}</p>
      <p>CPF/CNPJ (mascarado): {exemplo}</p>
      <p>TODO Fase 4: query real + QR + status/histórico limitado (POC-03/09).</p>
    </div>
  );
}
