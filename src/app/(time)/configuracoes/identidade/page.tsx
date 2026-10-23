import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EnviarImagem } from "@/components/enviar-imagem";
import { Painel } from "@/components/painel";
import { IDENTIDADE_PADRAO, urlMarca, type Identidade } from "@/lib/marca";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { salvarLogoAgencia } from "./acoes";
import { FormIdentidade } from "./formulario";

export const metadata = { title: "Identidade da agência" };

export default async function PaginaIdentidade() {
  await exigirTime(["socio"]);
  const supabase = await criarClienteServidor();
  // Lida direto do banco (sem o cache) para mostrar sempre o que acabou de ser salvo
  const { data } = await supabase.from("identidade").select("nome_agencia, nome_sistema, logo, cor").maybeSingle<Identidade>();
  const identidade = data ?? IDENTIDADE_PADRAO;

  return (
    <>
      <CabecalhoPagina
        sobretitulo="Configurações"
        titulo="Identidade da agência"
        descricao="Nome, logo e cor que aparecem para o time, no portal do cliente e nos e-mails."
        acoes={
          <Link href="/configuracoes" className="text-[13px] text-muted hover:text-ink">
            ← Configurações
          </Link>
        }
      />
      <div className="grid max-w-[760px] gap-4">
        <Painel titulo="Logo">
          <EnviarImagem
            pasta="agencia"
            atual={urlMarca(identidade.logo)}
            salvar={salvarLogoAgencia}
            forma="livre"
            maximo={600}
            rotulo="Enviar logo"
            vazio={<span className="font-display text-[20px] font-bold text-muted">{identidade.nome_sistema.charAt(0)}</span>}
          />
          <p className="mt-2.5 text-[12.5px] text-muted">
            Prefira PNG com fundo transparente, na horizontal ou quadrado. Sem logo, aparece a primeira letra do nome do sistema.
          </p>
        </Painel>
        <Painel titulo="Nome e cor">
          <FormIdentidade identidade={identidade} />
        </Painel>
      </div>
    </>
  );
}
