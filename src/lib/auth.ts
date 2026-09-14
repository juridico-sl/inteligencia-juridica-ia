import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getViewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, full_name, email, role_id, active").eq("id", user.id).single();
  return profile?.active ? { user, profile } : null;
}

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requirePermission(permission: string) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", { required_permission: permission });
  if (error || !data) throw new Error("Acesso negado");
  return viewer;
}

export async function authorizePermission(permission: string) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Acesso negado");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", { required_permission: permission });
  if (error || !data) throw new Error("Acesso negado");
  return viewer;
}
