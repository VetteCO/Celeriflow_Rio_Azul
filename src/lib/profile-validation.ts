import { z } from "zod";
import { validCpfCnpj } from "./tax-id";
import { validCalendarDate } from "./modules/domain";
export const cpfField = z.string().max(20).transform(s => s.replace(/\D/g, "")).refine(s => s === "" || s.length === 11 && validCpfCnpj(s), "CPF inválido").nullable().optional();
export const phoneField = z.string().max(30).transform(s => s.replace(/[\s()+.-]/g, "")).refine(s => s === "" || /^\d{10,15}$/.test(s), "Telefone inválido").nullable().optional();
export const preferencesField = z.record(z.string().min(1).max(60), z.boolean()).refine(v => Object.keys(v).length <= 30, "Máximo de 30 preferências").optional();
export const profileDetailsSchema = z.object({
  sex: z.enum(["", "Feminino", "Masculino", "Outro", "Não informado"]).optional(),
  birthDate: z.string().refine(value => value === "" || validCalendarDate(value) && value <= new Date().toISOString().slice(0, 10), "Data de nascimento inválida").optional(),
  photo: z.string().max(200000).refine(value => value === "" || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value), "Use uma imagem PNG, JPEG ou WebP incorporada").optional(),
  editor: z.enum(["BASICO", "AVANCADO"]).optional(),
  attachmentView: z.enum(["LISTA", "PREVIA"]).optional(),
  notificationEmail: z.union([z.literal(""), z.string().email().max(254)]).optional(),
  phonePublic: z.boolean().optional(),
  inactivityDays: z.number().int().min(1).max(365).optional(),
}).strict();
export type ProfileDetails = z.infer<typeof profileDetailsSchema>;
export function requestContext(req: Request) {
  return { ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: req.headers.get("user-agent"), applicationVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? "local-0.1.0" };
}
