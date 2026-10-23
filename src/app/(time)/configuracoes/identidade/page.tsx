import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { EnviarImagem } from "@/components/enviar-imagem";
import { Painel } from "@/components/painel";
import { IDENTIDADE_PADRAO, urlMarca, type Identidade } from "@/lib/marca";
import { exigirTime } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { salvarLogoAgencia, salvarTimbrado } from "./acoes";
import { FormDocumentos, FormIdentidade } from "./formulario";

export const metadata = { title: "Identidade da agência" };

export default async function PaginaIdentidade() {
  await exigirTime(["socio"]);
  const supabase = await criarClienteServidor();
  // Lida direto do banco (sem o cache) para mostrar sempre o que acabou de ser salvo
  const { data } = await supabase
    .from("identidade")
    .select("nome_agencia, nome_sistema, logo, cor, timbrado, margem_topo, margem_base, rodape")
    .maybeSingle<Identidade & { timbrado: string | null; margem_topo: number; margem_base: number; rodape: string }>();
  const identidade = data ?? IDENTIDADE_PADRAO;
  const docs = { timbrado: data?.timbrado ?? null, margemTopo: data?.margem_topo ?? 35, margemBase: data?.margem_base ?? 25, rodape: data?.rodape ?? "" };

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
        <Painel titulo="Timbrado dos documentos">
          <p className="mb-3 text-[12.5px] text-muted">
            Fundo de todas as páginas do PDF dos roteiros. Envie a página do papel timbrado como imagem A4 em pé (PNG ou JPG, de preferência 2480 × 3508 px). Se só tiver em PDF, exporte a página como imagem.
          </p>
          <EnviarImagem
            pasta="agencia"
            atual={urlMarca(docs.timbrado)}
            salvar={salvarTimbrado}
            forma="livre"
            maximo={2480}
            rotulo="Enviar timbrado"
            vazio={<span className="text-[11px] text-muted">A4</span>}
          />
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-3 text-[12.5px] text-muted">As margens deixam o texto longe do cabeçalho e do rodapé do timbrado.</p>
            <FormDocumentos margemTopo={docs.margemTopo} margemBase={docs.margemBase} rodape={docs.rodape} />
          </div>
        </Painel>
      </div>
    </>
  );
}
