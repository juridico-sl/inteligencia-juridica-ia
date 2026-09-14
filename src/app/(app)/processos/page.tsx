import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui";
import { ProcessCreate, ProcessImport } from "@/components/process-create";
import { listProcesses, getProcessOptions, getSavedProcessFilters, type ProcessFilters } from "@/lib/data/processes";
import { formatCnj } from "@/lib/legal";
import { requirePermission } from "@/lib/auth";
import { deleteProcessFilter, saveProcessFilter } from "./actions";

export const metadata: Metadata = { title: "Processos" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function ProcessesPage({ searchParams }: { searchParams: Promise<ProcessFilters> }) {
  await requirePermission("process.read");
  const filters = await searchParams;
  const [result, options, savedFilters] = await Promise.all([listProcesses(filters), getProcessOptions(), getSavedProcessFilters()]);
  const pages = Math.max(1, Math.ceil(result.total / result.perPage));
  const savable=Object.fromEntries(Object.entries(filters).filter(([key,value])=>!['page','per_page','novo'].includes(key)&&value));
  return <>
    <PageHeader title="Processos" description={`${result.total} registros jurídicos`} />
    <div className="mb-4 grid gap-4 xl:grid-cols-2"><ProcessCreate options={options} open={filters.novo==="1"}/><ProcessImport /></div>
    {savedFilters.length>0&&<div className="card mb-4 flex flex-wrap items-center gap-2 p-3"><strong className="text-sm">Filtros salvos:</strong>{savedFilters.map(item=><span className="flex items-center gap-1" key={item.id}><Link className="button button-secondary" href={{query:item.filters as Record<string,string>}}>{item.name}</Link><form action={deleteProcessFilter}><input type="hidden" name="id" value={item.id}/><button className="px-2 text-red-700" aria-label={`Excluir filtro ${item.name}`}>×</button></form></span>)}</div>}
    <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input className="field" name="q" defaultValue={filters.q} placeholder="CNJ ou tribunal" />
      <input className="field" name="party" defaultValue={filters.party} placeholder="Parte" />
      <input className="field" name="cnpj" defaultValue={filters.cnpj} placeholder="CNPJ da empresa" />
      <select className="field" name="status" defaultValue={filters.status}><option value="">Todos status</option><option value="active">Ativo</option><option value="draft">Rascunho</option><option value="suspended">Suspenso</option><option value="closed">Encerrado</option></select>
      <select className="field" name="risk" defaultValue={filters.risk}><option value="">Todos riscos</option><option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option><option value="critical">Crítico</option></select>
      <select className="field" name="company" defaultValue={filters.company}><option value="">Todas empresas</option>{options.companies.map((c) => <option key={c.id} value={c.id}>{c.trade_name ?? c.legal_name}</option>)}</select>
      <select className="field" name="unit" defaultValue={filters.unit}><option value="">Todas unidades</option>{options.units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select className="field" name="category" defaultValue={filters.category}><option value="">Todas categorias</option>{options.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select className="field" name="responsible" defaultValue={filters.responsible}><option value="">Todos responsáveis</option>{options.profiles.map((item) => <option key={item.id} value={item.id}>{item.full_name??item.email}</option>)}</select>
      <select className="field" name="firm" defaultValue={filters.firm}><option value="">Todos escritórios</option>{options.firms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <input className="field" name="court" defaultValue={filters.court} placeholder="Tribunal" />
      <input className="field uppercase" name="state" defaultValue={filters.state} maxLength={2} placeholder="UF" />
      <input className="field" name="from" defaultValue={filters.from} type="date" aria-label="Distribuído desde" />
      <input className="field" name="to" defaultValue={filters.to} type="date" aria-label="Distribuído até" />
      <select className="field" name="monitoring" defaultValue={filters.monitoring}><option value="">Todo monitoramento</option><option value="true">Monitorados</option><option value="false">Não monitorados</option></select>
      <div className="flex gap-2"><button className="button">Filtrar</button><Link className="button button-secondary" href="/processos">Limpar</Link></div>
    </form>
    {Object.keys(savable).length>0&&<form action={saveProcessFilter} className="card mb-4 flex flex-wrap items-end gap-3 p-3"><label><span className="label">Salvar consulta atual</span><input className="field" name="name" placeholder="Ex.: Trabalhistas críticos RS" required/></label><input type="hidden" name="filters" value={JSON.stringify(savable)}/><button className="button button-secondary">Salvar filtro</button></form>}
    <section className="card table-wrap">
      {result.data.length === 0 ? <EmptyState>Nenhum processo encontrado.</EmptyState> : <table><thead><tr><th>CNJ / Tribunal</th><th>Empresa / Unidade</th><th>Categoria / Parte</th><th>Responsável / Escritório</th><th>Status / Risco</th><th>Valor / Provisão</th><th>Última movimentação</th><th>Próximo prazo</th><th>Sync</th></tr></thead><tbody>{result.data.map((item) =>
        <tr key={item.id}><td><Link className="font-bold text-orange-700 hover:underline" href={`/processos/${item.id}`}>{formatCnj(item.process_number)}</Link><br/><span className="text-xs text-slate-500">{item.court_name??"—"}{item.state?` · ${item.state}`:""}</span></td><td>{item.company_name??"—"}<br/><span className="text-xs text-slate-500">{item.unit_name??"—"}</span></td><td>{item.category_name??"—"}<br/><span className="text-xs text-slate-500">{item.party_names||"Sem partes"}</span></td><td>{item.responsible_name??"Sem responsável"}<br/><span className="text-xs text-slate-500">{item.law_firm_name??"Sem escritório"}</span></td><td><span className="badge">{item.status}</span> <span className={`badge ${item.risk_level === "critical" || item.risk_level === "high" ? "badge-urgent" : item.risk_level === "medium" ? "badge-warning" : "badge-success"}`}>{item.risk_level}</span></td><td>{money.format(Number(item.claim_value ?? 0))}<br/><span className="text-xs text-slate-500">Prov. {money.format(Number(item.provision ?? 0))}</span></td><td className="text-xs">{item.last_movement_at?new Date(item.last_movement_at).toLocaleString("pt-BR"):"—"}</td><td className="text-xs">{item.next_deadline_at?new Date(item.next_deadline_at).toLocaleString("pt-BR"):"—"}</td><td className="text-xs">{item.last_synced_at ? new Date(item.last_synced_at).toLocaleString("pt-BR") : "Pendente"}<br/>{item.monitoring_enabled?"Monitorado":"Manual"}</td></tr>
      )}</tbody></table>}
    </section>
    <nav className="mt-4 flex items-center justify-between text-sm"><span>Página {result.page} de {pages}</span><div className="flex gap-2">{result.page > 1 && <Link className="button button-secondary" href={{ query: { ...filters, page: result.page - 1 } }}>Anterior</Link>}{result.page < pages && <Link className="button button-secondary" href={{ query: { ...filters, page: result.page + 1 } }}>Próxima</Link>}</div></nav>
  </>;
}
