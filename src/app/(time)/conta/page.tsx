import Link from "next/link";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Painel } from "@/components/painel";
import { ROTULO_PERFIL } from "@/lib/permissoes";
import { exigirTime } from "@/lib/sessao";
import { FormPreferencias } from "./formulario";

export const metadata = { title: "Minha conta · Bastidor" };

export default async function Conta() {
  const eu = await exigirTime();
  return (
    <>
      <CabecalhoPagina sobretitulo="Conta" titulo="Minha conta" descricao={`${eu.nome} · ${eu.email} · ${ROTULO_PERFIL[eu.perfil]}`} />
      <div className="grid max-w-[720px] gap-4">
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
