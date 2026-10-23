import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Painel } from "@/components/painel";
import { ROTULO_PERFIL } from "@/lib/permissoes";
import { exigirTime } from "@/lib/sessao";
import { EnviarImagem } from "@/components/enviar-imagem";
import { Avatar } from "@/components/tarefa";
import { urlMarca } from "@/lib/marca";
import { salvarFoto } from "./acoes";
import { FormPreferencias } from "./formulario";

export const metadata = { title: "Minha conta" };

export default async function Conta() {
  const eu = await exigirTime();
  return (
    <>
      <CabecalhoPagina sobretitulo="Conta" titulo="Minha conta" descricao={`${eu.nome} · ${eu.email} · ${ROTULO_PERFIL[eu.perfil]}`} />
      <div className="grid max-w-[720px] gap-4">
        <Painel titulo="Foto">
          <EnviarImagem
            pasta={`time/${eu.id}`}
            atual={urlMarca(eu.foto)}
            salvar={salvarFoto.bind(null, eu.id)}
            rotulo="Enviar foto"
            vazio={<Avatar iniciais={eu.iniciais} classe="h-full w-full text-[18px]" />}
          />
        </Painel>
        <Painel titulo="E-mails">
          <FormPreferencias emailsOpcionais={eu.emails_opcionais} />
        </Painel>
        <Painel titulo="Senha">
          <Link href="/definir-senha" className="text-accent hover:underline">
            Trocar a minha senha
          </Link>
        </Painel>
      </div>
    </>
  );
}
