import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Clock, CheckSquare, ShieldAlert, ArrowRight } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hoje · Central Jurídica" };

const sections = [
  { severity: "urgent", label: "Ações Críticas / Urgentes", badgeClass: "badge-urgent" },
  { severity: "attention", label: "Atenção / Prazos Próximos", badgeClass: "badge-warning" },
  { severity: "informative", label: "Informativo / Acompanhamento", badgeClass: "badge" },
] as const;

export default async function TodayPage() {
  const { user } = await requirePermission("alert.read");
  const supabase = await createClient();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);

  const [{ data: alerts }, { data: deadlines }, { data: tasks }, { data: unassigned }] =
    await Promise.all([
      supabase
        .from("alerts")
        .select("id,title,description,severity,process_id,created_at")
        .is("acknowledged_at", null)
        .or(`assigned_to.is.null,assigned_to.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("deadlines")
        .select("id,title,due_at,status,process_id")
        .lte("due_at", tomorrow.toISOString())
        .neq("status", "completed")
        .is("deleted_at", null),
      supabase
        .from("tasks")
        .select("id,title,due_at,status,process_id")
        .lt("due_at", now.toISOString())
        .neq("status", "completed")
        .is("deleted_at", null),
      supabase
        .from("processes")
        .select("id,process_number")
        .is("responsible_user_id", null)
        .is("deleted_at", null)
        .limit(20),
    ]);

  const generated = [
    ...(alerts ?? []).map((a) => ({
      id: `a-${a.id}`,
      title: a.title,
      description: a.description,
      severity: a.severity as "urgent" | "attention" | "informative",
      process_id: a.process_id,
      created_at: a.created_at,
      type: "alerta",
    })),
    ...(deadlines ?? []).map((d) => ({
      id: `d-${d.id}`,
      title: d.title,
      description: `Prazo (${d.status === "pending_confirmation" ? "Pendente de Confirmação" : d.status}): fatal em ${new Date(d.due_at).toLocaleString("pt-BR")}`,
      severity: (new Date(d.due_at) < now ? "urgent" : "attention") as "urgent" | "attention" | "informative",
      process_id: d.process_id,
      created_at: d.due_at,
      type: "prazo",
    })),
    ...(tasks ?? []).map((t) => ({
      id: `t-${t.id}`,
      title: t.title,
      description: `Tarefa com vencimento expirado em ${t.due_at ? new Date(t.due_at).toLocaleString("pt-BR") : "data indeterminada"}`,
      severity: "urgent" as const,
      process_id: t.process_id,
      created_at: t.due_at ?? now.toISOString(),
      type: "tarefa",
    })),
    ...(unassigned ?? []).map((p) => ({
      id: `p-${p.id}`,
      title: `Processo ${p.process_number} sem responsável definido`,
      description: "Atribua um advogado responsável para garantir monitoramento tempestivo das publicações.",
      severity: "attention" as const,
      process_id: p.id,
      created_at: now.toISOString(),
      type: "governanca",
    })),
  ];

  return (
    <>
      <PageHeader
        title="Painel Diário de Prioridades"
        description={`${generated.length} itens demandam ação direta da sua equipe hoje.`}
      />

      {generated.length === 0 ? (
        <section className="card">
          <EmptyState>Nenhuma pendência ou alerta prioritário no momento.</EmptyState>
        </section>
      ) : (
        <div className="space-y-6">
          {sections.map(({ severity, label, badgeClass }) => {
            const items = generated.filter((i) => i.severity === severity);
            if (items.length === 0) return null;

            return (
              <section key={severity}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    {severity === "urgent" && <ShieldAlert className="w-4 h-4 text-red-600" />}
                    {severity === "attention" && <AlertCircle className="w-4 h-4 text-amber-500" />}
                    {severity === "informative" && <Clock className="w-4 h-4 text-slate-400" />}
                    <span>{label}</span>
                  </h2>
                  <span className={`badge ${badgeClass} text-xs font-bold`}>
                    {items.length} {items.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                <div className="card divide-y divide-slate-100 overflow-hidden">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="p-4 hover:bg-slate-50/50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1 max-w-3xl">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
                            {item.type}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                      </div>

                      {item.process_id && (
                        <div className="flex-shrink-0">
                          <Link
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                            href={`/processos/${item.process_id}`}
                          >
                            <span>Abrir processo</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          </Link>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
