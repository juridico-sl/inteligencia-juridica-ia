import { EmptyState, KpiCard, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { activateAiPrompt, createEvaluationCase } from "./actions";

export default async function AiGovernancePage() {
  await requirePermission("admin.settings");const supabase=await createClient();
  const [{data:prompts},{data:cases},{data:feedback},{data:usage}]=await Promise.all([supabase.from("ai_prompt_versions").select("id,version,content,active,created_at").eq("name","legal_assistant").order("version",{ascending:false}),supabase.from("ai_evaluation_cases").select("id,question,tags,active,created_at").order("created_at",{ascending:false}).limit(100),supabase.from("ai_feedback").select("useful"),supabase.from("ai_usage_logs").select("input_tokens,output_tokens,estimated_cost,success")]);
  const positive=(feedback??[]).filter(row=>row.useful).length,totalTokens=(usage??[]).reduce((sum,row)=>sum+Number(row.input_tokens)+Number(row.output_tokens),0),cost=(usage??[]).reduce((sum,row)=>sum+Number(row.estimated_cost??0),0);
  return <><PageHeader title="Governança de IA" description="Prompts versionados, dataset de avaliação, feedback e custos."/>
    <section className="mb-5 grid gap-4 sm:grid-cols-3"><KpiCard label="Feedback útil" value={feedback?.length?`${Math.round(positive/feedback.length*100)}%`:"—"}/><KpiCard label="Tokens" value={totalTokens.toLocaleString("pt-BR")}/><KpiCard label="Custo estimado" value={cost.toLocaleString("pt-BR",{style:"currency",currency:"USD"})}/></section>
    <form action={activateAiPrompt} className="card mb-5 p-4"><label className="label" htmlFor="prompt">Nova versão do prompt</label><textarea id="prompt" className="field min-h-64" name="content" defaultValue={prompts?.find(p=>p.active)?.content} minLength={100} required/><button className="button mt-3">Versionar e ativar</button></form>
    <section className="card table-wrap mb-5">{!prompts?.length?<EmptyState>Nenhum prompt.</EmptyState>:<table><thead><tr><th>Versão</th><th>Estado</th><th>Criado</th></tr></thead><tbody>{prompts.map(p=><tr key={p.id}><td>v{p.version}</td><td><span className="badge">{p.active?"Ativo":"Histórico"}</span></td><td>{new Date(p.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table>}</section>
    <form action={createEvaluationCase} className="card mb-5 grid gap-3 p-4 md:grid-cols-2"><textarea className="field md:col-span-2" name="question" placeholder="Pergunta de avaliação" required/><textarea className="field" name="expected_sources" defaultValue="[]" aria-label="Fontes esperadas em JSON" required/><textarea className="field" name="expected_answer" defaultValue="{}" aria-label="Resposta esperada em JSON" required/><input className="field md:col-span-2" name="tags" placeholder="Tags separadas por vírgula"/><button className="button md:col-span-2">Adicionar ao dataset</button></form>
    <section className="card table-wrap">{!cases?.length?<EmptyState>Nenhum caso de avaliação.</EmptyState>:<table><thead><tr><th>Pergunta</th><th>Tags</th><th>Ativo</th></tr></thead><tbody>{cases.map(c=><tr key={c.id}><td>{c.question}</td><td>{c.tags.join(", ")}</td><td>{c.active?"Sim":"Não"}</td></tr>)}</tbody></table>}</section>
  </>;
}
