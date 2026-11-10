import { z } from "zod";
import type { ContentBlock } from "@/lib/modules/domain";
export const sourceSchema = z.object({ type: z.enum(["document", "module"]), id: z.string().uuid() });
export const jobInputSchema = z.object({
  kind: z.enum(["PDF", "PDFA", "OCR", "ZIP"]),
  sources: z.array(sourceSchema).min(1).max(100),
  selection: z.enum(["complete", "custom"]).default("custom"),
  fileIds: z.array(z.string().uuid()).max(200).optional(),
  assigneeId: z.string().uuid().optional(), idempotencyKey: z.string().uuid(),
});
export type SourceRef = z.infer<typeof sourceSchema>;
export type JobFile = { id: string; sourceId: string; filename: string; mimeType: string; storageKey: string; size: number | null; sha256?: string };
export type JobSource = SourceRef & { code: string; title: string; body: string; blocks: ContentBlock[]; revision?: number };
export type JobPayload = { sources: JobSource[]; files: JobFile[]; selection: "complete" | "custom"; capturedAt: string };
export class JobError extends Error { constructor(message: string, public status = 400) { super(message); } }
export class ConfigurationError extends Error {}
export class PermanentError extends Error {}
