"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, useSession } from "@/components/session";
import { families, familySchema } from "@/lib/modules/domain";
import { ModuleForm } from "../../Form";
import type { Options } from "../../client";
export default function NewModuleRecord() {
  const params = useParams<{ family: string }>();
  const { user } = useSession(); const router = useRouter(); const family = familySchema.safeParse(params.family);
  const [options, setOptions] = useState<Options>(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => typeof crypto !== "undefined" ? crypto.randomUUID() : "");
  useEffect(() => { if (user) api("/api/modules/options").then(setOptions).catch(e => setError(e.message)); }, [user]);
  if (!family.success) return <p>Módulo não encontrado.</p>;
  if (options && (!options.canCreate || ["fluxos", "modelos", "classificacao", "carta", "camadas", "legislacao"].includes(family.data) && !options.admin)) return <section className="card"><Link href={`/gestao/${params.family}`}>Voltar à listagem</Link><p>Seu perfil permite consultar este módulo. A criação exige permissão de edição.</p></section>;
  return <section className="card"><Link href={`/gestao/${params.family}`}>Voltar à listagem</Link><h1>{families[family.data]} — novo registro</h1>{error && <p role="alert">{error}</p>}{options ? <ModuleForm family={family.data} options={options} busy={busy} onSave={async input => { setBusy(true); try { const result = await api(`/api/modules/${family.data}`, { method: "POST", body: JSON.stringify({ ...input, idempotencyKey }) }); router.push(`/gestao/registros/${result.record.id}`); } finally { setBusy(false); } }} /> : <p>{user ? "Carregando configurações…" : "Entre na sua conta para continuar."}</p>}</section>;
}
