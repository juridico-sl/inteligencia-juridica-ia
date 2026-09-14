import Link from "next/link";

export default function NotFound() { return <main className="grid min-h-screen place-items-center p-6"><section className="card p-8 text-center"><h1 className="text-2xl font-black">Página não encontrada</h1><Link className="button mt-5" href="/dashboard">Voltar</Link></section></main>; }
