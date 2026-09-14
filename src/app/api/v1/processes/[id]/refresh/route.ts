import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { audit, enforceRateLimit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorizePermission("process.update");
    await enforceRateLimit("process-refresh", 10, 60);
    const { id } = await params;
    const key = request.headers.get("idempotency-key") ?? `manual-sync:${id}:${new Date().toISOString().slice(0, 13)}`;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("enqueue_process_sync", { process_id: id, request_key: key });
    if (error) throw error;
    await audit("refresh_requested", "process", id);
    return NextResponse.json({ queued: Boolean(data), job_id: data }, { status: data ? 202 : 200 });
  } catch (error) { return apiError(error); }
}
