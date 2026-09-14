import { AppShell } from "@/components/app-shell";
import { requireViewer } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireViewer();
  return <AppShell name={profile.full_name ?? profile.email}>{children}</AppShell>;
}
