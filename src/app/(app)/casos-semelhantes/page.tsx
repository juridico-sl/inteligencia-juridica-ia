import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { formatCnj } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export default async function SimilarCasesPage({searchParams}:{searchParams:Promise<{process_id?:string}>}) {
  await requirePermission("process.read");const {process_id}=await searchParams,supabase=await createClient(),{data:processes}=await supabase.from("processes").select("id,process_number").is("deleted_at",null).order("process_number").limit(1000);
  const selected=process_id&&(processes??[]).some(p=>p.id===process_id)?process_id:null,{data:matches}=selected?await supabase.rpc("find_similar_processes",{source_process_id:selected,match_count:20}):{data:null};
  return <><PageHeader title="Casos semelhantes" description="Comparação rastreável por categoria, classe, tribunal, tags e partes."/><form className="card mb-5 flex gap-3 p-4"><select className="field" name="process_id" defaultValue={selected??""} required><option value="">Selecione um processo</option>{processes?.map(p=><option key={p.id} value={p.id}>{formatCnj(p.process_number)}</option>)}</select><button className="button">Comparar</button></form><section className="card table-wrap">{!selected?<EmptyState>Selecione um processo para iniciar.</EmptyState>:!matches?.length?<EmptyState>Nenhum caso semelhante encontrado.</EmptyState>:<table><thead><tr><th>Processo</th><th>Classe</th><th>Status/resultado</th><th>Risco</th><th>Similaridade</th><th>Critérios</th></tr></thead><tbody>{(matches as {id:string;process_number:string;judicial_class:string|null;status:string;risk_level:string;score:number;reasons:string[]}[]).map(m=><tr key={m.id}><td><Link className="font-bold text-orange-700" href={`/processos/${m.id}`}>{formatCnj(m.process_number)}</Link></td><td>{m.judicial_class??"—"}</td><td>{m.status}</td><td>{m.risk_level}</td><td>{Math.round(Number(m.score)*100)}%</td><td>{m.reasons.join(", ")}</td></tr>)}</tbody></table>}</section></>;
}
