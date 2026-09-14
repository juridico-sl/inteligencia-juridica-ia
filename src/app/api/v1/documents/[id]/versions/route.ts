import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { ALLOWED_MIME, hasValidSignature, safeFileName, scanFile, sha256 } from "@/lib/documents";
import { apiError } from "@/lib/http";
import { audit, enforceRateLimit } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await authorizePermission("document.upload");
    await enforceRateLimit("document-upload", 10, 300);
    const { id } = await params, form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "Tipo não permitido" }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(file.type, bytes)) return NextResponse.json({ error: "Assinatura inválida" }, { status: 415 });
    await scanFile(bytes, file.name, file.type);
    const supabase = await createClient(), { data: document, error } = await supabase.from("documents").select("id").eq("id", id).is("deleted_at", null).single();
    if (error || !document) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    const admin = createAdminClient(), path = `${user.id}/${randomUUID()}/${safeFileName(file.name)}`, digest = sha256(bytes);
    const { error: uploadError } = await admin.storage.from("legal-documents").upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "private, max-age=0" });
    if (uploadError) throw uploadError;
    const { data: version, error: versionError } = await admin.rpc("register_document_version", { p_document_id: id, p_name: file.name, p_storage_path: path, p_mime_type: file.type, p_size: file.size, p_sha256: digest, p_created_by: user.id, p_ocr_status: file.type.startsWith("image/") ? "pending" : "not_required" });
    if (versionError) { await admin.storage.from("legal-documents").remove([path]); throw versionError; }
    await audit("version_upload", "document", id, { version });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) { return apiError(error); }
}
