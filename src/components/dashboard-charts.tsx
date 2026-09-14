"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { label: string; value: number };

// Paleta oficial de IDENTIDADE_VISUAL.md
const brandColors = [
  "#F97316", // Laranja Santa Lúcia
  "#DC2626", // Vermelho Corporativo
  "#16A34A", // Verde Vibra/Positivo
  "#EAB308", // Amarelo Ipiranga
  "#1E3A8A", // Azul Marinho Raízen
  "#38BDF8", // Azul Claro SIM
  "#64748B", // Cinza Neutro
];

export function DashboardCharts({
  risk,
  category,
  monthly,
}: {
  risk: Point[];
  category: Point[];
  monthly: Point[];
}) {
  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-3">
      <ChartCard title="Distribuição por Risco (CPC 25)" subtitle="Classificação de contingência">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={risk}
              dataKey="value"
              nameKey="label"
              outerRadius={85}
              innerRadius={45}
              paddingAngle={2}
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
            >
              {risk.map((_, i) => (
                <Cell key={i} fill={brandColors[i % brandColors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                borderColor: "#E2E8F0",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Processos por Categoria" subtitle="Áreas do direito em acompanhamento">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={category} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
            <XAxis type="number" stroke="#64748B" fontSize={11} />
            <YAxis
              type="category"
              dataKey="label"
              width={100}
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                borderColor: "#E2E8F0",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="value" fill="#F97316" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Evolução Mensal" subtitle="Novos andamentos nos últimos 12 meses">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthly} margin={{ left: -15, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="label" stroke="#64748B" fontSize={11} />
            <YAxis stroke="#64748B" fontSize={11} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                borderColor: "#E2E8F0",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#F97316"
              strokeWidth={3}
              dot={{ fill: "#F97316", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
      <div className="mb-4">
        <h2 className="text-base font-black text-slate-800 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
