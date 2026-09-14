"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function deleteDocument(form: FormData) {
  const { user } = await requirePermission("document.delete");
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = await createClient();
  const { data, error } = await supabase
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
  const id = z.string().uuid().parse(form.get("id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ extraction_status: "pending", ocr_status: "pending" })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new Error("Não foi possível solicitar reprocessamento");
  await supabase.from("jobs").insert({
    task: "extract_document",
    payload: { document_id: id },
    dedupe_key: `extract:${id}:${Date.now()}`
  });
  await audit("reprocess", "document", id);
  revalidatePath("/documentos");
}
