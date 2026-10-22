"use server";

import { revalidatePath } from "next/cache";
import { mesPorExtenso } from "@/lib/datas";
import { pessoaAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/app/entrar/acoes";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
// "1.234" ou "1234" -> 1234; "3,8" -> 3.8; vazio -> null
const numero = (f: FormData, k: string) => {
  const v = texto(f, k).replace(/\s/g, "");
  if (!v) return null;
  const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v.replace(/\.(?=\d{3}(\D|$))/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

async function exigirGestao() {
  const eu = await pessoaAtual();
  return eu && (eu.perfil === "socio" || eu.perfil === "adm") ? eu : null;
}

export async function salvarMetricas(_: Estado, form: FormData): Promise<Estado> {
  const eu = await exigirGestao();
  if (!eu) return { erro: "Só Sócio e Administrativo preenchem relatórios." };
  const clientId = texto(form, "client_id");
  const mes = `${texto(form, "mes")}-01`;
  const semanas = [1, 2, 3, 4, 5].map((i) => numero(form, `semana_${i}`)).filter((n) => n !== null) as number[];
  const destaques = form.getAll("destaques").map(String).slice(0, 3);
  const dados = {
    client_id: clientId,
    mes,
    alcance: numero(form, "alcance"),
    novos_seguidores: numero(form, "novos_seguidores"),
    engajamento: numero(form, "engajamento"),
    visitas_perfil: numero(form, "visitas_perfil"),
    cliques_link: numero(form, "cliques_link"),
    alcance_semanas: semanas,
    investimento: numero(form, "investimento"),
    resultados: numero(form, "resultados"),
    resultado_rotulo: texto(form, "resultado_rotulo") || null,
    destaques,
    leitura: texto(form, "leitura"),
    atualizado_por: eu.id,
    updated_at: new Date().toISOString(),
  };
  const numeros = [dados.alcance, dados.novos_seguidores, dados.engajamento, dados.visitas_perfil, dados.cliques_link, dados.investimento, dados.resultados, ...semanas];
  if (numeros.some((n) => Number.isNaN(n))) return { erro: "Algum número está em formato inválido. Use só números (ex.: 15230 ou 3,8)." };
  if (!/^\d{4}-\d{2}-01$/.test(mes)) return { erro: "Escolha o mês." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("relatorios_metricas").upsert(dados, { onConflict: "client_id,mes" });
  if (error) return { erro: "Não foi possível salvar." };
  revalidatePath(`/clientes/${clientId}`, "layout");

  if (form.get("acao") === "publicar") {
    const { data: atual } = await supabase.from("relatorios_metricas").select("publicado_em").eq("client_id", clientId).eq("mes", mes).maybeSingle();
    if (!atual?.publicado_em) {
      await supabase.from("relatorios_metricas").update({ publicado_em: new Date().toISOString(), publicado_por: eu.id }).eq("client_id", clientId).eq("mes", mes);
      const { avisarRelatorioPublicado } = await import("@/lib/notificacoes");
      const r = await avisarRelatorioPublicado(clientId, mes, mesPorExtenso(mes).split(" ")[0]);
      revalidatePath(`/clientes/${clientId}`, "layout");
      revalidatePath("/portal", "layout");
      return {
        ok:
          r.enviados > 0
            ? `Publicado. Aviso enviado para ${r.enviados} pessoa${r.enviados > 1 ? "s" : ""} do cliente.`
            : r.falhas > 0
              ? "Publicado, mas o e-mail de aviso não saiu. Confira a chave do Resend."
              : "Publicado. O cliente não tem pessoas cadastradas no portal para receber o aviso.",
      };
    }
    revalidatePath("/portal", "layout");
    return { ok: "Alterações publicadas." };
  }
  return { ok: "Rascunho salvo. O cliente ainda não vê." };
}

export async function despublicar(_: Estado, form: FormData): Promise<Estado> {
  if (!(await exigirGestao())) return { erro: "Sem permissão." };
  const clientId = texto(form, "client_id");
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("relatorios_metricas")
    .update({ publicado_em: null, publicado_por: null })
    .eq("client_id", clientId)
    .eq("mes", `${texto(form, "mes")}-01`);
  if (error) return { erro: "Não foi possível tirar do portal." };
  revalidatePath(`/clientes/${clientId}`, "layout");
  revalidatePath("/portal", "layout");
  return { ok: "Voltou para rascunho. O cliente não vê mais." };
}
