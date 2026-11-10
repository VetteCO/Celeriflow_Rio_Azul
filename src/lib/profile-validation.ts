import { z } from "zod";
import { validCpfCnpj } from "./tax-id";
export const cpfField = z.string().max(20).transform(s => s.replace(/\D/g, "")).refine(s => s === "" || s.length === 11 && validCpfCnpj(s), "CPF inválido").nullable().optional();
export const phoneField = z.string().max(30).transform(s => s.replace(/[\s()+.-]/g, "")).refine(s => s === "" || /^\d{10,15}$/.test(s), "Telefone inválido").nullable().optional();
export const preferencesField = z.record(z.string().min(1).max(60), z.boolean()).refine(v => Object.keys(v).length <= 30, "Máximo de 30 preferências").optional();
