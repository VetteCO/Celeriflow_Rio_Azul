"use client";
// Identificação via Login Único gov.br (POC-02).
// Sem credencial de homologação, esta tela valida o fluxo de autenticação
// externa → vínculo de CPF → auditoria.
import { useState } from "react";
import { validCpf } from "@/lib/cpf";

export default function GovbrSimulado({
  searchParams,
}: {
  searchParams: { state?: string };
}) {
  const [cpf, setCpf] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validCpf(cpf)) {
      setErr("CPF inválido — confira os 11 dígitos.");
      return;
    }
    if (name.trim().length < 3) {
      setErr("Informe o nome como está no cadastro.");
      return;
    }
    const q = new URLSearchParams({
      homolog: "1",
      cpf: cpf.replace(/\D/g, ""),
      name: name.trim(),
      state: searchParams.state ?? "",
    });
    window.location.href = `/api/auth/govbr/callback?${q.toString()}`;
  }

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div
        style={{
          background: "#071d41",
          color: "#fff",
          padding: "16px 20px",
          borderRadius: "2px 2px 0 0",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          gov<span style={{ color: "#ffcd07" }}>.br</span>
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>Login Único — identificação do servidor</div>
      </div>
      <div className="card" style={{ borderRadius: "0 0 2px 2px", borderTop: "none" }}>
        <p className="alert alert-warn" role="note">
          Ambiente de homologação: a identificação é validada e vinculada à sua conta
          do sistema, com registro em auditoria.
        </p>
        <h1 style={{ fontSize: 22 }}>Identifique-se</h1>
        {err && (
          <p className="alert alert-error" role="alert">
            {err}
          </p>
        )}
        <form onSubmit={submit} className="form">
          <label>
            CPF
            <input
              name="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
          </label>
          <label>
            Nome completo
            <input
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Entrar
          </button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>
          <a href="/api/auth/govbr/callback?error=cancelled">Cancelar e voltar</a> (demonstra o
          tratamento de cancelamento)
        </p>
      </div>
    </div>
  );
}
