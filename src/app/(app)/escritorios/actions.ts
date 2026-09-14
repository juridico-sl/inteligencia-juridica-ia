"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function createLawFirm(form: FormData) {
  await requirePermission("process.create");
  const input = z.object({ name:z.string().trim().min(2).max(200),contact_name:z.string().trim().max(160),email:z.union([z.email(),z.literal("")]),phone:z.string().trim().max(40),responsible_user_id:z.union([z.uuid(),z.literal("")]),practice_areas:z.string() }).parse(Object.fromEntries(form));
  const supabase=await createClient(); const {data,error}=await supabase.from("law_firms").insert({name:input.name,contact_name:input.contact_name||null,email:input.email||null,phone:input.phone||null,responsible_user_id:input.responsible_user_id||null,practice_areas:input.practice_areas.split(",").map(v=>v.trim()).filter(Boolean)}).select("id").single();
  if(error) throw new Error("Não foi possível cadastrar escritório"); await audit("create","law_firm",data.id); revalidatePath("/escritorios");
}
