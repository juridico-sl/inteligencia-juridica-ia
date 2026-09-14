import type { Metadata } from "next";
import { login } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  return <main className="min-h-screen grid place-items-center p-6 bg-slate-950">
    <section className="card w-full max-w-md p-8" aria-labelledby="login-title">
      <div className="mb-8 border-l-4 border-orange-500 pl-4">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Santa Lúcia</p>
        <h1 id="login-title" className="mt-1 text-2xl font-black">Central Jurídica IA</h1>
        <p className="mt-2 text-sm text-slate-500">Acesso restrito ao setor Jurídico.</p>
      </div>
      {params.error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{params.error}</p>}
      <form action={login} className="space-y-4">
        <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
        <label><span className="label">E-mail</span><input className="field" name="email" type="email" autoComplete="email" required /></label>
        <label><span className="label">Senha</span><input className="field" name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
        <button className="button w-full" type="submit">Entrar</button>
      </form>
    </section>
  </main>;
}
