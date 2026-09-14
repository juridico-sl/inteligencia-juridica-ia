"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

const optionalCnpj = z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => !value || value.length === 14, "CNPJ inválido").transform((value) => value || null);

export async function createCompany(form: FormData) {
  const { user } = await requirePermission("process.create");
  const input = z.object({ legal_name: z.string().trim().min(2).max(200), trade_name: z.string().trim().max(200), cnpj: optionalCnpj }).parse(Object.fromEntries(form));
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").insert({ ...input, trade_name: input.trade_name || null }).select("id").single();
  if (error) throw new Error("Não foi possível cadastrar empresa");
  await audit("create", "company", data.id, { actor: user.id }); revalidatePath("/empresas");
}

export async function createUnit(form: FormData) {
  await requirePermission("process.create");
  const input = z.object({ company_id: z.uuid(), name: z.string().trim().min(2).max(160), kind: z.enum(["branch","base","unit"]), cnpj: optionalCnpj, city: z.string().trim().max(120), state: z.string().trim().length(2).toUpperCase() }).parse(Object.fromEntries(form));
  const supabase = await createClient(); const { data, error } = await supabase.from("business_units").insert({ ...input, cnpj: input.cnpj, city: input.city || null }).select("id").single();
  if (error) throw new Error("Não foi possível cadastrar unidade"); await audit("create", "business_unit", data.id); revalidatePath("/empresas");
}
