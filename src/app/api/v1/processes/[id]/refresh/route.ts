import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { audit, enforceRateLimit } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProcessFromDatajud } from "@/lib/datajud/client";
import { movementHash } from "@/lib/legal";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  try {
    await authorizePermission("process.update");
    await enforceRateLimit("process-refresh", 30, 60);
    const { id } = await params;
    const admin = createAdminClient();

    // 1. Busca dados do processo local
    const { data: process, error: fetchError } = await admin
      .from("processes")
      .select("id,process_number,court,metadata,claim_value")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !process) {
      return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
    }

    // 2. Consulta a API Pública do DataJud diretamente
    const djResult = await fetchProcessFromDatajud(process.process_number, process.court ?? undefined);

    if (!djResult.found) {
      // Registra erro de sincronização
      await admin
        .from("processes")
        .update({ last_sync_error: djResult.error ?? "Processo não localizado no DataJud" })
        .eq("id", id);

      await admin.from("sync_logs").insert({
        process_id: id,
        source: "DataJud",
        status: "failed",
        error_code: "NOT_FOUND",
        error_message: djResult.error ?? "Não localizado",
        duration_ms: Date.now() - startedAt,
      });

      return NextResponse.json(
        { ok: false, error: djResult.error ?? "Não foi possível localizar o processo no DataJud." },
        { status: 422 }
      );
    }

    // 3. Atualiza dados cadastrais oficiais do DataJud
    const existingMeta = (process.metadata as Record<string, unknown>) || {};
    const updatedMeta = {
      ...existingMeta,
      grau: djResult.grau,
      assuntos: djResult.assuntos,
      sistema: djResult.sistema,
      formato: djResult.formato,
      nivel_sigilo: djResult.nivelSigilo,
      partes_omitidas_tribunal: djResult.partesOmitidasPeloTribunal,
      source: "DataJud",
    };

    const updatePayload: Record<string, unknown> = {
      court: djResult.tribunal,
      court_name: djResult.tribunal,
      last_synced_at: new Date().toISOString(),
      last_sync_error: null,
      metadata: updatedMeta,
    };

    if (djResult.classeNome) updatePayload.judicial_class = djResult.classeNome;
    if (djResult.orgaoJulgador) updatePayload.judging_body = djResult.orgaoJulgador;
    if (djResult.dataAjuizamento) updatePayload.filing_date = djResult.dataAjuizamento;

    // Se o tribunal fornecer valor da causa oficial e estiver zerado/nulo localmente, preenche
    if (djResult.valorCausa && !process.claim_value) {
      updatePayload.claim_value = djResult.valorCausa;
    }

    await admin.from("processes").update(updatePayload).eq("id", id);

    // 4. Salva as movimentações oficiais
    let createdCount = 0;
    if (djResult.movimentacoes.length > 0) {
      const movementsToUpsert = djResult.movimentacoes.map((m) => {
        const fullDesc = m.complementos && m.complementos.length > 0
          ? `${m.nome} (${m.complementos.join(" | ")})`
          : m.nome;
        const dateIso = new Date(m.dataHora).toISOString();
        const hash = movementHash({
          date: dateIso,
          code: String(m.codigo ?? ""),
          description: m.nome,
        });

        return {
          process_id: id,
          movement_code: String(m.codigo ?? ""),
          movement_type: m.nome.slice(0, 200),
          description: fullDesc,
          movement_date: dateIso,
          source: "DataJud",
          raw_data: {
            ...m,
            natureza_ato: m.naturezaAto,
            requer_documento_pdf: m.requerDocumentoPdf,
          },
          content_hash: hash,
        };
      });

      // Divide em lotes de 50 para evitar sobrecarga no Postgres
      for (let i = 0; i < movementsToUpsert.length; i += 50) {
        const chunk = movementsToUpsert.slice(i, i + 50);
        const { data: upserted } = await admin
          .from("process_movements")
          .upsert(chunk, { onConflict: "process_id,content_hash", ignoreDuplicates: true })
          .select("id");
        createdCount += upserted?.length ?? 0;
      }
    }

    // 5. Registra log de sucesso e auditoria
    await admin.from("sync_logs").insert({
      process_id: id,
      source: "DataJud",
      status: "success",
      movements_received: djResult.movimentacoes.length,
      movements_created: createdCount,
      duration_ms: Date.now() - startedAt,
    });

    await audit("refresh_datajud_completed", "process", id, {
      tribunal: djResult.tribunal,
      movements_count: djResult.movimentacoes.length,
    });

    return NextResponse.json({
      ok: true,
      tribunal: djResult.tribunal,
      movementsReceived: djResult.movimentacoes.length,
      message: `Sincronizado com o DataJud! ${djResult.movimentacoes.length} movimentações oficiais obtidas.`,
    });
  } catch (error) {
    return apiError(error);
  }
}
