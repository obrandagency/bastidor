import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas abertas: telas de entrada, retorno dos links de e-mail, páginas legais
// e as rotinas agendadas (protegidas pelo CRON_SECRET, não por sessão)
const ROTAS_PUBLICAS = ["/entrar", "/auth/", "/api/cron/", "/privacidade", "/termos"];

export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser valida o token no Supabase (não confia só no cookie)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(r.endsWith("/") ? r : r + "/"));
  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = caminho.startsWith("/portal") ? "/entrar/cliente" : "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return resposta;
}
