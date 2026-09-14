import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security";
import { fetchCnpjFromBrasilApi } from "@/lib/integrations/brasilapi";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  try {
    await authorizePermission("process.read");
    await enforceRateLimit("cnpj-lookup", 60, 60);

    const { cnpj } = await params;
    const result = await fetchCnpjFromBrasilApi(cnpj);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    return apiError(error);
  }
}
