import "server-only";

export interface DataJudMovement {
  codigo?: number | string;
  nome: string;
  dataHora: string;
  descricao?: string;
  complementos?: string[];
  orgaoJulgador?: string;
}

export interface DataJudParty {
  nome: string;
  tipo?: "person" | "company" | "government" | "other";
  polo: "polo_ativo" | "polo_passivo" | "outro";
}

export interface DataJudProcessResult {
  found: boolean;
  processNumber: string;
  tribunal: string;
  grau?: string;
  classeNome?: string;
  classeCodigo?: number;
  orgaoJulgador?: string;
  dataAjuizamento?: string;
  sistema?: string;
  formato?: string;
  nivelSigilo?: number;
  assuntos?: string[];
  movimentacoes: DataJudMovement[];
  partes?: DataJudParty[];
  rawSource?: Record<string, unknown>;
  error?: string;
}

const TJ_MAP: Record<string, string> = {
  "01": "tjac", "02": "tjal", "03": "tjap", "04": "tjam", "05": "tjba",
  "06": "tjce", "07": "tjdft", "08": "tjes", "09": "tjgo", "10": "tjma",
  "11": "tjmt", "12": "tjms", "13": "tjmg", "14": "tjpa", "15": "tjpb",
  "16": "tjpr", "17": "tjpe", "18": "tjpi", "19": "tjrj", "20": "tjrn",
  "21": "tjrs", "22": "tjro", "23": "tjrr", "24": "tjsc", "25": "tjse",
  "26": "tjsp", "27": "tjto",
};

export function getTribunalAliasFromCnj(cnj: string): string | null {
  const clean = cnj.replace(/\D/g, "");
  if (clean.length !== 20) return null;

  const j = clean[13];
  const tr = clean.slice(14, 16);

  if (j === "8") return TJ_MAP[tr] ?? null;
  if (j === "4") {
    const num = parseInt(tr, 10);
    return num >= 1 && num <= 6 ? `trf${num}` : null;
  }
  if (j === "5") {
    if (tr === "00") return "tst";
    const num = parseInt(tr, 10);
    return num >= 1 && num <= 24 ? `trt${num}` : null;
  }
  if (j === "3") return "stj";
  if (j === "1") return "stf";
  return null;
}

export async function fetchProcessFromDatajud(
  rawCnj: string,
  courtOverride?: string
): Promise<DataJudProcessResult> {
  const cleanCnj = rawCnj.replace(/\D/g, "");
  const tribunal = (courtOverride || getTribunalAliasFromCnj(cleanCnj) || "").toLowerCase();

  if (!tribunal) {
    return {
      found: false,
      processNumber: rawCnj,
      tribunal: "",
      movimentacoes: [],
      error: "Não foi possível identificar o tribunal a partir do número CNJ informado.",
    };
  }

  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) {
    return {
      found: false,
      processNumber: rawCnj,
      tribunal,
      movimentacoes: [],
      error: "Chave DATAJUD_API_KEY não configurada no ambiente.",
    };
  }

  const endpoint = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal}/_search`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          match: {
            numeroProcesso: cleanCnj,
          },
        },
        size: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        found: false,
        processNumber: rawCnj,
        tribunal,
        movimentacoes: [],
        error: `DataJud retornou status ${response.status} (${errorText.slice(0, 100)})`,
      };
    }

    const data = await response.json();
    const hits = data?.hits?.hits;

    if (!hits || hits.length === 0) {
      return {
        found: false,
        processNumber: rawCnj,
        tribunal,
        movimentacoes: [],
        error: "Processo não localizado na API pública do DataJud (pode estar em segredo de justiça ou não indexado).",
      };
    }

    const source = hits[0]._source;
    const rawMovimentos = Array.isArray(source.movimentos) ? source.movimentos : [];

    const movimentacoes: DataJudMovement[] = rawMovimentos.map((m: Record<string, unknown>) => {
      const comps = Array.isArray(m.complementosTabelados)
        ? m.complementosTabelados
            .map((c: Record<string, unknown>) => `${c.descricao ?? ""}: ${c.nome ?? c.valor ?? ""}`.trim())
            .filter(Boolean)
        : [];

      return {
        codigo: (m.codigo as number | string) ?? undefined,
        nome: (m.nome as string) || "Movimentação",
        dataHora: (m.dataHora as string) || new Date().toISOString(),
        complementos: comps.length > 0 ? comps : undefined,
        orgaoJulgador: (m.orgaoJulgador as { nome?: string })?.nome,
      };
    });

    movimentacoes.sort(
      (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
    );

    const assuntos = Array.isArray(source.assuntos)
      ? source.assuntos
          .map((a: Record<string, unknown>) => (a.nome as string) || "")
          .filter(Boolean)
      : [];

    let filingDate: string | undefined = undefined;
    if (source.dataAjuizamento) {
      const rawDate = String(source.dataAjuizamento);
      if (rawDate.length === 14) {
        // Formato YYYYMMDDHHmmss
        filingDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T${rawDate.slice(8, 10)}:${rawDate.slice(10, 12)}:${rawDate.slice(12, 14)}Z`;
      } else {
        filingDate = rawDate;
      }
    }

    return {
      found: true,
      processNumber: source.numeroProcesso || cleanCnj,
      tribunal: source.tribunal || tribunal.toUpperCase(),
      grau: source.grau,
      classeNome: source.classe?.nome,
      classeCodigo: source.classe?.codigo,
      orgaoJulgador: source.orgaoJulgador?.nome,
      dataAjuizamento: filingDate,
      sistema: source.sistema?.nome,
      formato: source.formato?.nome,
      nivelSigilo: source.nivelSigilo,
      assuntos,
      movimentacoes,
      rawSource: source,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      found: false,
      processNumber: rawCnj,
      tribunal,
      movimentacoes: [],
      error: `Falha ao conectar na API DataJud: ${message}`,
    };
  }
}
