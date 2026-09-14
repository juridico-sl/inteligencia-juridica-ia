import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Central Jurídica IA", template: "%s | Central Jurídica IA" },
  description: "Plataforma de inteligência e operações jurídicas da Santa Lúcia"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
