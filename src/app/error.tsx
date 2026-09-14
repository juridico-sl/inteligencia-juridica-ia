"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center p-6"><section className="card max-w-lg p-8 text-center"><h1 className="text-2xl font-black">Não foi possível concluir</h1><p className="mt-2 text-slate-500">Tente novamente. Se persistir, informe o suporte.</p><button className="button mt-5" onClick={reset}>Tentar novamente</button></section></main>;
}
