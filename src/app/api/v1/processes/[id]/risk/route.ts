import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { riskUpdateSchema } from "@/lib/schemas/process";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorizePermission("risk.update");
    const { id } = await params;
    const input = riskUpdateSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_process_risk", { process_id: id, level: input.level, probability_value: input.probability, impact_value: input.impact, change_reason: input.reason });
    if (error) throw error;
    await audit("risk_update", "process", id);
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}
