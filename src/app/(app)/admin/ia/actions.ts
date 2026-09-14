"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function activateAiPrompt(form: FormData) {
  await requirePermission("admin.settings");
  const content=z.string().trim().min(100).max(30000).parse(form.get("content")),supabase=await createClient(),{data,error}=await supabase.rpc("activate_ai_prompt",{prompt_content:content});
  if(error)throw new Error("Não foi possível versionar o prompt");await audit("activate","ai_prompt",data);revalidatePath("/admin/ia");
}

export async function createEvaluationCase(form: FormData) {
  await requirePermission("admin.settings");
  const input=z.object({question:z.string().trim().min(3).max(4000),expected_sources:z.string().max(10000),expected_answer:z.string().max(10000),tags:z.string().max(1000)}).parse(Object.fromEntries(form));
  let sources:unknown,answer:unknown;try{sources=JSON.parse(input.expected_sources);answer=JSON.parse(input.expected_answer)}catch{throw new Error("Fontes e resposta esperada devem ser JSON válido")}
  const supabase=await createClient(),{data,error}=await supabase.from("ai_evaluation_cases").insert({question:input.question,expected_sources:sources,expected_answer:answer,tags:input.tags.split(",").map(v=>v.trim()).filter(Boolean)}).select("id").single();
  if(error)throw new Error("Não foi possível criar o caso de avaliação");await audit("create","ai_evaluation_case",data.id);revalidatePath("/admin/ia");
}
