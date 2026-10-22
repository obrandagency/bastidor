import { PaginaLegal } from "@/components/pagina-legal";

export const metadata = { title: "Política de privacidade · Bastidor" };

// RASCUNHO para revisão jurídica da O.BRAND antes do piloto
export default function Privacidade() {
  return (
    <PaginaLegal titulo="Política de privacidade" atualizada="25/10/2026">
      <p>
        O Bastidor é o sistema da O.BRAND para produzir conteúdo e receber a aprovação dos clientes. Esta política explica quais dados
        pessoais tratamos no Bastidor, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>
      <h2>Quem é o controlador</h2>
      <p>O.BRAND, agência responsável pelo Bastidor. Contato para assuntos de privacidade: contato@obrandagency.com.</p>
      <h2>Quais dados tratamos</h2>
      <ul>
        <li>Nome e e-mail das pessoas que aprovam conteúdo em nome do cliente e da equipe da agência.</li>
        <li>Registro de cada aprovação e pedido de ajuste: quem fez, o quê e quando.</li>
        <li>Conteúdos, legendas, artes e informações de marca fornecidas pelo cliente para a prestação do serviço.</li>
        <li>Dados técnicos de acesso (data e hora de entrada), usados para segurança.</li>
      </ul>
      <p>Não guardamos senhas de redes sociais nem de outros serviços dos clientes no Bastidor.</p>
      <h2>Para que usamos</h2>
      <ul>
        <li>Permitir o acesso ao portal e a aprovação dos conteúdos.</li>
        <li>Enviar avisos por e-mail sobre conteúdos para aprovar e lembretes.</li>
        <li>Registrar o histórico de aprovações e de ajustes previstos em contrato.</li>
      </ul>
      <p>A base legal é a execução do contrato de prestação de serviços entre a O.BRAND e o cliente.</p>
      <h2>Com quem compartilhamos</h2>
      <p>
        Usamos fornecedores que processam os dados em nosso nome: Supabase (banco de dados e arquivos), Vercel (hospedagem do site) e
        Resend (envio de e-mails). Esses serviços ficam fora do Brasil, com garantias contratuais de proteção de dados. Não vendemos nem
        compartilhamos dados para publicidade.
      </p>
      <h2>Por quanto tempo guardamos</h2>
      <p>
        Durante a vigência do contrato. Ao final, a pedido do cliente, exportamos os dados e os apagamos do Bastidor, salvo o que a lei
        exigir guardar.
      </p>
      <h2>Seus direitos</h2>
      <p>
        Você pode pedir confirmação do tratamento, acesso, correção, exportação ou exclusão dos seus dados, e tirar dúvidas, pelo e-mail
        contato@obrandagency.com.
      </p>
    </PaginaLegal>
  );
}
