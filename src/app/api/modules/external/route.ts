import { externalSession, listExternal, createExternal, externalOptions } from "@/lib/modules/external";
import { failure } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { const session = await externalSession(req); return Response.json({ records: await listExternal(session), options: await externalOptions(), email: session.email, uid: session.uid }); } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try { return Response.json({ record: await createExternal(await req.json(), await externalSession(req)) }, { status: 201 }); } catch (e) { return failure(e); }
}
