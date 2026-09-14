import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </header>
  );
}

export type KpiTone = "brand" | "danger" | "warning" | "success" | "neutral";

export function KpiCard({
  label,
  value,
  tone = "brand",
  subtitle,
  icon,
}: {
  label: string;
  value: string | number;
  tone?: KpiTone;
  subtitle?: string;
  icon?: ReactNode;
}) {
  const borderColors: Record<KpiTone, string> = {
    brand: "border-l-[#F97316]",
    danger: "border-l-[#DC2626]",
    warning: "border-l-[#F59E0B]",
    success: "border-l-[#10B981]",
    neutral: "border-l-[#64748B]",
  };

  const badgeBgs: Record<KpiTone, string> = {
    brand: "bg-orange-50 text-orange-600",
    danger: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-600",
    success: "bg-emerald-50 text-emerald-600",
    neutral: "bg-slate-50 text-slate-600",
  };

  return (
    <div
      className={`bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 ${borderColors[tone]} flex flex-col justify-between`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
            {label}
          </p>
          <h2 className="text-3xl font-black text-slate-800 mt-2 tracking-tight">{value}</h2>
        </div>
        {icon && (
          <div className={`p-2.5 rounded-lg flex-shrink-0 text-xl ${badgeBgs[tone]}`}>
            {icon}
          </div>
        )}
      </div>
      {subtitle && (
        <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5 border-t border-slate-100 pt-2 font-medium">
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
}

export function TrafficLight({
  items,
}: {
  items: { track: string; value: string | number; status: "success" | "warning" | "danger"; detail?: string }[];
}) {
  const statusStyles = {
    success: { border: "border-l-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", badge: "Normal" },
    warning: { border: "border-l-amber-500", text: "text-amber-700", bg: "bg-amber-50", badge: "Atenção" },
    danger: { border: "border-l-red-500", text: "text-red-700", bg: "bg-red-50", badge: "Crítico" },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {items.map((item, idx) => {
        const style = statusStyles[item.status];
        return (
          <div
            key={idx}
            className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 ${style.border} flex items-center justify-between`}
          >
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.track}</p>
              <p className="text-xl font-black text-slate-800 mt-1">{item.value}</p>
              {item.detail && <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>}
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
              {style.badge}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty font-medium">{children}</div>;
}
