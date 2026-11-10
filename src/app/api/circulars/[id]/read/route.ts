import { NextResponse } from "next/server";
import { canAccessDocument, getSession, requirePerm, isRecipient } from "@/lib/auth";
import { recordCircularRead } from "@/lib/circulars";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = requirePerm(await getSession(req), "circular:view");
  if (!check.ok) return NextResponse.json({ error: "unauthorized" }, { status: check.status });
  const doc = await canAccessDocument(check.session, id);
  if (!doc || doc.type !== "CIRCULAR") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!await isRecipient(check.session, id)) return NextResponse.json({ error: "not_recipient" }, { status: 403 });
  const firstReadAt = await recordCircularRead(check.session, id);
  return NextResponse.json(firstReadAt ? { firstReadAt } : { error: "recipient_changed" }, { status: firstReadAt ? 200 : 409 });
}
