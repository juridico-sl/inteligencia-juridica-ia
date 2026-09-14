import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui";
import { DocumentUpload } from "@/components/document-upload";
import { requirePermission } from "@/lib/auth";
import { formatCnj } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import { deleteDocument, reprocessDocument } from "./actions";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "completed" ? "badge-success" : status === "failed" ? "badge-urgent" : status === "processing" ? "badge-warning" : "badge";
  return <span className={`badge ${tone}`}>{status}</span>;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; process_id?: string }>;
}) {
  await requirePermission("document.read");
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: processes }, { data: documents }] = await Promise.all([
    supabase.from("processes").select("id, process_number").is("deleted_at", null).order("process_number"),
    (() => {
      let query = supabase
        .from("documents")
        .select("id, name, type, mime_type, size, extraction_status, ocr_status, process_id, created_at, storage_path, processes(id, process_number), profiles!documents_uploaded_by_fkey(full_name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (params.q) query = query.ilike("name", `%${params.q}%`);
      if (params.type) query = query.eq("type", params.type);
      if (params.status) query = query.eq("extraction_status", params.status);
      if (params.process_id) query = query.eq("process_id", params.process_id);
      return query;
    })(),
  ]);

  const documentTypes = [
    "petição", "sentença", "acórdão", "parecer", "contrato", "notificação",
    "procuração", "auto de infração", "acordo", "laudo", "relatório",
    "comprovante", "correspondência", "regulatório", "ambiental", "tributário",
    "trabalhista", "outro"
  ];

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Gestão, validação segura, extração automatizada e RAG de documentos jurídicos."
      />

      <DocumentUpload processes={processes ?? []} />

      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" method="GET">
        <input
          className="field"
          name="q"
          placeholder="Buscar por nome do arquivo…"
          defaultValue={params.q ?? ""}
        />
        <select className="field" name="type" defaultValue={params.type ?? ""}>
          <option value="">Todos os tipos</option>
          {documentTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className="field" name="status" defaultValue={params.status ?? ""}>
          <option value="">Todos os status de extração</option>
          <option value="pending">Pendente</option>
          <option value="processing">Processando</option>
          <option value="completed">Concluído</option>
          <option value="failed">Falha</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className="button flex-1">Filtrar</button>
          {(params.q || params.type || params.status || params.process_id) && (
            <Link href="/documentos" className="button button-secondary">Limpar</Link>
          )}
        </div>
      </form>

      <section className="card table-wrap">
        {!documents || documents.length === 0 ? (
          <EmptyState>Nenhum documento encontrado.</EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Processo</th>
                <th>Tamanho</th>
                <th>Extração</th>
                <th>OCR</th>
                <th>Enviado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const proc = doc.processes as unknown as { id: string; process_number: string } | null;
                const author = doc.profiles as unknown as { full_name: string } | null;
                return (
                  <tr key={doc.id}>
                    <td className="font-semibold">
                      <div className="max-w-xs truncate" title={doc.name}>
                        {doc.name}
                      </div>
                      <span className="text-xs text-slate-400">{doc.mime_type}</span>
                    </td>
                    <td>
                      <span className="badge">{doc.type}</span>
                    </td>
                    <td>
                      {proc ? (
                        <Link
                          href={`/processos/${proc.id}?tab=documentos`}
                          className="font-medium text-orange-600 hover:underline"
                        >
                          {formatCnj(proc.process_number)}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Geral</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-sm text-slate-600">
                      {formatBytes(Number(doc.size))}
                    </td>
                    <td>
                      <StatusBadge status={doc.extraction_status} />
                    </td>
                    <td>
                      <StatusBadge status={doc.ocr_status} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      <p>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</p>
                      {author?.full_name && <p className="text-slate-400">{author.full_name}</p>}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/v1/documents/${doc.id}/download`}
                          className="button button-secondary text-xs"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Baixar
                        </a>
                        {(doc.extraction_status === "failed" || doc.extraction_status === "pending") && (
                          <form action={reprocessDocument}>
                            <input type="hidden" name="id" value={doc.id} />
                            <button type="submit" className="button button-secondary text-xs">
                              Reprocessar
                            </button>
                          </form>
                        )}
                        <form action={deleteDocument}>
                          <input type="hidden" name="id" value={doc.id} />
                          <button
                            type="submit"
                            className="button button-danger text-xs text-white"
                            aria-label={`Excluir ${doc.name}`}
                          >
                            Excluir
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
