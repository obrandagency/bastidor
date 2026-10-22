import { createBrowserClient } from "@supabase/ssr";

// Cliente do navegador: usa só a chave pública (anon). As regras de acesso ficam na RLS.
export function criarClienteNavegador() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
