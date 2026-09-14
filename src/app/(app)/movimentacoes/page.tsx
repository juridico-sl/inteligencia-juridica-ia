import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Filter, ShieldCheck } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCnj } from "@/lib/legal";

export const metadata: Metadata = { title: "Movimentações Processuais · Central Jurídica" };

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; source?: string }>;
}) {
  await requirePermission("process.read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const perPage = 50;
  const supabase = await createClient();

  let query = supabase
    .from("process_movements")
    .select("id,movement_date,movement_type,description,source,ai_summary,ai_relevance,processes(id,process_number)", {
      count: "exact",
    });

  if (params.source) query = query.eq("source", params.source);

  const { data, count } = await query
    .order("movement_date", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  return (
    <>
      <PageHeader
        title="Histórico Global de Movimentações"
        description={`${count ?? 0} andamentos judiciais oficiais deduplicados via hash SHA-256.`}
      />

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 flex items-center gap-3">
        <ShieldCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <p>
          <strong className="text-slate-800">Origem Oficial:</strong> Os eventos com fonte <em>DataJud</em> refletem fidedignamente a Tabela Processual Unificada (TPU) do CNJ. Cópias integrais de despachos ou decisões judiciais demandam consulta ao processo eletrônico do tribunal ou anexo no repositório de documentos.
        </p>
      </div>

      <form className="card mb-5 flex flex-wrap items-center gap-3 p-4" method="GET">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 uppercase">Filtrar por Fonte:</span>
        </div>
        <select className="field max-w-xs" name="source" defaultValue={params.source ?? ""}>
          <option value="">Todas as fontes</option>
          <option value="DataJud">DataJud (CNJ)</option>
          <option value="manual">Manual / Interno</option>
          <option value="document">Extração de Documento</option>
          <option value="MCP">MCP Server</option>
        </select>
        <button className="button">Filtrar</button>
        {params.source && (
          <Link href="/movimentacoes" className="button button-secondary">
            Limpar
          </Link>
        )}
      </form>

      <section className="card table-wrap">
        {!data?.length ? (
          <EmptyState>Nenhuma movimentação registrada.</EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data e Hora</th>
                <th>Processo</th>
                <th>Movimentação Oficial (TPU)</th>
                <th>Fonte</th>
                <th>Classificação IA</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => {
                const p = m.processes as unknown as { id: string; process_number: string } | null;
                const relevanceBadge =
                  m.ai_relevance === "urgent"
                    ? "badge-urgent"
                    : m.ai_relevance === "attention"
                    ? "badge-warning"
                    : "badge";

                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-xs text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(m.movement_date).toLocaleString("pt-BR")}</span>
                      </div>
                    </td>
                    <td>
                      {p ? (
                        <Link
                          className="font-bold text-orange-600 hover:underline text-xs"
                          href={`/processos/${p.id}?tab=andamentos`}
                        >
                          {formatCnj(p.process_number)}
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="max-w-md">
                      <strong className="text-slate-900 text-xs block">{m.movement_type}</strong>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">{m.description}</p>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          m.source === "DataJud"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {m.source}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${relevanceBadge} text-[10px] uppercase font-bold tracking-wider`}>
                        {m.ai_relevance ?? "não analisada"}
                      </span>
                      {m.ai_summary && (
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">{m.ai_summary}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <nav className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500 font-medium text-xs">
          Página {page} de {totalPages} ({count ?? 0} movimentações)
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className="button button-secondary text-xs"
              href={{ query: { ...params, page: page - 1 } }}
            >
              Anterior
            </Link>
          )}
          {(count ?? 0) > page * perPage && (
            <Link
              className="button button-secondary text-xs"
              href={{ query: { ...params, page: page + 1 } }}
            >
              Próxima
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
