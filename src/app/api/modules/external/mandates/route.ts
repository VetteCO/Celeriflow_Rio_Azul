import { externalSession, mandates, grantMandate } from "@/lib/modules/external";
import { failure } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { const session = await externalSession(req); return Response.json({ mandates: await mandates(session), uid: session.uid, email: session.email }); } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try { return Response.json({ mandate: await grantMandate(await req.json(), await externalSession(req)) }, { status: 201 }); } catch (e) { return failure(e); }
}
