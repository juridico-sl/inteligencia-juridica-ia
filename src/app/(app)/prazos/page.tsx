import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Check, Calendar, AlertCircle, ShieldAlert } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { formatCnj } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import { confirmDeadline, createDeadline } from "./actions";

export const metadata: Metadata = { title: "Prazos · Central Jurídica" };

const views = [
  { key: "list", label: "Lista Completa" },
  { key: "day", label: "Hoje" },
  { key: "week", label: "Esta Semana" },
  { key: "month", label: "Este Mês" },
] as const;

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requirePermission("deadline.read");
  const requested = (await searchParams).view;
  const activeView = ["day", "week", "month", "list"].includes(requested ?? "")
    ? (requested as "day" | "week" | "month" | "list")
    : "list";

  const supabase = await createClient();
  let query = supabase
    .from("deadlines")
    .select(
      "id,title,description,due_at,status,priority,origin,processes(id,process_number),profiles!deadlines_responsible_user_id_fkey(full_name)"
    )
    .is("deleted_at", null)
    .order("due_at")
    .limit(500);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (activeView !== "list") {
    const end = new Date(start);
    if (activeView === "day") end.setDate(end.getDate() + 1);
    if (activeView === "week") end.setDate(end.getDate() + 7);
    if (activeView === "month") end.setMonth(end.getMonth() + 1, 1);
    query = query.gte("due_at", start.toISOString()).lt("due_at", end.toISOString());
  }

  const [{ data }, { data: processes }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("processes").select("id,process_number").is("deleted_at", null).order("process_number"),
    supabase.from("profiles").select("id,full_name,email").eq("active", true),
  ]);

  return (
    <>
      <PageHeader
        title="Controle de Prazos Processuais"
        description="Gestão de prazos com garantia de validação e confirmação humana obrigatória."
      />

      {/* Banner de Rigor e Honestidade Legal */}
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-950">Aviso Legal — Contagem de Prazos (CPC Art. 219):</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              A API pública do DataJud (CNJ) disponibiliza apenas eventos e movimentações da TPU (ex.: disponibilização em DJE), não calculando prazos processuais em dias úteis ou considerando suspensões e feriados locais.
              Todas as sugestões geradas permanecem no status <strong>PENDENTE DE CONFIRMAÇÃO</strong> e devem ser validadas individualmente pelo advogado responsável com base na publicação do Diário da Justiça.
            </p>
          </div>
        </div>
      </div>

      {/* Cadastro Manual de Prazo */}
      <details className="card mb-5 p-4">
        <summary className="cursor-pointer font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span>Cadastrar Novo Prazo Confirmado</span>
        </summary>
        <form action={createDeadline} className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">Processo Vinculado</label>
            <select className="field" name="process_id">
              <option value="">Sem processo vinculado</option>
              {(processes ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {formatCnj(p.process_number)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Título do Prazo</label>
            <input className="field" name="title" placeholder="Ex: Apelação Cível" required />
          </div>
          <div>
            <label className="label">Data e Hora Fatal</label>
            <input className="field" name="due_at" type="datetime-local" required />
          </div>
          <div>
            <label className="label">Responsável</label>
            <select className="field" name="responsible_user_id">
              <option value="">Sem responsável definido</option>
              {(profiles ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Prioridade</label>
            <select className="field" name="priority" defaultValue="medium">
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label className="label">Observações</label>
            <input className="field" name="description" placeholder="Instruções ou fundamento legal" />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button className="button">Gravar Prazo</button>
          </div>
        </form>
      </details>

      {/* Filtro de Visão */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {views.map((v) => (
          <Link
            key={v.key}
            href={`?view=${v.key}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeView === v.key
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {/* Tabela de Prazos */}
      <section className="card table-wrap">
        {!data?.length ? (
          <EmptyState>Nenhum prazo cadastrado para este período.</EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Prazo / Objeto</th>
                <th>Processo</th>
                <th>Responsável</th>
                <th>Origem</th>
                <th>Status</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => {
                const p = d.processes as unknown as { id: string; process_number: string } | null;
                const owner = d.profiles as unknown as { full_name?: string } | null;
                const isPending = d.status === "pending_confirmation";
                const priorityBadge =
                  d.priority === "urgent"
                    ? "badge-urgent"
                    : d.priority === "high"
                    ? "badge-warning"
                    : "badge";

                return (
                  <tr key={d.id} className={isPending ? "bg-amber-50/30" : ""}>
                    <td className="whitespace-nowrap font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(d.due_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                    </td>
                    <td>
                      <p className="font-bold text-slate-900">{d.title}</p>
                      {d.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">{d.description}</p>
                      )}
                      <span className={`badge ${priorityBadge} text-[10px] mt-1 capitalize`}>
                        {d.priority}
                      </span>
                    </td>
                    <td>
                      {p ? (
                        <Link
                          href={`/processos/${p.id}`}
                          className="font-medium text-orange-600 hover:underline"
                        >
                          {formatCnj(p.process_number)}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Geral / Sem processo</span>
                      )}
                    </td>
                    <td className="text-sm text-slate-600">{owner?.full_name ?? "Não atribuído"}</td>
                    <td>
                      <span className="text-xs text-slate-500 capitalize">{d.origin}</span>
                    </td>
                    <td>
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Pendente Confirmação
                        </span>
                      ) : (
                        <span className="badge badge-success capitalize">{d.status}</span>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {isPending && (
                        <form action={confirmDeadline} className="inline">
                          <input type="hidden" name="id" value={d.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                          >
                            <Check className="w-3 h-3" />
                            <span>Confirmar</span>
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
