import { Icone, IconeQuadrado } from "@/components/icone";
import { Painel } from "@/components/painel";
import { FormDrive } from "../../formularios";
import { lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Materiais" };

export default async function Materiais({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { gestao, cliente } = await lerCliente(id);
  const link = cliente.drive_url;
  return (
    <>
      <TituloSecao titulo="Materiais" descricao="Logo, fontes, manual de marca, fotos e arquivos do cliente ficam na pasta do Drive." />
      <div className="grid max-w-[860px] grid-cols-1 gap-4">
        <section className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card p-5">
          <IconeQuadrado nome="pasta" tom="azul" grande />
          <div className="min-w-0 flex-1">
            <b className="block text-[16px]">Pasta de materiais no Drive</b>
            {link ? (
              <span className="block truncate text-[13px] text-muted">{link}</span>
            ) : (
              <span className="block text-[13px] text-muted">{gestao ? "Cole o link da pasta abaixo." : "Ainda sem link. Peça ao Sócio ou Adm para cadastrar."}</span>
            )}
          </div>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent px-4 py-2 font-medium text-accent-ink hover:border-accent-hover hover:bg-accent-hover"
            >
              Abrir pasta
              <Icone nome="seta" className="!h-4 !w-4" />
            </a>
          )}
        </section>
        {gestao && (
          <Painel icone="pasta" tom="cinza" titulo={link ? "Trocar o link" : "Link da pasta"}>
            <FormDrive clientId={id} link={link} />
          </Painel>
        )}
      </div>
    </>
  );
}
