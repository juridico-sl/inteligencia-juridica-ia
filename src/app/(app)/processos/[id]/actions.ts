"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function addNote(form:FormData){const{user}=await requirePermission("process.update");const input=z.object({process_id:z.uuid(),content:z.string().trim().min(2).max(10000)}).parse(Object.fromEntries(form)),supabase=await createClient(),mentions=[...input.content.matchAll(/@\[([0-9a-f-]{36})\]/gi)].map(m=>m[1]),{data,error}=await supabase.from("notes").insert({...input,mentions,author_id:user.id}).select("id").single();if(error)throw new Error("Não foi possível criar nota");await audit("create","note",data.id);revalidatePath(`/processos/${input.process_id}`)}

export async function addParty(form:FormData){await requirePermission("process.update");const input=z.object({process_id:z.uuid(),name:z.string().trim().min(2).max(300),type:z.enum(["person","company","government","other"]),role:z.string().trim().min(2).max(80),is_client:z.enum(["true","false"])}).parse(Object.fromEntries(form)),supabase=await createClient(),lookup=await supabase.from("parties").select("id").eq("name",input.name).eq("type",input.type).maybeSingle();if(lookup.error)throw new Error("Não foi possível consultar partes");let party=lookup.data;if(!party){const created=await supabase.from("parties").insert({name:input.name,type:input.type}).select("id").single();if(created.error)throw new Error("Não foi possível criar parte");party=created.data}const{error}=await supabase.from("process_parties").upsert({process_id:input.process_id,party_id:party.id,role:input.role,is_client:input.is_client==="true"});if(error)throw new Error("Não foi possível vincular parte");await audit("party_link","process",input.process_id,{party_id:party.id});revalidatePath(`/processos/${input.process_id}`)}
