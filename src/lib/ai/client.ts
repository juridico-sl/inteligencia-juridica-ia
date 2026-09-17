import "server-only";
import { z } from "zod";
import { requiredServerEnv } from "@/lib/env";

export type AiMessage = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_call_id?: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] };
export type AiTool = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export class MimoClient {
  private baseUrl = process.env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1";
  private model: string;
  private key = requiredServerEnv("MIMO_API_KEY");
  private temperature: number;
  private maxTokens: number;
  private usage = { input_tokens: 0, output_tokens: 0 };

  constructor(options: { model?: string; temperature?: number; maxTokens?: number } = {}) {
    this.model = options.model ?? requiredServerEnv("MIMO_MODEL");
    this.temperature = Math.max(0, Math.min(1, options.temperature ?? 0.1));
    this.maxTokens = Math.max(256, Math.min(16_384, options.maxTokens ?? 4096));
  }

  private async request(body: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" }, body: JSON.stringify({ model: this.model, temperature: this.temperature, max_tokens: this.maxTokens, ...body }), signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`MiMo indisponível (${response.status})`);
    const result = await response.json();
    this.usage.input_tokens += Number(result.usage?.prompt_tokens ?? result.usage?.input_tokens ?? 0);
    this.usage.output_tokens += Number(result.usage?.completion_tokens ?? result.usage?.output_tokens ?? 0);
    return result;
  }

  async generate(messages: AiMessage[]) { const body = await this.request({ messages }); return body.choices?.[0]?.message?.content as string ?? ""; }
  async *stream(messages: AiMessage[]) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" }, body: JSON.stringify({ model: this.model, temperature: this.temperature, max_tokens: this.maxTokens, messages, stream: true, stream_options: { include_usage: true } }), signal: AbortSignal.timeout(60_000) });
    if (!response.ok || !response.body) throw new Error(`MiMo indisponível (${response.status})`);
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";
    while(true){const{done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split(/\r?\n/);buffer=lines.pop()??"";for(const line of lines){if(!line.startsWith("data:"))continue;const data=line.slice(5).trim();if(!data||data==="[DONE]")continue;const event=JSON.parse(data);if(event.usage){this.usage.input_tokens+=Number(event.usage.prompt_tokens??event.usage.input_tokens??0);this.usage.output_tokens+=Number(event.usage.completion_tokens??event.usage.output_tokens??0);}const text=event.choices?.[0]?.delta?.content;if(text)yield String(text);}if(done)break;}
  }
  async toolCall(messages: AiMessage[], tools: AiTool[]) { const body = await this.request({ messages, tools, tool_choice: "auto" }); return body.choices?.[0]?.message as AiMessage; }
  async structuredOutput<T>(messages: AiMessage[], schema: z.ZodType<T>) { const body = await this.request({ messages, response_format: { type: "json_object" } }); const content = body.choices?.[0]?.message?.content; return schema.parse(JSON.parse(content)); }
  getUsage() { return { ...this.usage }; }
  async embed(text: string) {
    const model = requiredServerEnv("MIMO_EMBEDDING_MODEL");
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/embeddings`, { method: "POST", headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" }, body: JSON.stringify({ model, input: text }), signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Embedding indisponível (${response.status})`);
    const body = await response.json();this.usage.input_tokens+=Number(body.usage?.prompt_tokens??body.usage?.input_tokens??body.usage?.total_tokens??0);this.usage.output_tokens+=Number(body.usage?.completion_tokens??body.usage?.output_tokens??0);return body.data[0].embedding as number[];
  }
}
