import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Dados inválidos", details: error.issues.map(({ path, message }) => ({ field: path.join("."), message })) }, { status: 400 });
  const message = error instanceof Error ? error.message : "Erro interno";
  if (message === "Acesso negado") return NextResponse.json({ error: message }, { status: 403 });
  if (message.includes("Limite de requisições")) return NextResponse.json({ error: message }, { status: 429 });
  return NextResponse.json({ error: "Não foi possível concluir a operação" }, { status: 500 });
}
