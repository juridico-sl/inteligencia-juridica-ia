import "server-only";

export type BcbSerieData = {
  data: string; // DD/MM/AAAA
  valor: string; // ex: "0.42"
};

export type CorrectionResult = {
  initialValue: number;
  startDate: string;
  endDate: string;
  factor: number;
  correctedValue: number;
  indexName: string;
  source: string;
};

// Cache simples em memória por 6 horas
const correctionCache = new Map<string, CorrectionResult>();

function formatDateBcb(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Consulta a API oficial do Banco Central do Brasil (SGS)
 * Série 433: IPCA Mensal (Índice Nacional de Preços ao Consumidor Amplo)
 * Série 11: Taxa Selic Acumulada
 */
export async function calculateBcbCorrection({
  value,
  startDate,
  endDate = new Date(),
  serie = 433, // 433 = IPCA
}: {
  value: number;
  startDate: string | Date;
  endDate?: string | Date;
  serie?: number;
}): Promise<CorrectionResult> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end || value <= 0) {
    return {
      initialValue: value,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      factor: 1,
      correctedValue: value,
      indexName: serie === 433 ? "IPCA (IBGE/BACEN)" : "Selic (BACEN)",
      source: "Banco Central do Brasil (SGS)",
    };
  }

  const cacheKey = `${value}_${serie}_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`;
  if (correctionCache.has(cacheKey)) {
    return correctionCache.get(cacheKey)!;
  }

  const dataInicial = formatDateBcb(start);
  const dataFinal = formatDateBcb(end);

  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CentralJuridica/1.0",
      },
      next: { revalidate: 43200 }, // cache 12h no Next.js
    });

    if (!res.ok) {
      throw new Error(`BACEN API HTTP ${res.status}`);
    }

    const points = (await res.json()) as BcbSerieData[];
    let accumulatedFactor = 1.0;

    for (const p of points) {
      const rate = parseFloat(p.valor.replace(",", "."));
      if (!isNaN(rate)) {
        accumulatedFactor *= 1 + rate / 100;
      }
    }

    const corrected = Math.round(value * accumulatedFactor * 100) / 100;
    const result: CorrectionResult = {
      initialValue: value,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      factor: Math.round(accumulatedFactor * 10000) / 10000,
      correctedValue: corrected,
      indexName: serie === 433 ? "IPCA (IBGE/BACEN)" : "Selic (BACEN)",
      source: "Banco Central do Brasil (SGS)",
    };

    correctionCache.set(cacheKey, result);
    return result;
  } catch (error) {
    // Fallback gracioso: não quebra a tela, apenas mantém o valor nominal
    return {
      initialValue: value,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      factor: 1,
      correctedValue: value,
      indexName: "Nominal (Sem correção no momento)",
      source: "Banco Central do Brasil (SGS - Indisponível)",
    };
  }
}
