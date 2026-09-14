import { EmptyState, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { formatCnj } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import { confirmDeadline, createDeadline } from "./actions";

const views = ["day", "week", "month", "list"] as const;

export default async function DeadlinesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePermission("deadline.read");
  const requested = (await searchParams).view;
  const view = views.includes(requested as typeof views[number]) ? requested! : "list";
  const supabase = await createClient();
  let deadlines = supabase.from("deadlines").select("id,title,description,due_at,status,priority,origin,processes(id,process_number),profiles!deadlines_responsible_user_id_fkey(full_name)").is("deleted_at", null).order("due_at").limit(500);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (view !== "list") {
    const end = new Date(start);
    if (view === "day") end.setDate(end.getDate() + 1);
    if (view === "week") end.setDate(end.getDate() + 7);
    if (view === "month") end.setMonth(end.getMonth() + 1, 1);
    deadlines = deadlines.gte("due_at", start.toISOString()).lt("due_at", end.toISOString());
  }
  const [{ data }, { data: processes }, { data: profiles }] = await Promise.all([
    deadlines,
    supabase.from("processes").select("id,process_number").is("deleted_at", null).order("process_number"),
    supabase.from("profiles").select("id,full_name,email").eq("active", true)
  ]);
  return <><PageHeader title="Prazos" description="Sugestões automáticas permanecem PENDENTE DE CONFIRMAÇÃO."/>
    <form action={createDeadline} className="card mb-5 grid gap-3 p-4 md:grid-cols-3">
      <select className="field" name="process_id"><option value="">Sem processo</option>{(processes??[]).map(p=><option key={p.id} value={p.id}>{formatCnj(p.process_number)}</option>)}</select>
      <input className="field" name="title" placeholder="Título" required/><input className="field" name="due_at" type="datetime-local" required/>
      <select className="field" name="responsible_user_id"><option value="">Sem responsável</option>{(profiles??[]).map(p=><option key={p.id} value={p.id}>{p.full_name??p.email}</option>)}</select>
      <select className="field" name="priority"><option value="medium">Média</option><option value="low">Baixa</option><option value="high">Alta</option><option value="urgent">Urgente</option></select>
      <input className="field" name="description" placeholder="Descrição"/><button className="button md:col-span-3">Criar prazo confirmado</button>
    </form>
    <div className="mb-3 flex gap-2">{views.map(v=><a key={v} href={`?view=${v}`} className={`button ${view===v?"":"button-secondary"}`}>{{day:"Dia",week:"Semana",month:"Mês",list:"Lista"}[v]}</a>)}</div>
    <section className="card table-wrap">{!data?.length?<EmptyState>Nenhum prazo neste período.</EmptyState>:<table><thead><tr><th>Vencimento</th><th>Prazo</th><th>Processo</th><th>Responsável</th><th>Origem</th><th>Status</th><th></th></tr></thead><tbody>{data.map(d=>{const p=d.processes as unknown as {id:string;process_number:string}|null;const owner=d.profiles as unknown as {full_name?:string}|null;return <tr key={d.id}><td>{new Date(d.due_at).toLocaleString("pt-BR")}</td><td className="font-bold">{d.title}<br/><span className="text-xs font-normal text-slate-500">{d.priority}</span></td><td>{p?formatCnj(p.process_number):"—"}</td><td>{owner?.full_name??"—"}</td><td>{d.origin}</td><td><span className={`badge ${d.status==="pending_confirmation"?"badge-warning":""}`}>{d.status==="pending_confirmation"?"PENDENTE DE CONFIRMAÇÃO":d.status}</span></td><td>{d.status==="pending_confirmation"&&<form action={confirmDeadline}><input type="hidden" name="id" value={d.id}/><button className="button">Confirmar</button></form>}</td></tr>})}</tbody></table>}</section>
  </>;
}
