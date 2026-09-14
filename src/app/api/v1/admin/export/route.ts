import { authorizePermission } from "@/lib/auth";
import { audit, enforceRateLimit } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

const tables=["profiles","companies","business_units","law_firms","processes","parties","process_parties","process_movements","process_risk_history","process_financial_history","deadlines","tasks","alerts","knowledge_items","documents","document_versions","document_chunks","notes","comments","conversations","messages","message_sources","notification_preferences","notifications","sync_logs","audit_logs","ai_usage_logs","ai_prompt_versions","ai_feedback","ai_evaluation_cases","ai_insights","domain_events"];

export async function GET(){
  await authorizePermission("admin.settings");await enforceRateLimit("admin-export",2,3600);const admin=createAdminClient(),encoder=new TextEncoder();
  const stream=new ReadableStream({async start(controller){try{controller.enqueue(encoder.encode(JSON.stringify({format:"legal-platform-ndjson",version:1,exported_at:new Date().toISOString()})+"\n"));for(const table of tables){for(let page=0;;page++){const{data,error}=await admin.from(table).select("*").range(page*1000,page*1000+999);if(error)throw error;for(const row of data??[])controller.enqueue(encoder.encode(JSON.stringify({table,data:row})+"\n"));if(!data||data.length<1000)break}}await audit("export","administrative_backup",undefined,{tables:tables.length});controller.close()}catch{controller.error(new Error("Falha na exportação administrativa"))}}});
  return new Response(stream,{headers:{"content-type":"application/x-ndjson; charset=utf-8","content-disposition":`attachment; filename="juridico-export-${new Date().toISOString().slice(0,10)}.ndjson"`,"cache-control":"private, no-store"}});
}
