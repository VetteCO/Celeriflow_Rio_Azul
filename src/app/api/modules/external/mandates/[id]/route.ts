import { externalSession, changeMandate } from "@/lib/modules/external";
import { failure } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try { return Response.json({ mandate: await changeMandate(params.id, (await req.json()).action, await externalSession(req)) }); } catch (e) { return failure(e); }
}
