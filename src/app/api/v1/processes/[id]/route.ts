import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { processUpdateSchema } from "@/lib/schemas/process";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorizePermission("process.read");
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase.from("processes").select("*,companies(*),business_units(*),categories(*),profiles!processes_responsible_user_id_fkey(id,full_name,email),law_firms(*),process_parties(*,parties(*))").eq("id", id).is("deleted_at", null).single();
    if (error) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
    await audit("read", "process", id);
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorizePermission("process.update");
    const { id } = await params;
    const input = processUpdateSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.from("processes").update(input).eq("id", id).is("deleted_at", null).select().single();
    if (error) throw error;
    await audit("update", "process", id, { fields: Object.keys(input) });
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await authorizePermission("process.delete");
    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase.from("processes").update({ deleted_at: new Date().toISOString(), deleted_by: user.id, monitoring_enabled: false }).eq("id", id).is("deleted_at", null);
    if (error) throw error;
    await audit("archive", "process", id);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
