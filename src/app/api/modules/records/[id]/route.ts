import { command, context, detail, failure } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try { return Response.json(await detail(params.id, await context(req))); } catch (e) { return failure(e); }
}
export async function PATCH(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try { return Response.json({ record: await command(params.id, await req.json(), await context(req, "doc:edit")) }); } catch (e) { return failure(e); }
}
