"use client";
// POC-07 — portal do cidadão: cadastro + CEP automático + requerimento +
// protocolo/chave + acompanhamento.
import { useEffect, useState } from "react";
import Link from "next/link";
import { MaskedInput } from "@/components/MaskedInput";
import { validCpfCnpj } from "@/lib/tax-id";
import { externalError, useExternalAccount } from "./conta/ExternalAccount";

type Addr = { street: string; district: string; city: string; state: string };
type Created = { protocolNumber: string; publicKey: string; emailStatus: string };
type Track = {
  protocolNumber: string;
  requestType: string;
  status: string;
  createdAt: string;
   citizen?: { name?: string; cpfCnpj: string };
  history: Array<{ action: string; note: string | null; at: string }>;
};

export default function CidadaoPage() {
  const { user } = useExternalAccount();
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
  const [tracking, setTracking] = useState(false);
  const [profileRequired,setProfileRequired]=useState(false);
  const [profileLoaded,setProfileLoaded]=useState(false);
  const [registrationReady, setRegistrationReady] = useState(false);
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  useEffect(()=>{let live=true;fetch("/api/modules/contatos/perfis/publicos",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Perfis de cadastro indisponíveis.");return r.json();}).then(p=>{if(live){setProfileRequired(p.length>0);setProfileLoaded(true);}}).catch(e=>{if(live)setErr(e.message);});return()=>{live=false;};},[]);
  useEffect(()=>{setRegistrationReady(false);if(!user?.emailVerified||!profileRequired)return;let live=true;user.getIdToken().then(token=>fetch("/api/cidadao/conta/cadastro",{headers:{authorization:`Bearer ${token}`},cache:"no-store"})).then(async r=>{if(!r.ok)throw new Error("Não foi possível carregar o cadastro. Acesse Meu cadastro para conferir os dados.");const d=await r.json();if(live){setForm(f=>({...f,...d.address,name:d.name||f.name,cpfCnpj:d.values.cpfCnpj??"",phone:d.values.phone??"",cep:d.values.cep??""}));setRegistrationReady(true);}}).catch(e=>{if(live)setErr(e.message);});return()=>{live=false;};},[user,profileRequired]);
  useEffect(() => {
    if (user?.email) setForm((current) => ({ ...current, email: user.email!, name: current.name || user.displayName || "" }));
  }, [user]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    if (["cep", "street", "district", "city", "state", "number", "complement"].includes(k)) setAddressConfirmed(false);
    if (k === "cep") setCepState("idle");
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
       setForm((f) => f.cep.replace(/\D/g, "") === cep ? ({ ...f, street: d.street, district: d.district, city: d.city, state: d.state }) : f);
      setAddressConfirmed(false); setCepState("ok");
    } catch (e) {
      setCepState("error");
      setErr((e as Error).message);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!addressConfirmed && !profileRequired) { setErr("Confira e confirme o endereço antes de protocolar."); return; }
    setErr(null);
    if(!profileLoaded){setErr("Aguarde o carregamento das regras de cadastro.");return;}
    if(profileRequired&&!user?.emailVerified){setErr("Entre e complete seu cadastro por perfil em Minha conta.");return;}
    if(profileRequired&&!registrationReady){setErr("Aguarde o carregamento do cadastro da sua conta.");return;}
    if ((!profileRequired||form.cpfCnpj)&&!validCpfCnpj(form.cpfCnpj)) { setErr("Informe um CPF ou CNPJ válido."); return; }
    if (user && !user.emailVerified) { setErr("Confirme o e-mail da sua conta antes de registrar o requerimento autenticado."); return; }
    setSaving(true);
    try {
      const token = user ? await user.getIdToken() : null;
      const r = await fetch("/api/cidadao/requerimentos", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
         body: JSON.stringify({ ...form, email: user?.email ?? form.email, cpfCnpj: form.cpfCnpj.replace(/\D/g, ""), cep: form.cep.replace(/\D/g, ""), phone: form.phone.replace(/\D/g, "") }),
      });
      const d = (await r.json()) as Created & { error?: string };
      if (!r.ok) throw new Error(d.error ?? `http_${r.status}`);
      setCreated(d);
    } catch (e) {
      setErr(externalError(e));
    } finally {
      setSaving(false);
    }
  }

  async function acompanhar(e: React.FormEvent) {
    e.preventDefault();
    if (tracking) return;
    setTracking(true);
    setErr(null);
    try {
      const r = await fetch(`/api/cidadao/requerimentos?key=${encodeURIComponent(trackKey.trim())}`);
      const d = (await r.json()) as Track & { error?: string };
      if (!r.ok) throw new Error(d.error ?? `http_${r.status}`);
      setTracked(d);
    } catch (e) {
      setErr((e as Error).message);
       setTracked(null);
    } finally {
      setTracking(false);
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
               ? "Confirmação aceita pelo serviço de e-mail. Confira sua caixa de entrada."
               : "A confirmação por e-mail não foi enviada. Acompanhe seu protocolo pela chave abaixo."}
          </p>
          <p>Guarde esses dois códigos — anote ou fotografe esta tela.</p>
          <Link className="btn btn-primary" href={`/publico/${encodeURIComponent(created.publicKey)}`}>Acompanhar protocolo e QR Code</Link>
          <Link className="btn" href={user?.emailVerified ? `/cidadao/processos/${encodeURIComponent(created.publicKey)}` : "/cidadao/conta"}>Minha caixa, anexos e complementação</Link>
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
      <div className="form-row"><Link className="btn btn-primary" href="/cidadao/conta">{user ? "Minha conta e protocolos" : "Entrar ou criar conta"}</Link><Link className="btn" href="/publico">Consulta pública</Link></div>
      {user && <p className="muted">Requerimento vinculado a {user.email}.{!user.emailVerified && " Confirme seu e-mail na página Minha conta para continuar."}</p>}
      {err && (
        <p className="alert alert-error" role="alert">
          {err}
        </p>
      )}
      <form onSubmit={enviar} className="form" style={{ maxWidth: 640 }}>
        <h2>Cadastro</h2>
        {profileRequired&&<p>Os dados do titular serão obtidos do cadastro por perfil da sua conta. <Link href="/cidadao/conta/cadastro">Preencher ou atualizar meu cadastro</Link></p>}
        {profileRequired && user?.emailVerified && <p role="status">{registrationReady ? `Titular do requerimento: ${form.name}.` : "Carregando cadastro do titular…"}</p>}
        {!profileRequired&&<>
        <div className="form-row">
          <label style={{ flex: 2 }}>
            Nome completo
             <input required name="name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            CPF/CNPJ
             <MaskedInput required={!profileRequired} readOnly={profileRequired} kind="cpfCnpj" name="cpfCnpj" value={form.cpfCnpj} onValueChange={(v) => set("cpfCnpj", v)} />
          </label>
        </div>
        <div className="form-row">
          <label style={{ flex: 1 }}>
            E-mail
             <input required readOnly={!!user} type="email" name="email" spellCheck={false} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            Telefone
             <MaskedInput kind="phone" name="phone" autoComplete="tel" value={form.phone} onValueChange={(v) => set("phone", v)} />
          </label>
        </div>
        <div className="form-row">
          <label style={{ flex: 1 }}>
            CEP
             <MaskedInput required kind="cep" name="cep" autoComplete="postal-code" value={form.cep} onValueChange={(v) => { set("cep", v); setCepState("idle"); }} />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="button" className="btn" onClick={buscarCep} disabled={cepState === "loading"}>
              {cepState === "loading" ? "Buscando…" : "Buscar endereço"}
            </button>
          </div>
        </div>
         {cepState === "ok" && <p role="status">Endereço localizado. Confira os dados e informe o número e complemento.</p>}
         {cepState === "error" && <p role="status">A consulta de CEP está indisponível ou o endereço não foi localizado. Preencha os dados manualmente.</p>}
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
             <input required value={form.city} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            UF
             <input required minLength={2} maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
          </label>
        </div>

        <label><input required type="checkbox" checked={addressConfirmed} onChange={e => setAddressConfirmed(e.target.checked)} /> Conferi o endereço, número e complemento informados.</label>
        </>}
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
           <textarea required minLength={10} rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving || user === undefined || !profileLoaded || profileRequired && !!user?.emailVerified && !registrationReady}>
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
           <button type="submit" className="btn" disabled={tracking || !trackKey.trim()}>
             {tracking ? "Consultando…" : "Consultar"}
          </button>
        </form>
        {tracked && (
          <div style={{ marginTop: 12 }}>
            <p>
              <strong>{tracked.protocolNumber}</strong> — {tracked.requestType} · status{" "}
              {tracked.status}
            </p>
             {tracked.citizen && <p className="muted">CPF/CNPJ protegido: {tracked.citizen.cpfCnpj}</p>}
            <ol className="timeline">
              {tracked.history.map((h, i) => (
                <li key={i}>
                  <span className="t-action">{h.action}</span>
                   <div className="t-meta">{new Date(h.at).toLocaleString("pt-BR")}</div>
                   {h.action === "CITIZEN_REPLY" && h.note && <p>{h.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
