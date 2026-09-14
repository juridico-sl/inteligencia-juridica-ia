import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare, Clock, Plus, User } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTask, updateTaskStatus } from "./actions";
import { formatCnj } from "@/lib/legal";
import { CommentForm } from "@/components/inline-actions";

export const metadata: Metadata = { title: "Tarefas · Central Jurídica" };

const columns = [
  { status: "todo", label: "A Fazer" },
  { status: "in_progress", label: "Em Andamento" },
  { status: "blocked", label: "Bloqueada" },
  { status: "completed", label: "Concluída" },
] as const;

export default async function TasksPage() {
  await requirePermission("task.read");
  const supabase = await createClient();

  const [{ data }, { data: processes }, { data: profiles }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id,title,description,due_at,status,priority,processes(id,process_number),profiles!tasks_responsible_user_id_fkey(full_name)"
      )
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .order("due_at"),
    supabase.from("processes").select("id,process_number").is("deleted_at", null),
    supabase.from("profiles").select("id,full_name,email").eq("active", true),
  ]);

  return (
    <>
      <PageHeader
        title="Quadro de Tarefas Operacionais"
        description="Gestão de atividades, cumprimento de ordens judiciais e diligências internas."
      />

      <details className="card mb-5 p-4">
        <summary className="cursor-pointer font-bold text-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-slate-500" />
          <span>Cadastrar Nova Tarefa</span>
        </summary>
        <form action={createTask} className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">Título da Tarefa</label>
            <input className="field" name="title" placeholder="Ex: Elaborar minuta de contestação" required />
          </div>
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
            <label className="label">Data Limite de Conclusão</label>
            <input className="field" name="due_at" type="datetime-local" />
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
            <label className="label">Instruções ou Descrição</label>
            <input className="field" name="description" placeholder="Detalhes para o executor" />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button className="button">Salvar Tarefa</button>
          </div>
        </form>
      </details>

      {(data ?? []).length === 0 ? (
        <section className="card">
          <EmptyState>Nenhuma tarefa cadastrada no momento.</EmptyState>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-4">
          {columns.map(({ status, label }) => {
            const items = data!.filter((t) => t.status === status);
            return (
              <div key={status} className="card p-4 flex flex-col bg-slate-50/50">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {label}
                  </h2>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6">Nenhuma tarefa</p>
                  ) : (
                    items.map((t) => {
                      const p = t.processes as unknown as { id?: string; process_number: string } | null;
                      const owner = t.profiles as unknown as { full_name?: string } | null;
                      const priorityBadge =
                        t.priority === "urgent"
                          ? "badge-urgent"
                          : t.priority === "high"
                          ? "badge-warning"
                          : "badge";

                      return (
                        <article
                          key={t.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-900 leading-snug">{t.title}</h3>
                            <span className={`badge ${priorityBadge} text-[10px] capitalize`}>
                              {t.priority}
                            </span>
                          </div>

                          {t.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>
                          )}

                          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                            {p ? (
                              <div className="flex items-center gap-1 text-orange-600 font-medium truncate">
                                <span>{formatCnj(p.process_number)}</span>
                              </div>
                            ) : (
                              <p className="text-slate-400">Geral (Sem processo)</p>
                            )}

                            <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                              <span className="inline-flex items-center gap-1 text-slate-600 truncate">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{owner?.full_name ?? "Sem responsável"}</span>
                              </span>
                              {t.due_at && (
                                <span className="inline-flex items-center gap-1 text-slate-500 flex-shrink-0">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{new Date(t.due_at).toLocaleDateString("pt-BR")}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-2">
                            <form action={updateTaskStatus} className="flex items-center gap-2">
                              <input type="hidden" name="id" value={t.id} />
                              <select
                                className="field py-1 text-xs"
                                name="status"
                                defaultValue={t.status}
                              >
                                {columns.map((c) => (
                                  <option key={c.status} value={c.status}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                              <button className="button py-1 text-xs px-2.5">Mover</button>
                            </form>
                          </div>

                          <CommentForm taskId={t.id} />
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
