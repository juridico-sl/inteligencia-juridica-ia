import Link from "next/link";
import { logout } from "@/app/(auth)/login/actions";
import { Shortcuts } from "@/components/shortcuts";

const groups = [
  ["Visão Geral", "/dashboard"], ["Hoje", "/hoje"], ["Chat IA", "/chat"],
  ["Processos", "/processos"], ["Casos semelhantes", "/casos-semelhantes"], ["Movimentações", "/movimentacoes"], ["Prazos", "/prazos"], ["Tarefas", "/tarefas"],
  ["Alertas", "/alertas"], ["Notificações", "/notificacoes"], ["Documentos", "/documentos"], ["Conhecimento", "/conhecimento"], ["Modelos IA", "/conhecimento/modelos"],
  ["Pesquisa Global", "/busca"], ["Relatórios", "/relatorios"], ["Escritórios", "/escritorios"], ["Empresas", "/empresas"], ["Administração", "/admin"], ["Governança IA", "/admin/ia"], ["Exportar dados", "/api/v1/admin/export"]
] as const;

export function AppShell({ children, name }: { children: React.ReactNode; name: string }) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]"><Shortcuts/>
    <aside className="border-b border-slate-800 bg-slate-950 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
      <div className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-orange-400">Santa Lúcia</p><p className="mt-1 font-black">Central Jurídica IA</p></div>
      <nav aria-label="Navegação principal" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1">
        {groups.map(([label, href]) => <Link key={href} href={href} className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">{label}</Link>)}
      </nav>
      <div className="hidden border-t border-slate-800 p-4 lg:block"><p className="mb-2 truncate text-xs text-slate-400">{name}</p><form action={logout}><button className="text-sm font-semibold text-slate-300 hover:text-white">Sair</button></form></div>
    </aside>
    <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
  </div>;
}
