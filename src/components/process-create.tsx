"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, RefreshCw, Upload, Check, AlertCircle, ChevronDown, Building2, User } from "lucide-react";

type Option = {
  id: string;
  name?: string;
  full_name?: string | null;
  email?: string;
  trade_name?: string | null;
  legal_name?: string;
  company_id?: string;
};

type Options = {
  companies: Option[];
  units: Option[];
  categories: Option[];
  profiles: Option[];
  firms: Option[];
};

export function ProcessCreate({ options, open = false }: { options: Options; open?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepText, setStepText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setStepText("Registrando processo na base...");

    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData);

    try {
      const response = await fetch("/api/v1/processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) {
        setBusy(false);
        setStepText("");
        return setMessage(result.error ?? "Falha ao registrar processo.");
      }

      setStepText("Consultando API Pública do DataJud (CNJ) e importando andamentos...");

      try {
        // Dispara sincronização imediata com os tribunais
        const syncRes = await fetch(`/api/v1/processes/${result.id}/refresh`, { method: "POST" });
        const syncData = await syncRes.json();
        if (syncData.ok) {
          setStepText(`Sucesso! ${syncData.movementsReceived} movimentações oficiais importadas.`);
        }
      } catch {
        // Sincronização falhou silenciosamente no primeiro momento, mas o processo já existe
      }

      setBusy(false);
      router.push(`/processos/${result.id}`);
      router.refresh();
    } catch (err) {
      setBusy(false);
      setStepText("");
      setMessage(err instanceof Error ? err.message : "Erro inesperado ao conectar ao servidor.");
    }
  }

  return (
    <details id="novo" open={open} className="card p-5 border border-slate-200 shadow-sm">
      <summary className="cursor-pointer font-bold text-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-slate-500" />
          <span>Cadastrar Processo (1 Clique via CNJ)</span>
        </div>
        <span className="text-xs text-slate-500 font-normal">Sem digitação manual de campos</span>
      </summary>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <label className="block">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Número Único CNJ (20 dígitos)
            </span>
            <div className="relative">
              <input
                className="field text-base font-mono py-2.5 px-3 w-full bg-white border-slate-300"
                name="process_number"
                placeholder="0000000-00.0000.0.00.0000"
                pattern="[0-9]{7}-?[0-9]{2}\.?[0-9]{4}\.?[0-9]\.?[0-9]{2}\.?[0-9]{4}"
                required
                autoFocus
              />
            </div>
          </label>
          <p className="text-xs text-slate-500 leading-relaxed">
            Basta colar o CNJ. O sistema identifica automaticamente o Tribunal (TJ, TRF, TRT, STJ), Vara, Classe Judicial, Assuntos da TPU, Data de Ajuizamento, Valor da Causa e todo o histórico de movimentações.
          </p>
        </div>

        {/* Campos adicionais opcionais (caso queira direcionar a equipe) */}
        <div className="pt-1">
          <button
            type="button"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 transition"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            <span>Vincular empresa ou responsável interno (opcional)</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <div>
                <label className="label flex items-center gap-1 text-slate-600">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span>Empresa do Grupo</span>
                </label>
                <select className="field text-xs" name="company_id">
                  <option value="">Detectar automaticamente ou não atribuir</option>
                  {options.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.trade_name ?? c.legal_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label flex items-center gap-1 text-slate-600">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Advogado Responsável Interno</span>
                </label>
                <select className="field text-xs" name="responsible_user_id">
                  <option value="">Sem responsável definido</option>
                  {options.profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {stepText ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 text-orange-600 animate-spin" />
              <span>{stepText}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Tempo estimado: ~2 segundos</span>
          )}

          <button
            type="submit"
            className="button inline-flex items-center gap-2 w-full sm:w-auto"
            disabled={busy}
          >
            {busy ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Importando dados oficiais…</span>
              </>
            ) : (
              <>
                <Scale className="w-4 h-4" />
                <span>Importar do DataJud (1 Clique)</span>
              </>
            )}
          </button>
        </div>

        {message && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </form>
    </details>
  );
}

export function ProcessImport() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/v1/processes/import", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });

    const result = await response.json();
    setBusy(false);

    if (!response.ok) {
      return setMessage(result.error ?? "Falha na importação.");
    }

    setMessage(
      `${result.imported} importados, ${result.duplicates} duplicados, ${result.invalid} inválidos, ${result.failed} falhas.`
    );
    router.refresh();
  }

  return (
    <details className="card p-4 border border-slate-200 shadow-sm">
      <summary className="cursor-pointer font-bold text-slate-800 flex items-center gap-2">
        <Upload className="w-4 h-4 text-slate-500" />
        <span>Importação em Lote (CSV / Planilha)</span>
      </summary>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={submit}>
        <label>
          <span className="label">Arquivo com coluna de números CNJ</span>
          <input className="field" name="file" type="file" accept=".csv,.xlsx" required />
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Importando lote…" : "Iniciar Importação"}
        </button>
        {message && (
          <p role="status" className="w-full text-xs font-semibold text-slate-700 mt-2">
            {message}
          </p>
        )}
      </form>
    </details>
  );
}
