"use client";
// POC-07 — portal do cidadão: cadastro + CEP automático + requerimento +
// protocolo/chave + acompanhamento.
import { useState } from "react";

type Addr = { street: string; district: string; city: string; state: string };
type Created = { protocolNumber: string; publicKey: string; emailStatus: string };
type Track = {
  protocolNumber: string;
  requestType: string;
  status: string;
  createdAt: string;
  citizen: { name: string; cpfCnpj: string };
  history: Array<{ action: string; note: string | null; at: string }>;
};

export default function CidadaoPage() {
  const [form, setForm] = useState({
    name: "",
    cpfCnpj: "",
    email: "",
    phone: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    requestType: "Solicitação de serviço",
    description: "",
  });
  const [cepState, setCepState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [trackKey, setTrackKey] = useState("");
  const [tracked, setTracked] = useState<Track | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function buscarCep() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      setErr("CEP deve ter 8 dígitos.");
      return;
    }
    setErr(null);
    setCepState("loading");
    try {
      const r = await fetch(`/api/cep?cep=${cep}`);
      const d = (await r.json()) as Addr & { error?: string };
      if (!r.ok) throw new Error(d.error ?? "falha na busca");
      setForm((f) => ({ ...f, street: d.street, district: d.district, city: d.city, state: d.state }));
      setCepState("ok");
    } catch (e) {
      setCepState("error");
      setErr((e as Error).message);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setErr(null);
    setSaving(true);
    try {
      const r = await fetch("/api/cidadao/requerimentos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = (await r.json()) as Created & { error?: string };
      if (!r.ok) throw new Error(d.error ?? `http_${r.status}`);
      setCreated(d);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function acompanhar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await fetch(`/api/cidadao/requerimentos?key=${encodeURIComponent(trackKey.trim())}`);
      const d = (await r.json()) as Track & { error?: string };
      if (!r.ok) throw new Error(d.error ?? `http_${r.status}`);
      setTracked(d);
    } catch (e) {
      setErr((e as Error).message);
      setTracked(null);
    }
  }

  if (created) {
    return (
      <div>
        <h1>Requerimento registrado</h1>
        <div className="card">
          <p>
            Protocolo: <strong>{created.protocolNumber}</strong>
          </p>
          <p>
            Chave de acompanhamento: <code translate="no">{created.publicKey}</code>
          </p>
          <p className="muted">
            {created.emailStatus === "SENT"
              ? "Confirmação enviada para o seu e-mail."
              : "Você receberá a confirmação no e-mail informado."}
          </p>
          <p>Guarde esses dois códigos — anote ou fotografe esta tela.</p>
        </div>
        <button className="btn" onClick={() => setCreated(null)}>
          Novo requerimento
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Portal do cidadão</h1>
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}
      <form onSubmit={enviar} className="form" style={{ maxWidth: 640 }}>
        <h2>Cadastro</h2>
        <div className="form-row">
          <label style={{ flex: 2 }}>
            Nome completo
            <input name="name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            CPF/CNPJ
            <input name="cpfCnpj" inputMode="numeric" value={form.cpfCnpj} onChange={(e) => set("cpfCnpj", e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label style={{ flex: 1 }}>
            E-mail
            <input type="email" name="email" spellCheck={false} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            Telefone
            <input name="phone" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label style={{ flex: 1 }}>
            CEP
            <input name="cep" inputMode="numeric" autoComplete="postal-code" value={form.cep} onChange={(e) => set("cep", e.target.value)} />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="button" className="btn" onClick={buscarCep} disabled={cepState === "loading"}>
              {cepState === "loading" ? "Buscando…" : "Buscar endereço"}
            </button>
          </div>
        </div>
        <div className="form-row">
          <label style={{ flex: 3 }}>
            Logradouro
            <input value={form.street} onChange={(e) => set("street", e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            Número
            <input value={form.number} onChange={(e) => set("number", e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label style={{ flex: 1 }}>
            Complemento
            <input value={form.complement} onChange={(e) => set("complement", e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            Bairro
            <input value={form.district} onChange={(e) => set("district", e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label style={{ flex: 3 }}>
            Cidade
            <input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            UF
            <input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
          </label>
        </div>

        <h2>Requerimento</h2>
        <label>
          Tipo
          <select value={form.requestType} onChange={(e) => set("requestType", e.target.value)}>
            <option>Solicitação de serviço</option>
            <option>Reclamação</option>
            <option>Sugestão</option>
            <option>Pedido de informação</option>
          </select>
        </label>
        <label>
          Descrição
          <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Enviando…" : "Enviar requerimento"}
        </button>
      </form>

      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Acompanhar protocolo</h2>
        <form onSubmit={acompanhar} className="form-row">
          <input
            style={{ flex: 2 }}
            placeholder="chave pública do protocolo"
            aria-label="Chave pública do protocolo"
            value={trackKey}
            onChange={(e) => setTrackKey(e.target.value)}
          />
          <button type="submit" className="btn">
            Consultar
          </button>
        </form>
        {tracked && (
          <div style={{ marginTop: 12 }}>
            <p>
              <strong>{tracked.protocolNumber}</strong> — {tracked.requestType} · status{" "}
              {tracked.status}
            </p>
            <p className="muted">
              {tracked.citizen.name} · {tracked.citizen.cpfCnpj}
            </p>
            <ol className="timeline">
              {tracked.history.map((h, i) => (
                <li key={i}>
                  <span className="t-action">{h.action}</span>
                  <div className="t-meta">{new Date(h.at).toLocaleString("pt-BR")}</div>
                  {h.note && <div className="t-note">{h.note}</div>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
