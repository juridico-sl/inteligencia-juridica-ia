import "server-only";
import { MimoClient, type AiMessage } from "@/lib/ai/client";
import { LEGAL_SYSTEM_PROMPT, requiresInternalData } from "@/lib/ai/prompt";
import { executeLegalTool, LEGAL_TOOLS, type ToolResult } from "@/lib/ai/tools";
import { createAdminClient } from "@/lib/supabase/admin";

export async function answerLegalQuestion(question: string, userId: string, processId?: string | null) {
  const admin=createAdminClient();const[{data:prompt,error:promptError},{data:settings,error:settingsError}]=await Promise.all([admin.from("ai_prompt_versions").select("content,version").eq("name","legal_assistant").eq("active",true).maybeSingle(),admin.from("system_settings").select("key,value").in("key",["ai.model","ai.temperature","ai.max_tokens","ai.features_enabled"])]);if(promptError||settingsError)throw promptError??settingsError;const runtime=Object.fromEntries((settings??[]).map(row=>[row.key,row.value])),features=runtime["ai.features_enabled"];
  if(Array.isArray(features)&&!features.includes("chat"))throw new Error("Chat jurídico desabilitado pela administração");
  const client = new MimoClient({model:typeof runtime["ai.model"]==="string"?runtime["ai.model"]:undefined,temperature:Number(runtime["ai.temperature"]??0.1),maxTokens:Number(runtime["ai.max_tokens"]??4096)}); const sources: ToolResult["sources"] = [];
  const context = processId ? `Contexto obrigatório: process_id=${processId}. Use esse ID nas ferramentas.` : "";
  const messages: AiMessage[] = [{role:"system",content:`${LEGAL_SYSTEM_PROMPT}\n\nCONFIGURAÇÃO VERSIONADA:\n${prompt?.content??""}\n${context}`},{role:"user",content:question}];
  let usedTools = false; let final = ""; const toolCalls: unknown[] = [];
  for(let step=0;step<6;step++){
    const response=await client.toolCall(messages,LEGAL_TOOLS); messages.push(response);
    if(!response.tool_calls?.length){final=response.content??"";break;}
    usedTools=true;
    for(const call of response.tool_calls){let args:unknown;try{args=JSON.parse(call.function.arguments)}catch{args={}}const result=await executeLegalTool(call.function.name,args,userId);sources.push(...result.sources);toolCalls.push({name:call.function.name,arguments:args});messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result.data)});}
  }
  if(requiresInternalData(question,processId)&&!usedTools) final="Não encontrei informação suficiente.";
  if(!final||!/^FATO\b/im.test(final)||!/^INTERPRETAÇÃO DA IA\b/im.test(final)||!/^RECOMENDAÇÃO\b/im.test(final)){
    if(!sources.length&&requiresInternalData(question,processId)) final="FATO\nNão encontrei informação suficiente.\n\nINTERPRETAÇÃO DA IA\nSem fontes internas, nenhuma interpretação factual foi produzida.\n\nRECOMENDAÇÃO\nRefine a pergunta ou sincronize os dados necessários.";
    else final=`FATO\n${final||"Não encontrei informação suficiente."}\n\nINTERPRETAÇÃO DA IA\nConteúdo acima gerado com base nas fontes recuperadas.\n\nRECOMENDAÇÃO\nValide a informação com profissional autorizado antes de qualquer ato.`;
  }
  return {content:final,sources:[...new Map(sources.map(source=>[`${source.type}:${source.id??source.label}`,source])).values()],toolCalls,usage:client.getUsage(),promptVersion:prompt?.version??null};
}
