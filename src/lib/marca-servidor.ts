import "server-only";
import { BUCKET_MARCA } from "./marca";
import type { criarClienteServidor } from "./supabase/server";

// Apaga a imagem anterior do bucket "marca" depois de trocar (com a sessão de quem trocou; a política decide)
export async function apagarImagemAntiga(supabase: Awaited<ReturnType<typeof criarClienteServidor>>, antiga: string | null, nova: string | null) {
  if (antiga && antiga !== nova) await supabase.storage.from(BUCKET_MARCA).remove([antiga]);
}
