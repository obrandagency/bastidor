import { EstadoVazio } from "@/components/cabecalho-pagina";
import { BUCKET_INSPIRACOES } from "@/lib/constantes";
import { dataBR } from "@/lib/datas";
import { lerCliente, TituloSecao } from "../dados";
import { ApagarInspiracao, NovaInspiracao } from "./interativos";

export const metadata = { title: "Inspirações" };

type Inspiracao = { id: string; titulo: string; link: string | null; nota: string | null; imagem: string | null; criado_por: string | null; created_at: string };

const dominio = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
};

export default async function Inspiracoes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { eu, gestao, supabase } = await lerCliente(id);
  const [{ data: lista }, { data: pessoas }] = await Promise.all([
    supabase.from("inspiracoes").select("id, titulo, link, nota, imagem, criado_por, created_at").eq("client_id", id).order("created_at", { ascending: false }).returns<Inspiracao[]>(),
    supabase.from("profiles").select("id, nome").neq("perfil", "cliente"),
  ]);
  const nome = new Map((pessoas ?? []).map((p) => [p.id, p.nome as string]));
  // Imagens do bucket privado: links temporários (1 h) gerados com a sessão de quem vê
  const caminhos = (lista ?? []).flatMap((i) => (i.imagem ? [i.imagem] : []));
  const { data: assinadas } = caminhos.length ? await supabase.storage.from(BUCKET_INSPIRACOES).createSignedUrls(caminhos, 3600) : { data: [] };
  const urlDe = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]));

  return (
    <>
      <TituloSecao titulo="Inspirações" descricao="Referências de posts, perfis, vídeos e sites para este cliente. Só o time vê." acoes={<NovaInspiracao clientId={id} />} />
      {!lista?.length ? (
        <EstadoVazio icone="lampada">Nenhuma inspiração ainda. Salve aqui os posts e perfis que servem de referência.</EstadoVazio>
      ) : (
        <ul className="columns-1 gap-4 sm:columns-2 2xl:columns-3">
          {lista.map((i) => {
            const url = i.imagem ? urlDe.get(i.imagem) : null;
            return (
              <li key={i.id} className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-line bg-card">
                {url && (
                  <a href={i.link ?? url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" className="w-full border-b border-line bg-surface object-cover" />
                  </a>
                )}
                <div className="flex flex-col gap-1.5 p-4">
                  <b className="text-[15px] leading-snug [overflow-wrap:anywhere]">{i.titulo}</b>
                  {i.nota && <p className="whitespace-pre-line text-[13.5px] text-ink/80 [overflow-wrap:anywhere]">{i.nota}</p>}
                  {i.link && (
                    <a href={i.link} target="_blank" rel="noreferrer" className="truncate text-[13px] text-accent hover:underline">
                      {dominio(i.link)} ↗
                    </a>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                    <span className="min-w-0 flex-1 truncate">
                      {i.criado_por ? (nome.get(i.criado_por) ?? "Time") : "Time"} · {dataBR(i.created_at).slice(0, 5)}
                    </span>
                    {(gestao || i.criado_por === eu.id) && <ApagarInspiracao id={i.id} clientId={id} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
