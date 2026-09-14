import type { Metadata } from "next";
import Link from "next/link";
import { Scale, TrendingDown, Landmark, Clock, Plus } from "lucide-react";
import { KpiCard, PageHeader, TrafficLight } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DashboardCharts } from "@/components/dashboard-charts";
import { getProcessOptions } from "@/lib/data/processes";

export const metadata: Metadata = { title: "Visão Geral · Central Jurídica" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    category?: string;
    risk?: "low" | "medium" | "high" | "critical";
    start?: string;
    end?: string;
  }>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();

  const [{ data: report }, options] = await Promise.all([
    supabase.rpc("dashboard_metrics", {
      filter_company_id: filters.company || null,
      filter_category_id: filters.category || null,
      filter_risk: filters.risk || null,
      filter_start_date: filters.start || null,
      filter_end_date: filters.end || null,
    }),
    getProcessOptions(),
  ]);

  const metrics = report
    ? {
        active: Number(report.active),
        unassigned: Number(report.unassigned),
        deadlines: Number(report.deadlines),
        overdue: Number(report.overdue),
        tasks: Number(report.tasks),
        movements: Number(report.movements),
        claim: Number(report.claim_value),
        exposure: Number(report.exposure),
        provision: Number(report.provision),
      }
    : {
        active: 0,
        unassigned: 0,
        deadlines: 0,
        overdue: 0,
        tasks: 0,
        movements: 0,
        claim: 0,
        exposure: 0,
        provision: 0,
      };

  return (
    <>
      <PageHeader
        title="Painel Geral"
        description="Monitoramento executivo e indicadores consolidados da carteira jurídica."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Sincronismo Ativo
            </span>
            <Link href="/processos?novo=1" className="button text-sm">
              <Plus className="w-4 h-4" />
              <span>Novo Processo</span>
            </Link>
          </div>
        }
      />

      {/* Barra de Filtros Elegante */}
      <form className="card mb-6 grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6 items-end bg-white">
        <div>
          <label className="label">Empresa</label>
          <select className="field text-sm" name="company" defaultValue={filters.company}>
            <option value="">Todas empresas</option>
            {options.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.trade_name ?? c.legal_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Categoria</label>
          <select className="field text-sm" name="category" defaultValue={filters.category}>
            <option value="">Todas categorias</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Risco</label>
          <select className="field text-sm" name="risk" defaultValue={filters.risk}>
            <option value="">Todos riscos</option>
            <option value="low">Baixo (Remoto)</option>
            <option value="medium">Médio (Possível)</option>
            <option value="high">Alto (Provável)</option>
            <option value="critical">Crítico</option>
          </select>
        </div>

        <div>
          <label className="label">Período De</label>
          <input className="field text-sm" type="date" name="start" defaultValue={filters.start} />
        </div>

        <div>
          <label className="label">Período Até</label>
          <input className="field text-sm" type="date" name="end" defaultValue={filters.end} />
        </div>

        <div className="flex gap-2">
          <button className="button flex-1 text-sm">Filtrar</button>
          <Link href="/dashboard" className="button button-secondary text-sm">
            Limpar
          </Link>
        </div>
      </form>

      {/* Grid de KPIs - Seção 3.1 & 5 de IDENTIDADE_VISUAL.md */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6" aria-label="Indicadores">
        <KpiCard
          label="Processos Ativos"
          value={metrics.active}
          tone="brand"
          subtitle="Em tramitação no Judiciário"
          icon={<Scale className="w-5 h-5 text-slate-500" />}
        />
        <KpiCard
          label="Exposição Estimada"
          value={money.format(metrics.exposure)}
          tone="danger"
          subtitle="Risco financeiro potencial"
          icon={<TrendingDown className="w-5 h-5 text-slate-500" />}
        />
        <KpiCard
          label="Provisão Contábil"
          value={money.format(metrics.provision)}
          tone="neutral"
          subtitle="Conforme norma CPC 25"
          icon={<Landmark className="w-5 h-5 text-slate-500" />}
        />
        <KpiCard
          label="Prazos Fatais Iminentes"
          value={metrics.deadlines}
          tone={metrics.overdue > 0 ? "danger" : metrics.deadlines > 0 ? "warning" : "success"}
          subtitle={`${metrics.overdue} vencidos pendentes`}
          icon={<Clock className="w-5 h-5 text-slate-500" />}
        />
      </section>

      {/* Semáforo de Risco & Oportunidade - Seção 3.2 de IDENTIDADE_VISUAL.md */}
      <section className="mb-6">
        <div className="mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Semáforo de Risco & Operação
          </h2>
        </div>
        <TrafficLight
          items={[
            {
              track: "Prazos Vencidos",
              value: metrics.overdue === 0 ? "0 Prazos" : `${metrics.overdue} Vencidos`,
              status: metrics.overdue > 0 ? "danger" : "success",
              detail: metrics.overdue > 0 ? "Ação imediata necessária" : "Todos os prazos em dia",
            },
            {
              track: "Processos sem Responsável",
              value: metrics.unassigned === 0 ? "100% Atribuídos" : `${metrics.unassigned} Pendentes`,
              status: metrics.unassigned > 0 ? "warning" : "success",
              detail: metrics.unassigned > 0 ? "Atribuir advogados" : "Equipe alocada",
            },
            {
              track: "Andamentos Recentes",
              value: `${metrics.movements} Movimentações`,
              status: "success",
              detail: "Monitoramento DataJud nas últimas 24h",
            },
          ]}
        />
      </section>

      {/* Gráficos Institucionais */}
      {report && (
        <DashboardCharts
          risk={(report.by_risk as { label: string; value: number }[]) || []}
          category={(report.by_category as { label: string; value: number }[]) || []}
          monthly={(report.by_month as { label: string; value: number }[]) || []}
        />
      )}
    </>
  );
}
