import { describe, expect, it, vi } from "vitest";
import { MimoClient } from "./client";

describe("MiMo client", () => {
  it("consome stream SSE e contabiliza uso", async () => {
    vi.stubEnv("MIMO_API_KEY", "test-key"); vi.stubEnv("MIMO_MODEL", "test-model");
    const body = new ReadableStream({ start(controller) { const encoder = new TextEncoder(); controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Olá "}}]}\n\ndata: {"choices":[{"delta":{"content":"mundo"}}],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\ndata: [DONE]\n\n')); controller.close(); } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body }));
    const client = new MimoClient(), chunks: string[] = [];
    for await (const chunk of client.stream([{ role: "user", content: "oi" }])) chunks.push(chunk);
    expect(chunks.join("")).toBe("Olá mundo"); expect(client.getUsage()).toEqual({ input_tokens: 3, output_tokens: 2 });
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
});
