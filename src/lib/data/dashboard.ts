import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getDashboardMetrics() {
  const supabase = await createClient();
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 86400000).toISOString();
  const [active, unassigned, deadlines, overdue, tasks, values, movements] = await Promise.all([
    supabase.from("processes").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
    supabase.from("processes").select("id", { count: "exact", head: true }).is("responsible_user_id", null).is("deleted_at", null),
    supabase.from("deadlines").select("id", { count: "exact", head: true }).gte("due_at", now.toISOString()).lte("due_at", inSevenDays).neq("status", "completed"),
    supabase.from("deadlines").select("id", { count: "exact", head: true }).lt("due_at", now.toISOString()).neq("status", "completed"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
    supabase.from("processes").select("claim_value, estimated_exposure, provision").is("deleted_at", null),
    supabase.from("process_movements").select("id", { count: "exact", head: true }).gte("created_at", new Date(now.getTime() - 86400000).toISOString())
  ]);
  for (const result of [active, unassigned, deadlines, overdue, tasks, values, movements]) if (result.error) throw result.error;
  const financial = (values.data ?? []).reduce((sum, row) => ({ claim: sum.claim + Number(row.claim_value ?? 0), exposure: sum.exposure + Number(row.estimated_exposure ?? 0), provision: sum.provision + Number(row.provision ?? 0) }), { claim: 0, exposure: 0, provision: 0 });
  return { active: active.count ?? 0, unassigned: unassigned.count ?? 0, deadlines: deadlines.count ?? 0, overdue: overdue.count ?? 0, tasks: tasks.count ?? 0, movements: movements.count ?? 0, ...financial };
}
