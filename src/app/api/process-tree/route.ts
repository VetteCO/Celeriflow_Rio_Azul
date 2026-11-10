import { z } from "zod";
import { context, failure } from "@/lib/modules/server";
import { processTree } from "@/lib/process-tree";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const ctx = await context(req);
    const root = z.object({ type: z.enum(["document", "module"]), id: z.string().uuid() }).parse(Object.fromEntries(new URL(req.url).searchParams));
    return Response.json(await processTree([root], ctx), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
