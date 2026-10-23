import Link from "next/link";
import { BotaoSair } from "@/components/botao-sair";
import { Marca } from "@/components/marca";
import { LogoCliente } from "@/components/tarefa";
import { lerIdentidade } from "@/lib/identidade";
import { exigirCliente } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { AbasPortal } from "./abas-portal";

export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const pessoa = await exigirCliente();
  const supabase = await criarClienteServidor();
  const [{ data: cliente }, identidade] = await Promise.all([
    supabase.from("clients").select("nome, cor, logo").eq("id", pessoa.client_id!).maybeSingle(),
    lerIdentidade(),
  ]);

  return (
    <div className="min-h-full">
      <header className="bg-rail text-rail-ink">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-4 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-3.5 md:px-7">
          <Marca identidade={identidade} subtitulo={`Portal do cliente · ${identidade.nome_agencia}`} />
          <div className="flex items-center gap-3 text-right">
            {cliente && <LogoCliente nome={cliente.nome} cor={cliente.cor} logo={cliente.logo} classe="h-9 w-9 text-[14px]" />}
            <div className="min-w-0">
              <div className="truncate font-medium">{cliente?.nome}</div>
              <small className="block text-[11.5px] text-rail-muted">{pessoa.nome}</small>
            </div>
            <BotaoSair className="!text-rail-muted hover:!text-white" />
          </div>
        </div>
        <AbasPortal />
      </header>
      <main className="mx-auto max-w-[960px] px-4 pb-8 pt-5 md:px-7 md:pt-7">{children}</main>
      <footer className="mx-auto max-w-[960px] px-4 pb-10 text-[12px] text-muted md:px-7">
        <Link href="/privacidade" className="hover:underline">Política de privacidade</Link> ·{" "}
        <Link href="/termos" className="hover:underline">Termos de uso</Link>
      </footer>
    </div>
  );
}
