"use client";
import type { ProfileDetails } from "@/lib/profile-validation";
import Image from "next/image";

export function ProfileFields({ value, onChange, administrator = false, policy = false }: { value: ProfileDetails; onChange: (value: ProfileDetails) => void; administrator?: boolean; policy?: boolean }) {
  return <fieldset><legend>Ficha e preferências</legend>
    {administrator && <div className="form-row"><label>Sexo<select value={value.sex ?? ""} onChange={e => onChange({ ...value, sex: e.target.value as ProfileDetails["sex"] })}>{["", "Feminino", "Masculino", "Outro", "Não informado"].map(option => <option key={option} value={option}>{option || "Selecione"}</option>)}</select></label>
      <label>Nascimento<input type="date" max={new Date().toISOString().slice(0, 10)} value={value.birthDate ?? ""} onChange={e => onChange({ ...value, birthDate: e.target.value })} /></label></div>}
    <label>Foto do servidor<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 140000) { e.target.setCustomValidity("Use uma imagem com até 140 KB."); e.target.reportValidity(); return; }
      e.target.setCustomValidity(""); const reader = new FileReader(); reader.onload = () => onChange({ ...value, photo: String(reader.result) }); reader.readAsDataURL(file);
    }} /></label>{value.photo && <div><Image unoptimized src={value.photo} alt="Foto do servidor" width={64} height={64} /><button type="button" className="btn" onClick={() => onChange({ ...value, photo: "" })}>Remover foto</button></div>}
    <label>Editor preferido<select value={value.editor ?? "AVANCADO"} onChange={e => onChange({ ...value, editor: e.target.value as ProfileDetails["editor"] })}><option value="BASICO">Básico</option><option value="AVANCADO">Avançado</option></select></label>
    <label>Visualização de anexos<select value={value.attachmentView ?? "LISTA"} onChange={e => onChange({ ...value, attachmentView: e.target.value as ProfileDetails["attachmentView"] })}><option value="LISTA">Lista e download</option><option value="PREVIA">Prévia quando disponível</option></select></label>
    <label>E-mail secundário para notificações<input type="email" maxLength={254} value={value.notificationEmail ?? ""} onChange={e => onChange({ ...value, notificationEmail: e.target.value })} /></label>
    <label><input type="checkbox" checked={value.phonePublic ?? false} onChange={e => onChange({ ...value, phonePublic: e.target.checked })} /> Exibir telefone na lista de servidores</label>
    {policy && <label>Prazo de inatividade para suspensão (dias)<input type="number" min={1} max={365} value={value.inactivityDays ?? 90} onChange={e => onChange({ ...value, inactivityDays: Number(e.target.value) })} /></label>}
  </fieldset>;
}
