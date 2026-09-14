import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, requiredServerEnv } from "@/lib/env";

export function createAdminClient() {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, requiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
