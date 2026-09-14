"use client";

import { useState } from "react";
import { Bot, User, Send, ThumbsUp, ThumbsDown, ShieldCheck, Sparkles, RefreshCw, FileText } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { label: string; excerpt?: string }[];
  id?: string;
};

const SUGGESTED_PROMPTS = [
  "Quais são os prazos processuais que vencem esta semana?",
  "Qual a nossa exposição estimada e provisão contábil total (CPC 25)?",
  "Existe algum processo com risco crítico sem responsável atribuído?",
  "Resuma a situação do contencioso trabalhista.",
];

export function Chat({ processId }: { processId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({});

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    setInputVal("");
    setMessages((v) => [
      ...v,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);
    setBusy(true);

    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          conversation_id: conversation,
          process_id: processId,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        setMessages((v) => [
          ...v.slice(0, -1),
          {
            role: "assistant",
            content:
              body.error ||
              "Desculpe, ocorreu uma instabilidade ao consultar as bases. Por favor, tente novamente.",
          },
        ]);
        setBusy(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let sources: Message["sources"];
      let messageId: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const type = event.match(/^event: (.+)$/m)?.[1];
          const raw = event.match(/^data: (.+)$/m)?.[1];
          if (!raw) continue;
          const data = JSON.parse(raw);

          if (type === "meta") {
            setConversation(data.conversation_id);
            sources = data.sources;
            messageId = data.message_id;
          } else if (type === "chunk") {
            content += data.text;
            setMessages((v) => [
              ...v.slice(0, -1),
              { role: "assistant", content, sources, id: messageId },
            ]);
          }
        }
      }
    } catch {
      setMessages((v) => [
        ...v.slice(0, -1),
        {
          role: "assistant",
          content: "Falha de comunicação com o servidor da LucIA. Verifique sua conexão.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(inputVal);
  }

  async function handleFeedback(messageId: string, useful: boolean) {
    setFeedbackGiven((prev) => ({ ...prev, [messageId]: true }));
    try {
      await fetch("/api/v1/ai/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message_id: messageId, useful }),
      });
    } catch {
      // Ignora erro de feedback
    }
  }

  return (
    <div className="grid min-h-[75vh] grid-rows-[auto_1fr_auto] gap-4">
      {/* Barra de Status da LucIA */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
              <Bot className="w-4 h-4 text-orange-400" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-none">LucIA do Jurídico</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Copiloto conectada ao DataJud, BACEN, CPC 25 e Base Interna
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Respostas auditáveis e factuais</span>
        </div>
      </div>

      {/* Janela de Mensagens */}
      <section className="card overflow-y-auto p-4 space-y-4 max-h-[62vh]" aria-live="polite">
        {messages.length === 0 ? (
          <div className="py-10 text-center max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Olá! Como posso auxiliar seu trabalho jurídico hoje?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sou a <strong>LucIA</strong>, sua copiloto jurídica corporativa. Posso consultar andamentos do DataJud, analisar provisões contábeis (CPC 25), resumir peças ou verificar prazos fatais da sua equipe.
              </p>
            </div>

            <div className="pt-2 grid gap-2 sm:grid-cols-2 text-left">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 hover:border-orange-300 hover:bg-orange-50/40 transition text-left"
                >
                  <span className="font-semibold text-slate-800 block mb-0.5">Sugestão:</span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <article
              key={i}
              className={`max-w-3xl rounded-2xl p-4 transition ${
                m.role === "user"
                  ? "ml-auto bg-slate-900 text-white shadow-sm"
                  : "mr-auto border border-slate-200 bg-white shadow-sm text-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100/20 text-xs font-bold">
                {m.role === "user" ? (
                  <>
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Você</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-slate-900">LucIA do Jurídico</span>
                  </>
                )}
              </div>

              <div className="whitespace-pre-wrap text-sm leading-relaxed space-y-2">
                {m.content || (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-600" />
                    <span>Consultando base jurídica e ferramentas oficiais…</span>
                  </div>
                )}
              </div>

              {m.sources && m.sources.length > 0 && (
                <details className="mt-3 pt-2 border-t border-slate-100 text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-800">
                    Fontes oficiais auditadas ({m.sources.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5 pl-2">
                    {m.sources.map((s, j) => (
                      <li key={j} className="text-slate-600">
                        <strong className="text-slate-800">{s.label}</strong>
                        {s.excerpt && <p className="text-slate-500 text-[11px] line-clamp-2 mt-0.5">{s.excerpt}</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {m.role === "assistant" && m.id && (
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">Esta resposta foi útil?</span>
                  <div className="flex items-center gap-1.5">
                    {feedbackGiven[m.id] ? (
                      <span className="text-[11px] text-emerald-600 font-semibold">Obrigado pelo feedback!</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-600 hover:bg-slate-100 transition"
                          onClick={() => handleFeedback(m.id!, true)}
                          title="Resposta útil e correta"
                        >
                          <ThumbsUp className="w-3 h-3 text-slate-500" />
                          <span>Útil</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-600 hover:bg-slate-100 transition"
                          onClick={() => handleFeedback(m.id!, false)}
                          title="Resposta imprecisa"
                        >
                          <ThumbsDown className="w-3 h-3 text-slate-500" />
                          <span>Incorreta</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </section>

      {/* Caixa de Entrada */}
      <form className="card p-3 flex gap-3 items-end shadow-sm" onSubmit={handleSubmit}>
        <textarea
          className="field min-h-20 resize-y flex-1 text-sm bg-white"
          name="question"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(inputVal);
            }
          }}
          maxLength={4000}
          placeholder="Pergunte à LucIA sobre processos, prazos, riscos, documentos ou teses… (Shift+Enter para nova linha)"
          required
        />
        <button
          className="button inline-flex items-center gap-1.5 px-4 py-2.5 h-fit"
          disabled={busy || !inputVal.trim()}
        >
          {busy ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Enviar</span>
        </button>
      </form>
    </div>
  );
}
