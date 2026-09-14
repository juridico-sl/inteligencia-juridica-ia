"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name?: string; full_name?: string | null; email?: string; trade_name?: string | null; legal_name?: string; company_id?: string };
type Options = { companies: Option[]; units: Option[]; categories: Option[]; profiles: Option[]; firms: Option[] };

function Select({ name, label, options }: { name: string; label: string; options: Option[] }) {
  return <label><span className="label">{label}</span><select className="field" name={name}><option value="">Não definido</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name ?? item.full_name ?? item.trade_name ?? item.legal_name ?? item.email}</option>)}</select></label>;
}

export function ProcessCreate({ options, open=false }: { options: Options; open?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/v1/processes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(result.error ?? "Falha ao cadastrar");
    router.push(`/processos/${result.id}`); router.refresh();
  }
  return <details id="novo" open={open} className="card p-4"><summary className="cursor-pointer font-bold">Cadastrar processo</summary><form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submit}>
    <label className="md:col-span-2"><span className="label">Número CNJ</span><input className="field" name="process_number" placeholder="0000000-00.0000.0.00.0000" required /></label>
    <Select name="company_id" label="Empresa" options={options.companies} /><Select name="business_unit_id" label="Unidade" options={options.units} />
    <Select name="category_id" label="Categoria" options={options.categories} /><Select name="responsible_user_id" label="Responsável" options={options.profiles} />
    <Select name="law_firm_id" label="Escritório" options={options.firms} />
    <label><span className="label">Subcategoria</span><input className="field" name="subcategory" maxLength={120}/></label>
    <label><span className="label">Status</span><select className="field" name="status" defaultValue="draft"><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="suspended">Suspenso</option><option value="closed">Encerrado</option></select></label>
    <label><span className="label">Risco</span><select className="field" name="risk_level" defaultValue="medium"><option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option><option value="critical">Crítico</option></select></label>
    <label><span className="label">Chance de perda (%)</span><input className="field" name="probability" type="number" min="0" max="100" step="0.01"/></label>
    <label><span className="label">Impacto estimado</span><input className="field" name="impact" type="number" min="0" step="0.01"/></label>
    <label><span className="label">Valor da causa</span><input className="field" name="claim_value" type="number" min="0" step="0.01"/></label>
    <label><span className="label">Exposição estimada</span><input className="field" name="estimated_exposure" type="number" min="0" step="0.01"/></label>
    <label><span className="label">Provisão</span><input className="field" name="provision" type="number" min="0" step="0.01"/></label>
    <label><span className="label">Tags</span><input className="field" name="tags" placeholder="trabalhista, urgente"/></label>
    <label><span className="label">Frequência</span><select className="field" name="monitoring_frequency" defaultValue="0 6,10,14,18 * * *"><option value="0 * * * *">A cada hora</option><option value="0 6,10,14,18 * * *">4 vezes ao dia</option><option value="0 6,18 * * *">2 vezes ao dia</option><option value="0 6 * * *">Diária</option><option value="0 8 * * *">Diária às 8h</option></select></label>
    <label className="flex items-center gap-2"><input type="hidden" name="monitoring_enabled" value="false"/><input name="monitoring_enabled" type="checkbox" value="true" defaultChecked/>Monitoramento ativo</label>
    <label className="md:col-span-2"><span className="label">Observações</span><textarea className="field min-h-24" name="notes" maxLength={10000}/></label>
    <div className="flex items-end md:col-span-2"><button className="button" disabled={busy}>{busy ? "Cadastrando…" : "Cadastrar e sincronizar"}</button></div>
    {message && <p role="alert" className="md:col-span-2 text-sm font-semibold text-red-700">{message}</p>}
  </form></details>;
}

export function ProcessImport() {
  const router = useRouter(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/v1/processes/import", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(result.error ?? "Falha na importação");
    setMessage(`${result.imported} importados, ${result.duplicates} duplicados, ${result.invalid} inválidos, ${result.failed} falhas.`); router.refresh();
  }
  return <details className="card p-4"><summary className="cursor-pointer font-bold">Importar CSV/XLSX</summary><form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={submit}>
    <label><span className="label">Arquivo (até 1.000 linhas)</span><input className="field" name="file" type="file" accept=".csv,.xlsx" required /></label><button className="button" disabled={busy}>{busy ? "Importando…" : "Importar"}</button>{message && <p role="status" className="w-full text-sm font-semibold">{message}</p>}
  </form></details>;
}
