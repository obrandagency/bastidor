import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com a service role: ignora a RLS. Só para convites e rotinas no servidor,
// sempre depois de conferir a permissão de quem pediu.
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
