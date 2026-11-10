import { externalSession, externalDetail, externalCommand } from "@/lib/modules/external";
import { failure } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try { return Response.json(await externalDetail(params.id, await externalSession(req))); } catch (e) { return failure(e); }
}
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try { return Response.json({ record: await externalCommand(params.id, await req.json(), await externalSession(req)) }); } catch (e) { return failure(e); }
}
