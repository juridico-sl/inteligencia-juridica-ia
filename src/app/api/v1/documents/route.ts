import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizePermission } from "@/lib/auth";
import { ALLOWED_MIME, hasValidSignature, safeFileName, scanFile, sha256 } from "@/lib/documents";
import { apiError } from "@/lib/http";
import { audit, enforceRateLimit } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    await authorizePermission("document.read");
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
    const supabase = await createClient();
    const { data, count, error } = await supabase.from("documents").select("id,name,type,mime_type,size,extraction_status,ocr_status,process_id,created_at", { count: "exact" }).is("deleted_at", null).order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
    if (error) throw error;
    return NextResponse.json({ data, total: count ?? 0, page });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await authorizePermission("document.upload");
    await enforceRateLimit("document-upload", 10, 300);
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Arquivo inválido ou maior que 50 MB" }, { status: 400 });
    if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(file.type, bytes)) return NextResponse.json({ error: "Conteúdo do arquivo não corresponde ao tipo informado" }, { status: 415 });
    await scanFile(bytes, file.name, file.type);
    const processId = z.union([z.uuid(), z.literal("")]).parse(form.get("process_id") ?? "");
    const knowledgeId = z.union([z.uuid(), z.literal("")]).parse(form.get("knowledge_item_id") ?? "");
    const type = z.string().trim().min(2).max(80).parse(form.get("type"));
    const admin = createAdminClient(), path = `${user.id}/${randomUUID()}/${safeFileName(file.name)}`, digest = sha256(bytes);
    const upload = await admin.storage.from("legal-documents").upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "private, max-age=0" });
    if (upload.error) throw upload.error;
    const { data: id, error } = await admin.rpc("register_document_upload", { p_process_id: processId || null, p_knowledge_item_id: knowledgeId || null, p_name: file.name, p_type: type, p_storage_path: path, p_mime_type: file.type, p_size: file.size, p_sha256: digest, p_uploaded_by: user.id, p_ocr_status: file.type.startsWith("image/") ? "pending" : "not_required" });
    if (error) { await admin.storage.from("legal-documents").remove([path]); throw error; }
    await audit("upload", "document", id, { mime_type: file.type, size: file.size });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
