"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function createDeadline(form: FormData) {
  const {user}=await requirePermission("deadline.create");
  const input=z.object({process_id:z.union([z.uuid(),z.literal("")]),title:z.string().trim().min(2).max(200),description:z.string().trim().max(2000),due_at:z.iso.datetime({local:true}),responsible_user_id:z.union([z.uuid(),z.literal("")]),priority:z.enum(["low","medium","high","urgent"])}).parse(Object.fromEntries(form));
  const supabase=await createClient();const {data,error}=await supabase.from("deadlines").insert({process_id:input.process_id||null,title:input.title,description:input.description||null,due_at:new Date(input.due_at).toISOString(),responsible_user_id:input.responsible_user_id||null,priority:input.priority,origin:"manual",status:"confirmed",confirmed_by:user.id,confirmed_at:new Date().toISOString(),created_by:user.id}).select("id").single();
  if(error)throw new Error("Não foi possível criar prazo");await audit("create","deadline",data.id);revalidatePath("/prazos");
}

export async function confirmDeadline(form: FormData){await requirePermission("deadline.confirm");const id=z.uuid().parse(form.get("id"));const supabase=await createClient();const {error}=await supabase.rpc("confirm_deadline",{deadline_id:id});if(error)throw new Error("Prazo não pôde ser confirmado");await audit("confirm","deadline",id);revalidatePath("/prazos");}
