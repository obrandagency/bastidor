import { CartaoEntrada } from "@/components/cartao-entrada";
import { FormEsqueci } from "../formularios";

export const metadata = { title: "Esqueci a senha · Bastidor" };

export default function Esqueci() {
  return (
    <CartaoEntrada titulo="Esqueci a senha" descricao="Enviamos um link para você criar uma nova senha.">
      <FormEsqueci />
    </CartaoEntrada>
  );
}
