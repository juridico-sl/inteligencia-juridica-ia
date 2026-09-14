import { EmptyState, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { approveTemplate, generateDraft } from "./actions";

export default async function TemplatesPage({searchParams}:{searchParams:Promise<{draft?:string}>}) {
  await requirePermission("document.read");const {draft}=await searchParams,supabase=await createClient();
  const [{data:templates},{data:processes},{data:generated}]=await Promise.all([supabase.from("knowledge_items").select("id,title,content,approved_at").eq("type","modelo").is("deleted_at",null).order("title"),supabase.from("processes").select("id,process_number").is("deleted_at",null).order("process_number"),draft?supabase.from("knowledge_items").select("id,title,content,tags").eq("id",draft).eq("type","rascunho IA").single():Promise.resolve({data:null})]);
  return <><PageHeader title="Modelos e rascunhos" description="Templates aprovados geram rascunhos; nenhum documento é protocolado ou enviado."/>
    {generated&&<section className="card mb-5 border-l-4 border-l-orange-500 p-5"><h2 className="font-black">{generated.title}</h2><pre className="mt-3 whitespace-pre-wrap font-sans text-sm">{generated.content}</pre></section>}
    <form action={generateDraft} className="card mb-5 grid gap-3 p-4 md:grid-cols-2"><select className="field" name="template_id" required><option value="">Modelo aprovado</option>{templates?.filter(t=>t.approved_at).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><select className="field" name="process_id" required><option value="">Processo</option>{processes?.map(p=><option key={p.id} value={p.id}>{p.process_number}</option>)}</select><textarea className="field md:col-span-2" name="instructions" placeholder="Finalidade e orientações humanas" required/><button className="button md:col-span-2">Gerar rascunho</button></form>
    <section className="space-y-3">{!templates?.length?<div className="card"><EmptyState>Cadastre itens do tipo modelo na Base de Conhecimento.</EmptyState></div>:templates.map(t=><article className="card p-4" key={t.id}><div className="flex items-start justify-between gap-3"><div><span className="badge">{t.approved_at?"Aprovado":"Pendente"}</span><h2 className="mt-2 font-black">{t.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{t.content}</p></div>{!t.approved_at&&<form action={approveTemplate}><input type="hidden" name="id" value={t.id}/><button className="button">Aprovar</button></form>}</div></article>)}</section>
  </>;
}
