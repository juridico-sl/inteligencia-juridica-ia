import type { Metadata } from "next";
import { BarChart3, Download, FileSpreadsheet, FileText, Check, X, ShieldCheck } from "lucide-react";
import { PageHeader, EmptyState, KpiCard } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reviewInsight } from "./actions";

export const metadata: Metadata = { title: "Relatórios Executivos · Central Jurídica" };

const reportTypes = [
  ["executive", "Executivo Consolidado"],
  ["critical", "Processos Críticos"],
  ["new", "Novas Distribuições"],
  ["closed", "Processos Encerrados"],
  ["financial", "Contingências CPC 25"],
  ["labor", "Contencioso Trabalhista"],
  ["tax", "Contencioso Tributário"],
  ["environmental", "Contencioso Ambiental"],
  ["regulatory", "Regulatório ANP"],
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; start?: string; end?: string }>;
}) {
  await requirePermission("report.read");
  const params = await searchParams;
  const type = params.type ?? "executive";
  const supabase = await createClient();

  const [{ data: metrics }, { data: insights }] = await Promise.all([
    supabase.rpc("dashboard_metrics", {
      filter_start_date: params.start || null,
      filter_end_date: params.end || null,
    }),
    supabase
      .from("ai_insights")
      .select("id,type,title,description,source_data,confidence,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const query = new URLSearchParams({
    type,
    ...(params.start ? { start: params.start } : {}),
    ...(params.end ? { end: params.end } : {}),
  });

  return (
    <>
      <PageHeader
        title="Relatórios e Inteligência Jurídica"
        description="Agregações financeiras determinísticas no PostgreSQL e narrativas executivas auditáveis."
      />

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 flex items-center gap-3">
        <ShieldCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <p>
          <strong className="text-slate-800">Garantia de Precisão Numérica:</strong> Todos os totais de processos, valores de causa, exposição estimada e provisões contábeis são agregados diretamente do banco de dados relacional. Modelos de IA geram apenas resumos textuais acompanhados dos dados-fonte e percentual de confiança.
        </p>
      </div>

      <form className="card mb-5 grid gap-3 p-4 md:grid-cols-4 items-end" method="GET">
        <div>
          <label className="label">Tipo de Relatório</label>
          <select className="field" name="type" defaultValue={type}>
            {reportTypes.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Data Início</label>
          <input className="field" type="date" name="start" defaultValue={params.start} />
        </div>
        <div>
          <label className="label">Data Fim</label>
          <input className="field" type="date" name="end" defaultValue={params.end} />
        </div>
        <div>
          <button className="button w-full">Filtrar Indicadores</button>
        </div>
      </form>

      {metrics && (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total de Processos"
            value={Number(metrics.total)}
            subtitle="Ações ativas na base"
          />
          <KpiCard
            label="Processos Críticos"
            value={
              (metrics.by_risk as { label: string; value: number }[])?.find(
                (x) => x.label === "critical"
              )?.value ?? 0
            }
            tone="danger"
            subtitle="Alto impacto patrimonial"
          />
          <KpiCard
            label="Exposição Total Estimada"
            value={Number(metrics.exposure).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            subtitle="Risco provável + possível"
          />
          <KpiCard
            label="Provisão Contábil (CPC 25)"
            value={Number(metrics.provision).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            tone="neutral"
            subtitle="Provisionamento exigível"
          />
        </section>
      )}

      {/* Ações de Exportação */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Exportar Base Consolidada:
        </span>
        <a
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          href={`/api/v1/reports/export?${query}&format=csv`}
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span>Exportar CSV</span>
        </a>
        <a
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          href={`/api/v1/reports/export?${query}&format=xlsx`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
          <span>Exportar Excel (XLSX)</span>
        </a>
        <a
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          href={`/api/v1/reports/export?${query}&format=pdf`}
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Exportar Relatório PDF</span>
        </a>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">
          Insights Executivos e Sínteses Rastreáveis
        </h2>
        <span className="text-xs text-slate-500 font-medium">
          Validação humana disponível para auditoria
        </span>
      </div>

      <section className="space-y-3">
        {(insights ?? []).length === 0 ? (
          <div className="card">
            <EmptyState>Nenhum insight executivo registrado para este período.</EmptyState>
          </div>
        ) : (
          insights!.map((i) => (
            <article key={i.id} className="card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="badge text-[10px] uppercase font-bold tracking-wider">
                      {i.type}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(i.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{i.title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{i.description}</p>
                  
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-800 transition">
                      Ver dados-fonte rastreáveis (Grau de confiança: {(Number(i.confidence) * 100).toFixed(0)}%)
                    </summary>
                    <pre className="mt-2 overflow-auto rounded-lg bg-slate-900 text-slate-100 p-3 text-[11px] font-mono leading-normal max-h-60">
                      {JSON.stringify(i.source_data, null, 2)}
                    </pre>
                  </details>
                </div>

                <div className="flex items-center gap-2">
                  {i.status === "pending" ? (
                    <>
                      <form action={reviewInsight}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="status" value="confirmed" />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          <Check className="w-3 h-3" />
                          <span>Confirmar</span>
                        </button>
                      </form>
                      <form action={reviewInsight}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="status" value="dismissed" />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          <X className="w-3 h-3 text-slate-400" />
                          <span>Descartar</span>
                        </button>
                      </form>
                    </>
                  ) : (
                    <span
                      className={`badge text-[11px] capitalize ${
                        i.status === "confirmed"
                          ? "badge-success"
                          : "badge-urgent"
                      }`}
                    >
                      {i.status === "confirmed" ? "Validado" : "Descartado"}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
