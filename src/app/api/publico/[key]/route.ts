import { NextResponse } from "next/server";
import { publicDocument } from "@/lib/public-document";
export async function GET(_req: Request, { params: paramsPromise }: { params: Promise<{ key: string }> }) {
  const params = await paramsPromise;
  const result = await publicDocument(params.key);
  return NextResponse.json(result ?? { error: "not_found" }, { status: result ? 200 : 404, headers: { "cache-control": "no-store" } });
}
