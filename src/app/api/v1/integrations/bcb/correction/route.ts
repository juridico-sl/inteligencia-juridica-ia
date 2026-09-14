import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { calculateBcbCorrection } from "@/lib/integrations/bcb";

export async function GET(request: NextRequest) {
  try {
    await authorizePermission("process.read");
    const { searchParams } = request.nextUrl;
    const value = parseFloat(searchParams.get("value") || "0");
    const startDate = searchParams.get("startDate") || "";
    const serie = parseInt(searchParams.get("serie") || "433", 10);

    if (value <= 0 || !startDate) {
      return NextResponse.json(
        { error: "Parâmetros 'value' e 'startDate' são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await calculateBcbCorrection({
      value,
      startDate,
      serie,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return apiError(error);
  }
}
