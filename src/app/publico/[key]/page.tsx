import QRCode from "qrcode";
import { headers } from "next/headers";
import { KeySearch } from "./KeySearch";
import { publicDocument } from "@/lib/public-document";

const statuses: Record<string, string> = { DRAFT: "Rascunho", OPEN: "Aberto", IN_TRANSIT: "Em tramitação", CONCLUDED: "Concluído", ARCHIVED: "Arquivado" };
const actions: Record<string, string> = { CREATED: "Registrado", FORWARDED: "Encaminhado", RECEIVED: "Recebido", CONCLUDED: "Concluído", ARCHIVED: "Arquivado", REOPENED: "Reaberto", CITIZEN_REPLY: "Resposta registrada", CITIZEN_COMPLEMENT: "Complementação recebida", EMAIL_INBOUND: "Correspondência recebida" };

// POC-09: página pública sem auth. Dados via DTO interno (mesma projeção
// limitada da API): sem corpo, sem anexos, CPF mascarado, histórico resumido.
async function fetchPublic(key: string) {
  return publicDocument(key);
}

export default async function PublicoKey({ params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  const data = await fetchPublic(params.key).catch(() => undefined);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
   const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, "");
   const url = `${base}/publico/${encodeURIComponent(params.key)}`;
  const qr = await QRCode.toDataURL(url, { width: 220, margin: 1 }).catch(() => null);

  return (
    <div>
      <h1>Consulta pública</h1>
      <div className="card">
        <KeySearch current={params.key} />
      </div>
      {data === null && (
        <p className="alert alert-error" role="alert">
           Consulta indisponível para esta chave. Confira o código ou procure o atendimento responsável.
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
              <span className={`badge badge-${data.status}`}>{statuses[data.status] ?? data.status}</span>{" "}
              <span className="muted">
                Criado em {new Date(data.createdAt).toLocaleString("pt-BR")}
              </span>
            </p>
            {data.citizenCpf && (
              <p>
                 CPF/CNPJ protegido: <strong>{data.citizenCpf}</strong>
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
             {data.history.map((ev, i) => (
              <li key={i}>
                <span className="t-action">{actions[ev.action] ?? "Andamento registrado"}</span>
                 <div className="t-meta">{new Date(ev.at).toLocaleString("pt-BR")}</div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
