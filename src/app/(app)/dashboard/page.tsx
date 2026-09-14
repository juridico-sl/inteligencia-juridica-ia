import type { Metadata } from "next";
import { KpiCard, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DashboardCharts } from "@/components/dashboard-charts";
import { getProcessOptions } from "@/lib/data/processes";

export const metadata: Metadata = { title: "Visão Geral" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function DashboardPage({searchParams}:{searchParams:Promise<{company?:string;category?:string;risk?:"low"|"medium"|"high"|"critical";start?:string;end?:string}>}) {
  const filters=await searchParams;const supabase=await createClient();
  const [{data:report},options] = await Promise.all([supabase.rpc("dashboard_metrics",{filter_company_id:filters.company||null,filter_category_id:filters.category||null,filter_risk:filters.risk||null,filter_start_date:filters.start||null,filter_end_date:filters.end||null}),getProcessOptions()]);
  const metrics = report ? {active:Number(report.active),unassigned:Number(report.unassigned),deadlines:Number(report.deadlines),overdue:Number(report.overdue),tasks:Number(report.tasks),movements:Number(report.movements),claim:Number(report.claim_value),exposure:Number(report.exposure),provision:Number(report.provision)} : {active:0,unassigned:0,deadlines:0,overdue:0,tasks:0,movements:0,claim:0,exposure:0,provision:0};
  return <>
    <PageHeader title="Visão Geral" description="Indicadores consolidados em tempo real." />
    <form className="card mb-4 grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6"><select className="field" name="company" defaultValue={filters.company}><option value="">Todas empresas</option>{options.companies.map(c=><option key={c.id} value={c.id}>{c.trade_name??c.legal_name}</option>)}</select><select className="field" name="category" defaultValue={filters.category}><option value="">Todas categorias</option>{options.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="field" name="risk" defaultValue={filters.risk}><option value="">Todos riscos</option><option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option><option value="critical">Crítico</option></select><input className="field" type="date" name="start" defaultValue={filters.start}/><input className="field" type="date" name="end" defaultValue={filters.end}/><button className="button">Aplicar</button></form>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
      <KpiCard label="Processos ativos" value={metrics.active} />
      <KpiCard label="Sem responsável" value={metrics.unassigned} tone={metrics.unassigned ? "danger" : "neutral"} />
      <KpiCard label="Prazos próximos" value={metrics.deadlines} />
      <KpiCard label="Prazos vencidos" value={metrics.overdue} tone={metrics.overdue ? "danger" : "neutral"} />
      <KpiCard label="Tarefas pendentes" value={metrics.tasks} />
      <KpiCard label="Movimentações em 24h" value={metrics.movements} />
      <KpiCard label="Exposição estimada" value={money.format(metrics.exposure)} />
      <KpiCard label="Provisão" value={money.format(metrics.provision)} tone="neutral" />
    </section>
    {report&&<DashboardCharts risk={report.by_risk as {label:string;value:number}[]} category={report.by_category as {label:string;value:number}[]} monthly={report.by_month as {label:string;value:number}[]}/>} 
  </>;
}
