import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui";
import { ProcessCreate, ProcessImport } from "@/components/process-create";
import { listProcesses, getProcessOptions, getSavedProcessFilters, type ProcessFilters } from "@/lib/data/processes";
import { formatCnj } from "@/lib/legal";
import { requirePermission } from "@/lib/auth";
import { deleteProcessFilter, saveProcessFilter } from "./actions";

export const metadata: Metadata = { title: "Processos · Central Jurídica" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function ProcessesPage({ searchParams }: { searchParams: Promise<ProcessFilters> }) {
  await requirePermission("process.read");
  const filters = await searchParams;
  const [result, options, savedFilters] = await Promise.all([
    listProcesses(filters),
    getProcessOptions(),
    getSavedProcessFilters(),
  ]);

  const pages = Math.max(1, Math.ceil(result.total / result.perPage));
  const savable = Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => !["page", "per_page", "novo"].includes(key) && value)
  );

  return (
    <>
      <PageHeader
        title="Processos Judiciais"
        description={`${result.total} processos catalogados e monitorados.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ProcessImport />
            <ProcessCreate options={options} open={filters.novo === "1"} />
          </div>
        }
      />

      {savedFilters.length > 0 && (
        <div className="card mb-4 flex flex-wrap items-center gap-2 p-3 bg-white">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtros salvos:</span>
          {savedFilters.map((item) => (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
              key={item.id}
            >
              <Link href={{ query: item.filters as Record<string, string> }} className="hover:text-orange-600">
                {item.name}
              </Link>
              <form action={deleteProcessFilter} className="inline">
                <input type="hidden" name="id" value={item.id} />
                <button className="text-slate-400 hover:text-red-600 ml-1 font-bold" aria-label={`Excluir filtro ${item.name}`}>
                  ×
                </button>
              </form>
            </span>
          ))}
        </div>
      )}

      {/* Painel de Filtros e Busca Estruturada */}
      <form className="card mb-6 p-5 bg-white shadow-sm border border-slate-200">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Busca Rápida</label>
            <input className="field" name="q" defaultValue={filters.q} placeholder="Número CNJ ou Tribunal..." />
          </div>
          <div>
            <label className="label">Parte Envolvida</label>
            <input className="field" name="party" defaultValue={filters.party} placeholder="Nome do autor ou réu..." />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="field" name="status" defaultValue={filters.status}>
              <option value="">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="draft">Rascunho</option>
              <option value="suspended">Suspenso</option>
              <option value="closed">Encerrado</option>
            </select>
          </div>
          <div>
            <label className="label">Classificação de Risco</label>
            <select className="field" name="risk" defaultValue={filters.risk}>
              <option value="">Todos os riscos</option>
              <option value="low">Baixo (Remoto)</option>
              <option value="medium">Médio (Possível)</option>
              <option value="high">Alto (Provável)</option>
              <option value="critical">Crítico</option>
            </select>
          </div>

          <div>
            <label className="label">Empresa</label>
            <select className="field" name="company" defaultValue={filters.company}>
              <option value="">Todas empresas</option>
              {options.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name ?? c.legal_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Unidade de Negócio</label>
            <select className="field" name="unit" defaultValue={filters.unit}>
              <option value="">Todas unidades</option>
              {options.units.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="field" name="category" defaultValue={filters.category}>
              <option value="">Todas categorias</option>
              {options.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Responsável</label>
            <select className="field" name="responsible" defaultValue={filters.responsible}>
              <option value="">Todos responsáveis</option>
              {options.profiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.full_name ?? item.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Exibindo até 25 resultados por página</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/processos" className="button button-secondary text-sm">
              Limpar Filtros
            </Link>
            <button className="button text-sm">
              Aplicar Filtros
            </button>
          </div>
        </div>
      </form>

      {Object.keys(savable).length > 0 && (
        <form action={saveProcessFilter} className="card mb-4 flex flex-wrap items-center gap-3 p-3 bg-white">
          <span className="text-xs font-bold text-slate-500 uppercase">Salvar Consulta:</span>
          <input className="field max-w-xs text-sm" name="name" placeholder="Nome do filtro (ex: Trabalhistas Críticos)" required />
          <input type="hidden" name="filters" value={JSON.stringify(savable)} />
          <button className="button button-secondary text-sm">Salvar Filtro</button>
        </form>
      )}

      {/* Tabela de Dados - Seção 3.3 de IDENTIDADE_VISUAL.md */}
      <section className="card bg-white table-wrap border border-slate-200 shadow-sm">
        {result.data.length === 0 ? (
          <EmptyState>Nenhum processo localizado com os filtros aplicados.</EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Processo (CNJ) / Tribunal</th>
                <th>Empresa / Unidade</th>
                <th>Categoria / Partes</th>
                <th>Responsável</th>
                <th>Status / Risco</th>
                <th>Exposição / Provisão</th>
                <th>Última Movimentação</th>
                <th>Sincronismo</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => {
                const riskBadge =
                  item.risk_level === "critical" || item.risk_level === "high"
                    ? "badge-urgent"
                    : item.risk_level === "medium"
                    ? "badge-warning"
                    : "badge-success";

                return (
                  <tr key={item.id} className="transition">
                    <td>
                      <Link
                        className="font-bold text-orange-600 hover:text-orange-700 hover:underline"
                        href={`/processos/${item.id}`}
                      >
                        {formatCnj(item.process_number)}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.court_name ?? "Tribunal não informado"}
                        {item.state ? ` · ${item.state}` : ""}
                      </p>
                    </td>
                    <td>
                      <p className="font-semibold text-slate-800">{item.company_name ?? "—"}</p>
                      <p className="text-xs text-slate-500">{item.unit_name ?? "—"}</p>
                    </td>
                    <td>
                      <p className="font-semibold text-slate-800">{item.category_name ?? "—"}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]" title={item.party_names || ""}>
                        {item.party_names || "Sem partes"}
                      </p>
                    </td>
                    <td>
                      <p className="font-semibold text-slate-800">{item.responsible_name ?? "Sem responsável"}</p>
                      <p className="text-xs text-slate-500">{item.law_firm_name ?? "Sem escritório"}</p>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <span className="badge text-[11px] capitalize">{item.status}</span>
                        <span className={`badge ${riskBadge} text-[11px] capitalize`}>{item.risk_level}</span>
                      </div>
                    </td>
                    <td>
                      <p className="font-bold text-slate-800">{money.format(Number(item.claim_value ?? 0))}</p>
                      <p className="text-xs text-slate-500">
                        Prov. {money.format(Number(item.provision ?? 0))}
                      </p>
                    </td>
                    <td className="text-xs text-slate-600">
                      {item.last_movement_at ? new Date(item.last_movement_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 ${
                          item.last_synced_at ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {item.last_synced_at ? "DataJud Ativo" : "Pendente"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Paginação */}
      <nav className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500 font-medium">
          Página {result.page} de {pages} ({result.total} processos)
        </span>
        <div className="flex gap-2">
          {result.page > 1 && (
            <Link className="button button-secondary" href={{ query: { ...filters, page: result.page - 1 } }}>
              Anterior
            </Link>
          )}
          {result.page < pages && (
            <Link className="button button-secondary" href={{ query: { ...filters, page: result.page + 1 } }}>
              Próxima
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
