import Link from "next/link";
import {
  LayoutDashboard,
  Scale,
  Activity,
  Clock,
  FolderOpen,
  Bot,
  Building2,
  BarChart3,
  Search,
  BookOpen,
  Bell,
  Settings,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { Shortcuts } from "@/components/shortcuts";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Operação",
    items: [
      { label: "Painel Geral", href: "/dashboard", icon: LayoutDashboard },
      { label: "Processos", href: "/processos", icon: Scale },
      { label: "Andamentos DataJud", href: "/movimentacoes", icon: Activity },
      { label: "Prazos & Tarefas", href: "/prazos", icon: Clock },
      { label: "Documentos", href: "/documentos", icon: FolderOpen },
      { label: "Assistente IA", href: "/chat", icon: Bot },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Empresas & Escritórios", href: "/empresas", icon: Building2 },
      { label: "Relatórios & Métricas", href: "/relatorios", icon: BarChart3 },
      { label: "Casos Semelhantes", href: "/casos-semelhantes", icon: Search },
      { label: "Base de Conhecimento", href: "/conhecimento", icon: BookOpen },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Alertas & Notificações", href: "/alertas", icon: Bell },
      { label: "Administração", href: "/admin", icon: Settings },
    ],
  },
];

export function AppShell({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <Shortcuts />
      <aside className="border-b border-slate-800 bg-slate-950 text-white lg:min-h-screen lg:border-b-0 lg:border-r flex flex-col justify-between">
        <div>
          <div className="p-5 border-b border-slate-800/80">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-orange-400">
              Santa Lúcia
            </p>
            <p className="mt-0.5 text-base font-black tracking-tight text-white">
              Inteligência Jurídica
            </p>
          </div>

          <nav aria-label="Navegação principal" className="p-3 space-y-4">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </p>
                <div className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition"
                      >
                        <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-800/80 p-4 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="truncate text-xs font-semibold text-slate-200">{name}</p>
              <p className="text-[11px] text-slate-400">Conectado</p>
            </div>
            <form action={logout}>
              <button
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
                title="Encerrar sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 p-4 sm:p-6 lg:p-8 bg-slate-50/50">{children}</main>
    </div>
  );
}
