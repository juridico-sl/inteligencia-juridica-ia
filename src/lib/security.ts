import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export function safeRedirectPath(value: unknown, fallback = "/dashboard") {
  return typeof value === "string" && /^\/(?!\/)[^\r\n]*$/.test(value) ? value : fallback;
}

export async function enforceRateLimit(bucket: string, maxRequests: number, windowSeconds = 60) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_rate_limit", { bucket_name: bucket, max_requests: maxRequests, window_seconds: windowSeconds });
  if (error || !data) throw new Error("Limite de requisições excedido");
}

export async function audit(action: string, resourceType: string, resourceId?: string, metadata: Record<string, unknown> = {}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const requestHeaders = await headers();
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
    request_id: requestHeaders.get("x-request-id") ?? undefined,
    user_agent: requestHeaders.get("user-agent")?.slice(0, 300)
  });
}
