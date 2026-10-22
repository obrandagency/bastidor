import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { avisarClientesParaAprovar, enviarAvisosPendentes, enviarLembretes, enviarResumoDiario } from "@/lib/notificacoes";

// Chamado pelo agendador do Supabase (pg_cron + pg_net) com "Authorization: Bearer CRON_SECRET"
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROTINAS = {
  avisos: enviarAvisosPendentes,
  aprovacao: () => avisarClientesParaAprovar(),
  lembretes: enviarLembretes,
  resumo: enviarResumoDiario,
} as const;

function autorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const enviado = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!segredo || segredo.length < 24) return false;
  const a = Buffer.from(enviado);
  const b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ rotina: string }> }) {
  if (!autorizado(request)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const { rotina } = await params;
  const executar = ROTINAS[rotina as keyof typeof ROTINAS];
  if (!executar) return NextResponse.json({ erro: "rotina desconhecida" }, { status: 404 });
  const resultado = await executar();
  return NextResponse.json({ rotina, ...resultado });
}
