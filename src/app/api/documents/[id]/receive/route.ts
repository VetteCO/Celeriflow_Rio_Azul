import { documentAction } from "@/lib/document-actions";
export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) { const params = await paramsPromise; return documentAction(req, params.id, "receive"); }
