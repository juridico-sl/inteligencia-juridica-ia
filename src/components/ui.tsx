import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div><h1 className="text-3xl font-black text-slate-800">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{action}
  </header>;
}

export function KpiCard({ label, value, tone = "brand" }: { label: string; value: string | number; tone?: "brand" | "danger" | "neutral" }) {
  const border = tone === "danger" ? "border-l-red-600" : tone === "neutral" ? "border-l-slate-500" : "border-l-orange-500";
  return <div className={`card border-l-4 ${border} p-4`}><p className="label">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}

export function EmptyState({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }
