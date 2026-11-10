import { generatePreviousMonthReport, validSchedulerSecret } from "@/lib/operations/scheduled";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!validSchedulerSecret(req.headers.get("authorization"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(await generatePreviousMonthReport(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Não foi possível gerar o relatório agendado." }, { status: 503 });
  }
}
