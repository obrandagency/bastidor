import { BotaoSair } from "@/components/botao-sair";
import { Marca } from "@/components/marca";
import { exigirCliente } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { AbasPortal } from "./abas-portal";

export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const pessoa = await exigirCliente();
  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase.from("clients").select("nome").eq("id", pessoa.client_id!).maybeSingle();

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-4 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-3.5 md:px-7">
          <Marca subtitulo="Portal do cliente" />
          <div className="flex items-center gap-3 text-right">
            <div className="min-w-0">
              <div className="truncate font-medium">{cliente?.nome}</div>
              <small className="block text-[11.5px] text-muted">{pessoa.nome}</small>
            </div>
            <BotaoSair />
          </div>
        </div>
        <AbasPortal />
      </header>
      <main className="mx-auto max-w-[960px] px-4 pb-14 pt-5 md:px-7 md:pt-7">{children}</main>
    </div>
  );
}
