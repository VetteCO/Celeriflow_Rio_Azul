import { context, createJob, failure, listJobs } from "@/lib/jobs/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { return Response.json(await listJobs(await context(req), new URL(req.url).searchParams), { headers: { "cache-control": "private, no-store" } }); } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    const ctx = await context(req); const body = await req.text();
    if (body.length > 100000) return Response.json({ error: "Seleção excede o limite da solicitação." }, { status: 413 });
    let input: unknown; try { input = JSON.parse(body); } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
    return Response.json({ job: await createJob(input, ctx) }, { status: 202 });
  } catch (e) { return failure(e); }
}
