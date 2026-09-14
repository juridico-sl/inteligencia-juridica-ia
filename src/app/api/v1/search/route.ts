import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function GET(request:NextRequest){
  try{
    await authorizePermission("process.read");await enforceRateLimit("global-search",60,60);
    const term=(request.nextUrl.searchParams.get("q")??"").replace(/[%_,()]/g,"").trim();
    if(term.length<2)return NextResponse.json({data:[]});
    const supabase=await createClient();
    const [processes,parties,documents,movements,notes,tasks,knowledge]=await Promise.all([
      supabase.from("processes").select("id,process_number,court_name").or(`process_number.ilike.%${term}%,court_name.ilike.%${term}%`).is("deleted_at",null).limit(10),
      supabase.from("parties").select("id,name,type").ilike("name",`%${term}%`).limit(10),
      supabase.from("documents").select("id,name,type,process_id").ilike("name",`%${term}%`).is("deleted_at",null).limit(10),
      supabase.from("process_movements").select("id,description,process_id,movement_date").ilike("description",`%${term}%`).limit(10),
      supabase.from("notes").select("id,content,process_id").ilike("content",`%${term}%`).is("deleted_at",null).limit(10),
      supabase.from("tasks").select("id,title,process_id,status").ilike("title",`%${term}%`).is("deleted_at",null).limit(10),
      supabase.from("knowledge_items").select("id,title,type").or(`title.ilike.%${term}%,content.ilike.%${term}%`).is("deleted_at",null).limit(10)
    ]);
    for(const result of [processes,parties,documents,movements,notes,tasks,knowledge])if(result.error)throw result.error;
    const data=[
      ...(processes.data??[]).map(x=>({type:"processo",id:x.id,title:x.process_number,subtitle:x.court_name,href:`/processos/${x.id}`})),
      ...(parties.data??[]).map(x=>({type:"parte",id:x.id,title:x.name,subtitle:x.type,href:`/busca?q=${encodeURIComponent(x.name)}`})),
      ...(documents.data??[]).map(x=>({type:"documento",id:x.id,title:x.name,subtitle:x.type,href:`/api/v1/documents/${x.id}/download`})),
      ...(movements.data??[]).map(x=>({type:"movimentação",id:x.id,title:x.description.slice(0,120),subtitle:new Date(x.movement_date).toLocaleDateString("pt-BR"),href:`/processos/${x.process_id}?tab=movimentacoes`})),
      ...(notes.data??[]).map(x=>({type:"nota",id:x.id,title:x.content.slice(0,120),href:`/processos/${x.process_id}?tab=notas`})),
      ...(tasks.data??[]).map(x=>({type:"tarefa",id:x.id,title:x.title,subtitle:x.status,href:"/tarefas"})),
      ...(knowledge.data??[]).map(x=>({type:"conhecimento",id:x.id,title:x.title,subtitle:x.type,href:"/conhecimento"}))
    ];
    return NextResponse.json({data});
  }catch(error){return apiError(error)}
}
