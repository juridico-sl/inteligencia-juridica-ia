"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function createTask(form:FormData){const {user}=await requirePermission("task.create");const input=z.object({process_id:z.union([z.uuid(),z.literal("")]),title:z.string().trim().min(2).max(200),description:z.string().trim().max(2000),responsible_user_id:z.union([z.uuid(),z.literal("")]),priority:z.enum(["low","medium","high","urgent"]),due_at:z.union([z.iso.datetime({local:true}),z.literal("")])}).parse(Object.fromEntries(form));const supabase=await createClient();const {data,error}=await supabase.from("tasks").insert({...input,process_id:input.process_id||null,responsible_user_id:input.responsible_user_id||null,description:input.description||null,due_at:input.due_at?new Date(input.due_at).toISOString():null,created_by:user.id,origin:"manual"}).select("id").single();if(error)throw new Error("Não foi possível criar tarefa");await audit("create","task",data.id);revalidatePath("/tarefas");}
export async function updateTaskStatus(form:FormData){await requirePermission("task.update");const input=z.object({id:z.uuid(),status:z.enum(["todo","in_progress","blocked","completed","cancelled"])}).parse(Object.fromEntries(form));const supabase=await createClient();const {error}=await supabase.from("tasks").update({status:input.status}).eq("id",input.id).is("deleted_at",null);if(error)throw new Error("Não foi possível alterar tarefa");await audit("status_update","task",input.id,{status:input.status});revalidatePath("/tarefas");}
