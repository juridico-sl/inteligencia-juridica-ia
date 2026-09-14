import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, EmptyState } from "@/components/ui";
import { RefreshProcess, RiskForm, ProcessEditForm, FinancialForm } from "@/components/process-detail-actions";
import { getProcess } from "@/lib/data/processes";
import { formatCnj } from "@/lib/legal";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addNote, addParty } from "./actions";

// Abas simplificadas e intuitivas (com aliases para retrocompatibilidade)
const TAB_ALIASES: Record<string, string> = {
  resumo: "visao-geral",
  partes: "visao-geral",
  notas: "visao-geral",
  historico: "visao-geral",
  movimentacoes: "andamentos",
  prazos: "andamentos",
  tarefas: "andamentos",
  risco: "financeiro",
  auditoria: "visao-geral",
  ia: "visao-geral",
};

const VALID_TABS = ["visao-geral", "andamentos", "documentos", "financeiro"] as const;
type TabKey = typeof VALID_TABS[number];

const TAB_LABELS: Record<TabKey, { label: string; icon: string }> = {
  "visao-geral": { label: "Visão Geral & Dados Oficiais", icon: "🏛️" },
  andamentos: { label: "Andamentos & Prazos", icon: "⚡" },
  documentos: { label: "Documentos & Peças", icon: "📁" },
  financeiro: { label: "Risco & Financeiro", icon: "💰" },
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function ProcessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission("process.read");
  const { id } = await params;
  const query = await searchParams;

  const rawTab = query.tab ?? "visao-geral";
  const resolvedTab = (TAB_ALIASES[rawTab] || rawTab) as TabKey;
  const currentTab: TabKey = VALID_TABS.includes(resolvedTab) ? resolvedTab : "visao-geral";

  const process = await getProcess(id);
  if (!process) notFound();

  const company = process.companies as { trade_name?: string; legal_name?: string } | null;
  const unit = process.business_units as { name?: string } | null;
  const category = process.categories as { name?: string } | null;
  const responsible = process.profiles as { full_name?: string; email?: string } | null;
  const firm = process.law_firms as { name?: string } | null;
  const metadata = (process.metadata as Record<string, unknown>) || {};

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
              {process.court_name ?? process.court ?? "Tribunal"}
            </span>
            {process.last_synced_at && (
              <span className="rounded bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 flex items-center gap-1">
                <span>✓</span> Sincronizado com DataJud
              </span>
            )}
            <span className="rounded bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 capitalize">
              Status: {process.status}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCnj(process.process_number)}
          </h1>
          <p className="text-sm text-slate-600">
            {process.judicial_class ?? "Classe não informada"} ·{" "}
            {process.judging_body ?? "Órgão julgador não informado"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/chat?process_id=${id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <span>🤖</span> Conversar com IA
          </Link>
          <RefreshProcess id={id} />
        </div>
      </div>

      {process.last_sync_error && (
        <div className="card mb-4 border-l-4 border-l-amber-500 bg-amber-50/50 p-4 text-sm text-amber-900">
          <p className="font-bold">Aviso de sincronização do DataJud:</p>
          <p className="mt-0.5 text-xs">{process.last_sync_error}</p>
          <p className="mt-1 text-[11px] text-amber-700">
            Dados anteriores preservados. Último sucesso:{" "}
            {process.last_synced_at ? new Date(process.last_synced_at).toLocaleString("pt-BR") : "nenhum"}.
          </p>
        </div>
      )}

      {/* Navegação simplificada em 4 abas objetivas */}
      <nav
        className="mb-6 flex gap-2 border-b border-slate-200"
        aria-label="Navegação do processo"
      >
        {VALID_TABS.map((tabKey) => {
          const { label, icon } = TAB_LABELS[tabKey];
          const active = currentTab === tabKey;
          return (
            <Link
              key={tabKey}
              href={`?tab=${tabKey}`}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition whitespace-nowrap ${
                active
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Conteúdo da Aba Selecionada */}
      {currentTab === "visao-geral" && (
        <TabVisaoGeral
          process={process}
          id={id}
          company={company}
          unit={unit}
          category={category}
          responsible={responsible}
          firm={firm}
          metadata={metadata}
        />
      )}

      {currentTab === "andamentos" && <TabAndamentos id={id} />}

      {currentTab === "documentos" && <TabDocumentos id={id} />}

      {currentTab === "financeiro" && <TabFinanceiro process={process} id={id} />}
    </>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ==========================================
// ABA 1: VISÃO GERAL & DADOS OFICIAIS
// ==========================================
async function TabVisaoGeral({
  process,
  id,
  company,
  unit,
  category,
  responsible,
  firm,
  metadata,
}: {
  process: Record<string, unknown>;
  id: string;
  company: { trade_name?: string; legal_name?: string } | null;
  unit: { name?: string } | null;
  category: { name?: string } | null;
  responsible: { full_name?: string; email?: string } | null;
  firm: { name?: string } | null;
  metadata: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const parties = (process.process_parties as {
    role: string;
    is_client: boolean;
    parties: { name: string; type: string; document_masked?: string };
  }[]) || [];

  const { data: notes } = await supabase
    .from("notes")
    .select("id,created_at,content,profiles!notes_author_id_fkey(full_name)")
    .eq("process_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(15);

  const assuntos = Array.isArray(metadata.assuntos) ? metadata.assuntos : [];

  return (
    <div className="space-y-6">
      {/* 1. Bloco de Dados Oficiais CNJ / DataJud */}
      <section className="card p-5 border-l-4 border-l-blue-600">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏛️</span>
            <h2 className="text-base font-black text-slate-900">
              Dados Oficiais do Poder Judiciário (DataJud)
            </h2>
          </div>
          <span className="rounded bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
            Fonte: Base Pública CNJ
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="label">Tribunal & Grau</p>
            <p className="font-bold text-slate-800">
              {String(process.court_name || process.court || "Não informado")} ·{" "}
              {String(metadata.grau || "Grau não informado")}
            </p>
          </div>
          <div>
            <p className="label">Vara / Órgão Julgador</p>
            <p className="font-bold text-slate-800">
              {String(process.judging_body || "Não informado")}
            </p>
          </div>
          <div>
            <p className="label">Classe Processual (TPU/CNJ)</p>
            <p className="font-bold text-slate-800">
              {String(process.judicial_class || "Não informada")}
            </p>
          </div>
          <div>
            <p className="label">Data de Ajuizamento / Distribuição</p>
            <p className="font-bold text-slate-800">
              {process.filing_date
                ? new Date(String(process.filing_date)).toLocaleDateString("pt-BR")
                : "Não informada"}
            </p>
          </div>
          <div>
            <p className="label">Sistema de Tramitação</p>
            <p className="font-bold text-slate-800">
              {String(metadata.sistema || "PJe / e-SAJ / Projudi")} (
              {String(metadata.formato || "Eletrônico")})
            </p>
          </div>
          <div>
            <p className="label">Nível de Sigilo</p>
            <p className="font-bold text-slate-800">
              {metadata.nivel_sigilo ? "🔒 Segredo de Justiça" : "🔓 Processo Público"}
            </p>
          </div>
        </div>

        {assuntos.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="label">Assuntos CNJ</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {assuntos.map((assunto, i) => (
                <span
                  key={i}
                  className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {String(assunto)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. Grid com Partes e Gestão Interna */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bloco de Partes */}
        <section className="card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900">👥 Partes Envolvidas</h2>
            <span className="text-xs text-slate-500">{parties.length} registradas</span>
          </div>

          <div className="mt-3 space-y-2">
            {parties.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                Nenhuma parte vinculada ainda. Preencha abaixo para cadastrar polos ativo/passivo.
              </p>
            ) : (
              parties.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-sm"
                >
                  <div>
                    <p className="font-bold text-slate-800">{p.parties.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.role} · {p.parties.type}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      p.is_client
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {p.is_client ? "Cliente" : "Parte Contrária"}
                  </span>
                </div>
              ))
            )}
          </div>

          <form action={addParty} className="mt-4 pt-3 border-t border-slate-100 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="process_id" value={id} />
            <input
              className="field sm:col-span-2 text-sm"
              name="name"
              placeholder="Nome da parte / empresa"
              required
            />
            <input className="field text-sm" name="role" placeholder="Papel (Autor, Réu...)" required />
            <select className="field text-sm" name="type">
              <option value="company">Empresa (PJ)</option>
              <option value="person">Pessoa Física (PF)</option>
              <option value="government">Órgão Público</option>
              <option value="other">Outro</option>
            </select>
            <select className="field text-sm" name="is_client">
              <option value="false">Parte Contrária</option>
              <option value="true">Cliente da Empresa</option>
            </select>
            <button className="button text-sm">Vincular Parte</button>
          </form>
        </section>

        {/* Bloco de Gestão Interna & Monitoramento */}
        <section className="card p-5">
          <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
            🏢 Gestão Interna & Responsáveis
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="label">Empresa</p>
              <p className="font-bold">{company?.trade_name ?? company?.legal_name ?? "—"}</p>
            </div>
            <div>
              <p className="label">Unidade de Negócio</p>
              <p className="font-bold">{unit?.name ?? "—"}</p>
            </div>
            <div>
              <p className="label">Escritório Externo</p>
              <p className="font-bold">{firm?.name ?? "—"}</p>
            </div>
            <div>
              <p className="label">Advogado Responsável</p>
              <p className="font-bold">{responsible?.full_name ?? responsible?.email ?? "—"}</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <ProcessEditForm
              id={id}
              initial={{
                status: String(process.status),
                notes: process.notes as string | null,
                monitoring_enabled: Boolean(process.monitoring_enabled),
                monitoring_frequency: String(process.monitoring_frequency || "0 6 * * *"),
              }}
            />
          </div>
        </section>
      </div>

      {/* 3. Bloco de Notas Internas da Equipe */}
      <section className="card p-5">
        <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
          📝 Notas & Observações Internas
        </h2>

        <form action={addNote} className="mt-4 space-y-2">
          <input type="hidden" name="process_id" value={id} />
          <textarea
            className="field min-h-20 text-sm"
            name="content"
            placeholder="Adicione uma nota de andamento ou observação estratégica..."
            required
          />
          <button className="button text-sm">Salvar Nota</button>
        </form>

        <div className="mt-4 space-y-2">
          {(!notes || notes.length === 0) ? (
            <p className="text-xs text-slate-500">Nenhuma nota interna registrada.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold text-slate-700">
                    {(n.profiles as unknown as { full_name?: string } | null)?.full_name ?? "Usuário"}
                  </span>
                  <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <p className="text-slate-800 whitespace-pre-wrap">{n.content}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ==========================================
// ABA 2: ANDAMENTOS & PRAZOS
// ==========================================
async function TabAndamentos({ id }: { id: string }) {
  const supabase = await createClient();

  const [movementsRes, deadlinesRes, tasksRes] = await Promise.all([
    supabase
      .from("process_movements")
      .select("id,movement_date,movement_code,movement_type,description,source,ai_summary,ai_relevance")
      .eq("process_id", id)
      .order("movement_date", { ascending: false })
      .limit(100),
    supabase
      .from("deadlines")
      .select("id,due_at,title,status,priority,origin")
      .eq("process_id", id)
      .is("deleted_at", null)
      .order("due_at", { ascending: true })
      .limit(20),
    supabase
      .from("tasks")
      .select("id,due_at,title,status,priority,origin")
      .eq("process_id", id)
      .is("deleted_at", null)
      .order("due_at", { ascending: true })
      .limit(20),
  ]);

  const movements = movementsRes.data || [];
  const deadlines = deadlinesRes.data || [];
  const tasks = tasksRes.data || [];

  return (
    <div className="space-y-6">
      {/* Alerta de Transparência sobre DataJud */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 flex items-start gap-3">
        <span className="text-base">ℹ️</span>
        <div>
          <strong className="block text-sm">Como funciona o sincronismo DataJud:</strong>
          As movimentações abaixo são extraídas da base oficial do CNJ (Tabelas Processuais Unificadas - TPU). 
          Os prazos e tarefas são gerenciados internamente ou sugeridos pela inteligência artificial.
        </div>
      </div>

      {/* Resumo de Prazos e Tarefas Ativas */}
      {(deadlines.length > 0 || tasks.length > 0) && (
        <section className="card p-5 border-l-4 border-l-orange-500">
          <h2 className="text-base font-black text-slate-900 pb-2 border-b border-slate-100">
            ⏰ Prazos e Tarefas Pendentes
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {deadlines.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-orange-100 bg-orange-50/40 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-900">{d.title}</span>
                  <span className="rounded bg-orange-200 px-2 py-0.5 text-[11px] font-bold text-orange-800 uppercase">
                    Prazo: {d.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Vencimento: {new Date(d.due_at).toLocaleDateString("pt-BR")} · Prioridade: {d.priority}
                </p>
              </div>
            ))}
            {tasks.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{t.title}</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 uppercase">
                    Tarefa: {t.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Prazo: {t.due_at ? new Date(t.due_at).toLocaleDateString("pt-BR") : "Sem prazo"} ·{" "}
                  Prioridade: {t.priority}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Linha do Tempo Oficial de Movimentações */}
      <section className="card p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900">
            📜 Histórico Oficial de Movimentações ({movements.length})
          </h2>
          <span className="text-xs text-slate-500">Ordenado por data decrescente</span>
        </div>

        {movements.length === 0 ? (
          <EmptyState>
            Nenhuma movimentação registrada. Clique em &quot;Sincronizar DataJud&quot; acima para buscar o histórico oficial do tribunal.
          </EmptyState>
        ) : (
          <div className="mt-4 space-y-3">
            {movements.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                      {m.source}
                    </span>
                    {m.movement_code && (
                      <span className="text-xs text-slate-400 font-mono">
                        Cód. {m.movement_code}
                      </span>
                    )}
                    <span className="text-sm font-bold text-slate-900">{m.movement_type}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {new Date(m.movement_date).toLocaleString("pt-BR")}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{m.description}</p>

                {m.ai_summary && (
                  <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-700">
                    <span className="font-bold text-slate-900">🤖 Análise da IA: </span>
                    {m.ai_summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ==========================================
// ABA 3: DOCUMENTOS & PEÇAS PROCESSUAIS
// ==========================================
async function TabDocumentos({ id }: { id: string }) {
  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("id,name,type,created_at,extraction_status,ocr_status,storage_path")
    .eq("process_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const docs = documents || [];

  return (
    <div className="space-y-6">
      {/* Banner de Rigor Metodológico */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3">
        <span className="text-base">⚠️</span>
        <div>
          <strong className="block text-sm">Importante sobre documentos e PDFs:</strong>
          A API Pública do DataJud <strong>não fornece arquivos de petições, sentenças ou PDFs dos autos</strong>.
          Para que a inteligência artificial analise peças, contratos e laudos, você deve anexar os arquivos diretamente aqui ou no módulo de documentos.
        </div>
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900">
              📁 Peças Anexadas ao Processo ({docs.length})
            </h2>
            <p className="text-xs text-slate-500">Documentos lidos por OCR e indexados para IA</p>
          </div>
          <Link
            href="/documentos"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            + Novo Upload
          </Link>
        </div>

        {docs.length === 0 ? (
          <EmptyState>
            Nenhum documento anexado a este processo. Vá até o módulo de Documentos para fazer o upload da petição inicial, contestação ou laudos.
          </EmptyState>
        ) : (
          <div className="mt-4 table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome do Documento</th>
                  <th>Tipo</th>
                  <th>Data de Envio</th>
                  <th>Status OCR</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <strong>{doc.name}</strong>
                    </td>
                    <td>{doc.type}</td>
                    <td>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <span className="badge">{doc.ocr_status || "Concluído"}</span>
                    </td>
                    <td>
                      <a
                        href={`/api/v1/documents/${doc.id}/download`}
                        className="font-bold text-orange-600 hover:underline text-xs"
                      >
                        Baixar Arquivo
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ==========================================
// ABA 4: RISCO & FINANCEIRO
// ==========================================
async function TabFinanceiro({
  process,
  id,
}: {
  process: Record<string, unknown>;
  id: string;
}) {
  const supabase = await createClient();

  const [riskHistoryRes, finHistoryRes] = await Promise.all([
    supabase
      .from("process_risk_history")
      .select(
        "new_level,new_probability,new_impact,reason,created_at,profiles!process_risk_history_changed_by_fkey(full_name)"
      )
      .eq("process_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("process_financial_history")
      .select("created_at,field,previous_value,new_value,reason")
      .eq("process_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const riskHistory = riskHistoryRes.data || [];
  const finHistory = finHistoryRes.data || [];

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Financeiras */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Valor da Causa"
          value={money.format(Number(process.claim_value ?? 0))}
          sub="Atribuído na petição inicial"
        />
        <MetricCard
          label="Exposição Estimada"
          value={money.format(Number(process.estimated_exposure ?? 0))}
          sub="Cálculo de risco potencial"
        />
        <MetricCard
          label="Provisão Contábil (CPC 25)"
          value={money.format(Number(process.provision ?? 0))}
          sub={`Risco classificado: ${String(process.risk_level ?? "Não classificado")}`}
        />
        <MetricCard
          label="Acordo / Condenação"
          value={money.format(Number(process.settlement_value ?? 0))}
          sub={`Pago: ${money.format(Number(process.paid_value ?? 0))}`}
        />
      </div>

      {/* Formulários e Histórico de Risco e Financeiro */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gestão de Risco */}
        <section className="card p-5">
          <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
            ⚖️ Classificação de Risco Processual
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Ajuste o nível de probabilidade (remota, possível, provável) e impacto estimado com motivo formal.
          </p>
          <div className="mt-3">
            <RiskForm id={id} current={String(process.risk_level ?? "medium")} />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Histórico de Alterações de Risco</h3>
            {riskHistory.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma alteração registrada.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {riskHistory.map((rh, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                    <div className="flex justify-between font-semibold">
                      <span className="capitalize text-slate-900">Nível: {rh.new_level}</span>
                      <span className="text-slate-500">{new Date(rh.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <p className="text-slate-600 mt-0.5">Motivo: {rh.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Lançamento Financeiro */}
        <section className="card p-5">
          <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
            💵 Gestão Financeira & Provisões
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Atualize provisões, valores de causa, depósitos judiciais ou acordos.
          </p>
          <div className="mt-3">
            <FinancialForm id={id} />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Histórico de Lançamentos</h3>
            {finHistory.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum lançamento financeiro registrado.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {finHistory.map((fh, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-900">{fh.field}: {money.format(Number(fh.new_value))}</span>
                      <span className="text-slate-500">{new Date(fh.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <p className="text-slate-600 mt-0.5">Motivo: {fh.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
