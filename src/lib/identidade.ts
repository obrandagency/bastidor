import "server-only";
import { unstable_cache } from "next/cache";
import { IDENTIDADE_PADRAO, type Identidade } from "./marca";

// Lida com a service role porque também aparece antes do login (entrada, e-mails).
// Guardada em cache; salvar em Configurações > Identidade limpa a tag "identidade".
export const lerIdentidade = unstable_cache(
  async (): Promise<Identidade> => {
    try {
      const { criarClienteAdmin } = await import("./supabase/admin");
      const { data } = await criarClienteAdmin().from("identidade").select("nome_agencia, nome_sistema, logo, cor").maybeSingle();
      return data ?? IDENTIDADE_PADRAO;
    } catch {
      return IDENTIDADE_PADRAO;
    }
  },
  ["identidade"],
  { tags: ["identidade"], revalidate: 3600 },
);
