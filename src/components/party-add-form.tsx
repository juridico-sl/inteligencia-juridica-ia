"use client";

import { useState } from "react";
import { Search, Building2, Check, AlertCircle, RefreshCw } from "lucide-react";

export function PartyAddForm({
  processId,
  action,
}: {
  processId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [cnpj, setCnpj] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Réu");
  const [type, setType] = useState("company");
  const [isClient, setIsClient] = useState("false");
  const [searching, setSearching] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);

  async function handleCnpjLookup() {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      setFeedback("Digite os 14 dígitos do CNPJ para consulta.");
      setFeedbackError(true);
      return;
    }

    setSearching(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/integrations/cnpj/${clean}`);
      const json = await res.json();
      setSearching(false);

      if (!res.ok || !json.ok) {
        setFeedback(json.error ?? "CNPJ não localizado na Receita Federal.");
        setFeedbackError(true);
        return;
      }

      const d = json.data;
      const officialName = d.nome_fantasia ? `${d.razao_social} (${d.nome_fantasia})` : d.razao_social;
      setName(officialName);
      setType("company");
      setFeedbackError(false);

      const qsaCount = d.qsa?.length ?? 0;
      setFeedback(
        `Localizado na Receita Federal! ${d.situacao_cadastral} em ${d.municipio}/${d.uf}${
          qsaCount > 0 ? ` · ${qsaCount} sócios identificados no QSA` : ""
        }.`
      );
    } catch {
      setSearching(false);
      setFeedbackError(true);
      setFeedback("Erro de conexão ao consultar BrasilAPI.");
    }
  }

  return (
    <form action={action} className="mt-4 pt-3 border-t border-slate-100 space-y-3">
      <input type="hidden" name="process_id" value={processId} />

      {/* Busca Rápida por CNPJ (BrasilAPI) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Automação de Cadastro via CNPJ (Receita Federal)
        </label>
        <div className="flex gap-2">
          <input
            className="field text-xs font-mono flex-1 bg-white"
            placeholder="00.000.000/0000-00 (Opcional - preenche tudo)"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />
          <button
            type="button"
            className="button button-secondary text-xs inline-flex items-center gap-1.5"
            onClick={handleCnpjLookup}
            disabled={searching}
          >
            {searching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
            ) : (
              <Search className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Buscar CNPJ</span>
          </button>
        </div>

        {feedback && (
          <p
            className={`text-xs font-medium flex items-center gap-1.5 ${
              feedbackError ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {feedbackError ? (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Check className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{feedback}</span>
          </p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nome da Parte ou Razão Social</label>
          <input
            className="field text-sm"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Razão Social ou Nome Completo"
            required
          />
        </div>

        <div>
          <label className="label">Papel no Processo</label>
          <input
            className="field text-sm"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex: Autor, Réu, Litisconsorte..."
            required
          />
        </div>

        <div>
          <label className="label">Natureza Jurídica</label>
          <select
            className="field text-sm"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="company">Empresa / Pessoa Jurídica (PJ)</option>
            <option value="person">Pessoa Física (PF)</option>
            <option value="government">Órgão Público</option>
            <option value="other">Outro</option>
          </select>
        </div>

        <div>
          <label className="label">Relação com Santa Lúcia</label>
          <select
            className="field text-sm"
            name="is_client"
            value={isClient}
            onChange={(e) => setIsClient(e.target.value)}
          >
            <option value="false">Parte Contrária (Polo Oposto)</option>
            <option value="true">Cliente ou Grupo Santa Lúcia</option>
          </select>
        </div>

        <div className="flex items-end">
          <button type="submit" className="button w-full text-sm">
            Vincular Parte ao Processo
          </button>
        </div>
      </div>
    </form>
  );
}
