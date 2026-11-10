import { NextResponse } from "next/server";
import { documentAction } from "@/lib/document-actions";
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const action = new URL(req.url).searchParams.get("action");
  if (action !== "conclude" && action !== "archive" && action !== "reopen" && action !== "reply") return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  return documentAction(req, params.id, action);
}
