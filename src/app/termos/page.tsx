import { PaginaLegal } from "@/components/pagina-legal";

export const metadata = { title: "Termos de uso · Bastidor" };

// RASCUNHO para revisão jurídica da O.BRAND antes do piloto
export default function Termos() {
  return (
    <PaginaLegal titulo="Termos de uso" atualizada="25/10/2026">
      <p>
        O Bastidor é oferecido pela O.BRAND aos seus clientes para acompanhar e aprovar os conteúdos produzidos dentro do contrato de
        prestação de serviços. Ao usar o portal, você concorda com estes termos.
      </p>
      <h2>Acesso</h2>
      <ul>
        <li>O acesso é pessoal e feito pelo link enviado ao seu e-mail. Não compartilhe os links de acesso.</li>
        <li>Cada pessoa vê apenas os conteúdos do cliente ao qual está ligada.</li>
        <li>A O.BRAND pode desativar acessos a pedido do cliente ou ao fim do contrato.</li>
      </ul>
      <h2>Aprovações e ajustes</h2>
      <ul>
        <li>A aprovação feita no portal vale como autorização para publicar o conteúdo.</li>
        <li>
          Os pedidos de ajuste seguem o limite mensal previsto em contrato. Pedidos acima do limite podem ser cobrados à parte, como
          avisado no próprio portal.
        </li>
        <li>O Bastidor registra quem aprovou ou pediu ajuste e quando.</li>
      </ul>
      <h2>Conteúdo</h2>
      <p>
        Os conteúdos e materiais exibidos no portal são de uso do cliente conforme o contrato. Artes e legendas em produção não devem ser
        divulgadas antes da aprovação.
      </p>
      <h2>Contato</h2>
      <p>Dúvidas sobre estes termos: contato@obrandagency.com.</p>
    </PaginaLegal>
  );
}
