import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { processCreateSchema } from "@/lib/schemas/process";
import { audit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { listProcesses } from "@/lib/data/processes";

export async function GET(request: NextRequest) {
  try {
    await authorizePermission("process.read");
    const filters = Object.fromEntries(request.nextUrl.searchParams);
    const result = await listProcesses(filters);
    return NextResponse.json({ data: result.data, page: result.page, per_page: result.perPage, total: result.total });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    await authorizePermission("process.create");
    const input = processCreateSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_full_process", { input });
    if (error) throw error;
    await audit("create", "process", data);
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
