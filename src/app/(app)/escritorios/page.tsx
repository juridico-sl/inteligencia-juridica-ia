import { PageHeader, EmptyState } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createLawFirm } from "./actions";

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});

export default async function LawFirmsPage(){
  await requirePermission("process.read");const supabase=await createClient();
  const [{data,error},{data:profiles,error:profilesError}]=await Promise.all([supabase.from("law_firm_metrics").select("*").order("name"),supabase.from("profiles").select("id,full_name,email").eq("active",true).order("full_name")]);
  if(error||profilesError)throw error??profilesError;
  return <><PageHeader title="Escritórios externos" description="Contatos, responsáveis e indicadores objetivos da carteira."/>
    <form action={createLawFirm} className="card mb-5 grid gap-3 p-4 md:grid-cols-2">
      <input className="field" name="name" placeholder="Nome" required/><input className="field" name="contact_name" placeholder="Contato"/><input className="field" name="email" type="email" placeholder="E-mail"/><input className="field" name="phone" placeholder="Telefone"/>
      <select className="field" name="responsible_user_id"><option value="">Sem responsável interno</option>{(profiles??[]).map(profile=><option key={profile.id} value={profile.id}>{profile.full_name??profile.email}</option>)}</select><input className="field" name="practice_areas" placeholder="Áreas, separadas por vírgula"/><button className="button md:col-span-2">Cadastrar escritório</button>
    </form>
    <section className="card table-wrap">{(data??[]).length===0?<EmptyState>Nenhum escritório cadastrado.</EmptyState>:<table><thead><tr><th>Escritório</th><th>Contato / responsável</th><th>Ativos / encerrados</th><th>Valor envolvido</th><th>Prazo médio</th><th>Categorias</th></tr></thead><tbody>{data!.map(f=><tr key={f.id}><td><strong>{f.name}</strong><br/><span className="text-xs text-slate-500">{(f.practice_areas as string[]).join(", ")||"Sem áreas"}</span></td><td>{f.contact_name??"—"}<br/><span className="text-xs text-slate-500">{f.email??f.phone??"—"} · {f.responsible_name??"sem responsável"}</span></td><td>{f.active_processes} / {f.closed_processes}</td><td>{money.format(Number(f.amount_involved))}</td><td>{f.average_deadline_days==null?"—":`${f.average_deadline_days} dias`}</td><td className="text-xs">{Object.entries((f.processes_by_category??{}) as Record<string,number>).map(([category,total])=>`${category}: ${total}`).join(" · ")||"—"}</td></tr>)}</tbody></table>}</section>
  </>;
}
