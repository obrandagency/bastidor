import "server-only";
import { BUCKET_ARTES } from "@/lib/constantes";
import { criarClienteServidor } from "@/lib/supabase/server";

// Links temporários (1 hora) das artes, gerados com a sessão de quem está vendo:
// o Storage só assina o que a política deixa essa pessoa ler.
export async function linksDasArtes(caminhos: string[]) {
  const unicos = [...new Set(caminhos)];
  if (unicos.length === 0) return new Map<string, string>();
  const supabase = await criarClienteServidor();
  const { data } = await supabase.storage.from(BUCKET_ARTES).createSignedUrls(unicos, 3600);
  const links = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) links.set(d.path, d.signedUrl);
  return links;
}
