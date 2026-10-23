"use server";

import { revalidatePath } from "next/cache";
import type { Estado } from "@/app/entrar/acoes";
import { BUCKET_INSPIRACOES } from "@/lib/constantes";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// A imagem já foi enviada pelo navegador (pasta client_id/); aqui só grava a inspiração
export async function criarInspiracao(_: Estado, form: FormData): Promise<Estado> {
  const eu = await pessoaAtual();
  if (!eu || eu.perfil === "cliente") return { erro: "Sem permissão." };
  const clientId = texto(form, "client_id");
  const titulo = texto(form, "titulo");
  const link = texto(form, "link") || null;
  const imagem = texto(form, "imagem") || null;
  if (!titulo) return { erro: "Dê um título para a inspiração." };
  if (link && !/^https?:\/\//.test(link)) return { erro: "O link precisa começar com https://" };
  if (!link && !imagem) return { erro: "Coloque um link ou uma imagem." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("inspiracoes")
    .insert({ client_id: clientId, titulo, link, nota: texto(form, "nota") || null, imagem, criado_por: eu.id });
  if (error) {
    if (imagem) await supabase.storage.from(BUCKET_INSPIRACOES).remove([imagem]);
    return { erro: "Não foi possível salvar a inspiração." };
  }
  revalidatePath(`/clientes/${clientId}/inspiracoes`);
  return { ok: "Inspiração salva." };
}

export async function apagarInspiracao(id: string, clientId: string): Promise<Estado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("inspiracoes").delete().eq("id", id).select("imagem").maybeSingle();
  if (error || !data) return { erro: "Só quem criou, o Sócio ou o Adm apagam." };
  if (data.imagem) await supabase.storage.from(BUCKET_INSPIRACOES).remove([data.imagem]);
  revalidatePath(`/clientes/${clientId}/inspiracoes`);
  return { ok: "Apagada." };
}
