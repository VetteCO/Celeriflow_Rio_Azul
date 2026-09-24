import QRCode from "qrcode";
import { headers } from "next/headers";
import { KeySearch } from "./KeySearch";

// POC-09: página pública sem auth. Dados via DTO interno (mesma projeção
// limitada da API): sem corpo, sem anexos, CPF mascarado, histórico resumido.
async function fetchPublic(key: string) {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;
  const r = await fetch(`${base}/api/publico/${encodeURIComponent(key)}`, {
    cache: "no-store",
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`public_${r.status}`);
  return r.json();
}

export default async function PublicoKey({ params }: { params: { key: string } }) {
  const data = await fetchPublic(params.key).catch(() => undefined);

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/publico/${encodeURIComponent(params.key)}`;
  const qr = await QRCode.toDataURL(url, { width: 220, margin: 1 }).catch(() => null);

  return (
    <div>
      <h1>Consulta pública</h1>
      <div className="card">
        <KeySearch current={params.key} />
      </div>
      {data === null && (
        <p className="alert alert-error" role="alert">
          Chave inválida — confira o código do protocolo ou leia o QR novamente.
        </p>
      )}
      {data === undefined && (
        <p className="alert alert-error" role="alert">
          Falha ao consultar. Tente novamente.
        </p>
      )}
      {data && (
        <>
          <div className="card">
            <p>
              <strong>{data.displayNumber}</strong>{" "}
              {data.protocolNumber && <>· Protocolo {data.protocolNumber}</>}
            </p>
            <p>{data.subject}</p>
            <p>
              <span className={`badge badge-${data.status}`}>{data.status}</span>{" "}
              <span className="muted">
                Criado em {new Date(data.createdAt).toLocaleString("pt-BR")}
              </span>
            </p>
            {data.citizenCpf && (
              <p>
                CPF/CNPJ (LGPD, mascarado): <strong>{data.citizenCpf}</strong>
              </p>
            )}
          </div>
          <div className="card plain">
            <h2 style={{ fontSize: 18 }}>QR Code desta consulta</h2>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR Code para ${url}`} width={220} height={220} />
            ) : (
              <p className="muted">QR indisponível.</p>
            )}
            <p className="muted">
              Leia com a câmera do celular para abrir esta mesma página.
            </p>
          </div>
          <h2>Andamento</h2>
          <ol className="timeline">
            {data.history.map((ev: { action: string; at: string }, i: number) => (
              <li key={i}>
                <span className="t-action">{ev.action}</span>
                <div className="t-meta">{new Date(ev.at).toLocaleString("pt-BR")}</div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
