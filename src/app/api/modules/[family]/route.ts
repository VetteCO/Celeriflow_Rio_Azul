import { context, createRecord, failure, listRecords } from "@/lib/modules/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ family: string }> }) {
  const params = await paramsPromise;
  try { return Response.json({ records: await listRecords(params.family, await context(req)) }); } catch (e) { return failure(e); }
}
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ family: string }> }) {
  const params = await paramsPromise;
  try { return Response.json({ record: await createRecord(params.family, await req.json(), await context(req, "doc:create")) }, { status: 201 }); } catch (e) { return failure(e); }
}
