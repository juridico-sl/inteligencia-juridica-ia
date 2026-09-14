import "server-only";

export type CnpjData = {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  situacao_cadastral: string;
  data_situacao_cadastral?: string;
  cnae_fiscal_descricao?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  qsa?: Array<{
    nome_socio: string;
    qualificacao_socio: string;
  }>;
};

export type FeriadoNacional = {
  date: string; // YYYY-MM-DD
  name: string;
  type: string;
};

// Cache simples em memória por 24h para feriados
const holidaysCache = new Map<number, FeriadoNacional[]>();

/**
 * Consulta dados cadastrais oficiais e quadro de sócios (QSA)
 * da Receita Federal via BrasilAPI (gratuita e open source).
 */
export async function fetchCnpjFromBrasilApi(rawCnpj: string): Promise<{
  success: boolean;
  data?: CnpjData;
  error?: string;
}> {
  const cleanCnpj = rawCnpj.replace(/\D/g, "");
  if (cleanCnpj.length !== 14) {
    return { success: false, error: "CNPJ deve conter 14 dígitos numéricos." };
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // cache 24h
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { success: false, error: "CNPJ não localizado na base da Receita Federal." };
      }
      return { success: false, error: `Falha na consulta BrasilAPI (HTTP ${res.status}).` };
    }

    const json = await res.json();
    return {
      success: true,
      data: {
        cnpj: json.cnpj,
        razao_social: json.razao_social,
        nome_fantasia: json.nome_fantasia || null,
        situacao_cadastral: json.descricao_situacao_cadastral || "Ativa",
        data_situacao_cadastral: json.data_situacao_cadastral,
        cnae_fiscal_descricao: json.cnae_fiscal_descricao,
        logradouro: json.logradouro,
        numero: json.numero,
        bairro: json.bairro,
        municipio: json.municipio,
        uf: json.uf,
        cep: json.cep,
        qsa: (json.qsa || []).map((s: { nome_socio: string; qualificacao_socio: string }) => ({
          nome_socio: s.nome_socio,
          qualificacao_socio: s.qualificacao_socio,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro inesperado na consulta CNPJ",
    };
  }
}

/**
 * Consulta feriados nacionais oficiais para cálculo de dias úteis (CPC Art. 219).
 */
export async function fetchFeriadosNacionais(ano: number): Promise<FeriadoNacional[]> {
  if (holidaysCache.has(ano)) {
    return holidaysCache.get(ano)!;
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 604800 }, // cache 7 dias
    });

    if (!res.ok) return [];
    const holidays = (await res.json()) as FeriadoNacional[];
    holidaysCache.set(ano, holidays);
    return holidays;
  } catch {
    return [];
  }
}

/**
 * Verifica se uma data é dia útil forense (não é sábado, domingo ou feriado nacional).
 */
export function isDiaUtilForense(date: Date, feriados: FeriadoNacional[]): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Domingo (0) ou Sábado (6)

  const dateStr = date.toISOString().slice(0, 10);
  return !feriados.some((f) => f.date === dateStr);
}
