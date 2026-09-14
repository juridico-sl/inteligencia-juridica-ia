import { NextRequest } from "next/server";
import { z } from "zod";
import { answerLegalQuestion } from "@/lib/ai/orchestrator";
import { authorizePermission } from "@/lib/auth";
import { audit, enforceRateLimit } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ question: z.string().trim().min(2).max(4000), conversation_id: z.uuid().optional(), process_id: z.uuid().optional() });

export async function POST(request: NextRequest) {
  try {
    const { user } = await authorizePermission("ai.use");
    await enforceRateLimit("ai-chat", 20, 60);
    const input = schema.parse(await request.json()), supabase = await createClient();
    let conversationId = input.conversation_id;
    if (!conversationId) {
      const { data, error } = await supabase.from("conversations").insert({ user_id: user.id, process_id: input.process_id ?? null, title: input.question.slice(0, 80) }).select("id").single();
      if (error) throw error; conversationId = data.id;
    }
    const { error: userError } = await supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: input.question });
    if (userError) throw userError;
    const started = Date.now(), answer = await answerLegalQuestion(input.question, user.id, input.process_id), duration = Date.now() - started;
    const { data: messageId, error } = await supabase.rpc("persist_ai_answer", { p_conversation_id: conversationId, p_content: answer.content, p_tool_calls: answer.toolCalls, p_sources: answer.sources, p_model: process.env.MIMO_MODEL ?? "unknown", p_usage: answer.usage, p_duration_ms: duration, p_prompt_version: answer.promptVersion });
    if (error) throw error;
    await audit("ai_use", "conversation", conversationId, { tools: answer.toolCalls.length, sources: answer.sources.length });
    const encoder = new TextEncoder(), stream = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ conversation_id: conversationId, message_id: messageId, sources: answer.sources })}\n\n`)); for (const chunk of answer.content.match(/.{1,80}/gs) ?? []) controller.enqueue(encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`)); controller.enqueue(encoder.encode("event: done\ndata: {}\n\n")); controller.close(); } });
    return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" } });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Limite") ? error.message : "Não foi possível consultar a IA";
    return Response.json({ error: message }, { status: message.includes("Limite") ? 429 : 400 });
  }
}
