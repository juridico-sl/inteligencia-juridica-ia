"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

const filters=z.object({q:z.string().max(200).optional(),party:z.string().max(200).optional(),cnpj:z.string().max(20).optional(),company:z.string().max(40).optional(),unit:z.string().max(40).optional(),category:z.string().max(40).optional(),status:z.string().max(30).optional(),risk:z.string().max(30).optional(),responsible:z.string().max(40).optional(),firm:z.string().max(40).optional(),court:z.string().max(120).optional(),state:z.string().max(2).optional(),from:z.string().max(10).optional(),to:z.string().max(10).optional(),monitoring:z.string().max(5).optional()}).strict();
export async function saveProcessFilter(form:FormData){const{user}=await requirePermission("process.read"),name=z.string().trim().min(2).max(80).parse(form.get("name")),parsed=filters.parse(JSON.parse(z.string().max(3000).parse(form.get("filters")))),supabase=await createClient(),{data,error}=await supabase.from("saved_filters").upsert({user_id:user.id,resource:"processes",name,filters:parsed},{onConflict:"user_id,resource,name"}).select("id").single();if(error)throw new Error("Não foi possível salvar o filtro");await audit("save_filter","saved_filter",data.id);revalidatePath("/processos");}
export async function deleteProcessFilter(form:FormData){await requirePermission("process.read");const id=z.uuid().parse(form.get("id")),supabase=await createClient(),{error}=await supabase.from("saved_filters").delete().eq("id",id);if(error)throw new Error("Não foi possível excluir o filtro");revalidatePath("/processos");}
