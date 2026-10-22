import { redirect } from "next/navigation";
import { pessoaAtual } from "@/lib/sessao";

export default async function Raiz() {
  const pessoa = await pessoaAtual();
  if (!pessoa) redirect("/entrar");
  redirect(pessoa.perfil === "cliente" ? "/portal" : "/inicio");
}
