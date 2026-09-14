import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { authorizePermission } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { isValidCnj, normalizeCnj } from "@/lib/legal";
import { audit, enforceRateLimit } from "@/lib/security";
import { hasValidSignature } from "@/lib/documents";
import { readXlsx } from "@/lib/xlsx";
import { createClient } from "@/lib/supabase/server";

type ImportRow = { numero_cnj?: unknown; process_number?: unknown; responsavel?: unknown; categoria?: unknown };

export async function POST(request: NextRequest) {
  try {
    await authorizePermission("process.create");
    await enforceRateLimit("process-import", 3, 300);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Arquivo inválido ou maior que 10 MB" }, { status: 400 });
    const ext = file.name.toLowerCase().split(".").pop();
    if (!ext || !["csv","xlsx"].includes(ext)) return NextResponse.json({ error: "Use CSV ou XLSX" }, { status: 415 });
    const buffer = Buffer.from(await file.arrayBuffer());
    if(ext==="xlsx"&&!hasValidSignature("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer))return NextResponse.json({error:"Conteúdo XLSX inválido"},{status:415});
    if(ext==="csv"&&(buffer.includes(0)||!hasValidSignature("text/csv",buffer)))return NextResponse.json({error:"Conteúdo CSV inválido"},{status:415});
    let rows: ImportRow[];
    if (ext === "csv") rows = Papa.parse<ImportRow>(buffer.toString("utf8"), { header: true, skipEmptyLines: true }).data;
    else { const [sheet]=await readXlsx(buffer),headers=(sheet.shift()??[]).map(String);rows=sheet.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])) as ImportRow); }
    if (rows.length > 1000) return NextResponse.json({ error: "Limite de 1.000 linhas por importação" }, { status: 400 });
    const supabase = await createClient();
    const categories = await supabase.from("categories").select("id,name").eq("active", true);
    const profiles = await supabase.from("profiles").select("id,email,full_name").eq("active", true);
    if(categories.error||profiles.error)throw categories.error??profiles.error;
    const categoryMap = new Map((categories.data ?? []).map((item) => [item.name.toLocaleLowerCase("pt-BR"), item.id]));
    const profileMap = new Map((profiles.data ?? []).flatMap((item) => [[item.email.toLocaleLowerCase(), item.id], ...(item.full_name ? [[item.full_name.toLocaleLowerCase("pt-BR"), item.id] as [string,string]] : [])]));
    const result = { imported: 0, duplicates: 0, invalid: 0, failed: 0, errors: [] as { row: number; reason: string }[] }, valid: {process_number:string;category_id:string|null;responsible_user_id:string|null}[]=[];
    for (const [index, row] of rows.entries()) {
      const cnj = normalizeCnj(String(row.numero_cnj ?? row.process_number ?? ""));
      if (!isValidCnj(cnj)) { result.invalid++; result.errors.push({ row: index + 2, reason: "CNJ inválido" }); continue; }
      const category = String(row.categoria ?? "").trim().toLocaleLowerCase("pt-BR");
      const responsible = String(row.responsavel ?? "").trim().toLocaleLowerCase("pt-BR");
      valid.push({process_number:cnj,category_id:categoryMap.get(category)??null,responsible_user_id:profileMap.get(responsible)??null});
    }
    const {data,error}=await supabase.rpc("import_processes",{input_rows:valid});if(error){result.failed=valid.length;result.errors.push({row:0,reason:"Falha no lote"})}else{const bulk=data as {imported:number;duplicates:number};result.imported=bulk.imported;result.duplicates=bulk.duplicates}
    await audit("import", "process", undefined, { imported: result.imported, duplicates: result.duplicates, invalid: result.invalid, failed: result.failed });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
