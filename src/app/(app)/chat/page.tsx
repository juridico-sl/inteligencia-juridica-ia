import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Chat } from "@/components/chat";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "LucIA do Jurídico · Central Jurídica" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ process_id?: string }>;
}) {
  await requirePermission("ai.use");
  const { process_id } = await searchParams;

  return (
    <>
      <PageHeader
        title="LucIA do Jurídico"
        description="Inteligência Artificial corporativa da Santa Lúcia para análise processual, riscos, prazos e documentos."
      />
      <Chat processId={process_id} />
    </>
  );
}
