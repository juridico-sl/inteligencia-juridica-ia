import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MimoClient } from "@/lib/ai/client";
import { chunkLegalDocument, extractText, verifyInternalSecret } from "@/lib/documents";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  if (!verifyInternalSecret(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = z.object({ id: z.uuid() }).parse(await request.json());
  const admin = createAdminClient(), { data: document, error } = await admin.from("documents").select("id,name,mime_type,storage_path,process_id,type,ocr_status,uploaded_by").eq("id", id).is("deleted_at", null).single();
  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const runId = randomUUID();
  try {
    let categoryId: string | null = null;
    if (document.process_id) { const { data: process, error: processError } = await admin.from("processes").select("category_id").eq("id", document.process_id).maybeSingle(); if(processError)throw processError; categoryId = process?.category_id ?? null; }
    const { error: statusError } = await admin.from("documents").update({ extraction_status: "processing", ocr_status: document.mime_type.startsWith("image/") ? "processing" : document.ocr_status }).eq("id", id);
    if(statusError)throw statusError;
    const { data: file, error: downloadError } = await admin.storage.from("legal-documents").download(document.storage_path);
    if (downloadError) throw downloadError;
    const pages = await extractText(new Uint8Array(await file.arrayBuffer()), document.mime_type, document.name), chunks = chunkLegalDocument(pages);
    if (!chunks.length) throw new Error("Nenhum texto extraído");
    const ai = new MimoClient();
    for (let i = 0; i < chunks.length; i += 10) {
      const rows = await Promise.all(chunks.slice(i, i + 10).map(async chunk => ({ ...chunk, run_id: runId, document_id: id, metadata: { ...chunk.metadata, process_id: document.process_id, category_id: categoryId, document_id: id, document_name: document.name, document_type: document.type }, embedding: await ai.embed(chunk.content) })));
      const { error: stageError } = await admin.from("document_chunk_staging").insert(rows);
      if (stageError) throw stageError;
    }
    const fullText = pages.map(page => `[Página ${page.page}]\n${page.text}`).join("\n\n"), ocrUsed = pages.some(page => page.ocr);
    const usage=ai.getUsage(),{error:usageError}=await admin.from("ai_usage_logs").insert({user_id:document.uploaded_by,feature:"document_embedding",model:process.env.MIMO_EMBEDDING_MODEL??"unknown",input_tokens:usage.input_tokens,output_tokens:usage.output_tokens,success:true});
    if(usageError)console.error(JSON.stringify({event:"ai_usage_log_failed",feature:"document_embedding",document_id:id}));
    const { data: count, error: finalizeError } = await admin.rpc("finalize_document_chunks", { p_run_id: runId, p_document_id: id, p_extracted_text: fullText, p_ocr_status: ocrUsed ? "completed" : "not_required", p_metadata: { pages: pages.length, chunks: chunks.length, embedding_status: "completed", ocr_used: ocrUsed } });
    if (finalizeError) throw finalizeError;
    return NextResponse.json({ pages: pages.length, chunks: count });
  } catch (error) {
    await admin.from("document_chunk_staging").delete().eq("run_id", runId);
    await admin.from("documents").update({ extraction_status: "failed", ocr_status: "failed", metadata: { processing_error: error instanceof Error ? error.name : "Error" } }).eq("id", id);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
