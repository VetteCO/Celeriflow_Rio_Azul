"use client";
import { getToken } from "@/components/session";
import type { ModuleData, Family } from "@/lib/modules/domain";
export type RecordRow = { id: string; code: string; family: Family; title: string; body: string; status: string; revision: number; data: ModuleData; createdAt: string; updatedAt: string; dueAt?: string };
export type Options = { departments: { id: string; name: string }[]; users: { id: string; name: string }[]; records: { id: string; code: string; title: string; family: Family }[]; configurations: RecordRow[]; coreDocuments: { id: string; subject: string; number: number; year: number }[]; canCreate: boolean; admin: boolean; userId: string; departmentId: string | null; departmentIds: string[] };
export type Detail = { record: RecordRow; files: { id: string; filename: string; category: string; size: number; mimeType: string; sha256: string }[]; versions: { id: string; revision: number; action: string; note: string; actorId: string | null; createdAt: string }[]; permissions: { edit: boolean } };
export async function download(path: string, filename: string) {
  const token = await getToken(); const response = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Não foi possível baixar o arquivo."); }
  const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
