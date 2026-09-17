"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit, enforceRateLimit } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteDocument(form: FormData) {
  const { user } = await requirePermission("document.delete");
  const id = z.string().uuid().parse(form.get("id"));
  const { data, error } = await createAdminClient()
    .from("documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível excluir o documento");
  await audit("archive", "document", id);
  revalidatePath("/documentos");
}

export async function reprocessDocument(form: FormData) {
  await requirePermission("document.upload");
  await enforceRateLimit("document-reprocess", 5, 300);
  const id = z.string().uuid().parse(form.get("id"));
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("documents")
    .update({ extraction_status: "pending", ocr_status: "pending" })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível solicitar reprocessamento");
  const { error: queueError } = await admin.from("job_queue").insert({
    type: "extract_document",
    payload: { document_id: id },
    idempotency_key: `extract:${id}:${randomUUID()}`
  });
  if (queueError) throw new Error("Não foi possível agendar o reprocessamento");
  await audit("reprocess", "document", id);
  revalidatePath("/documentos");
}
