import { GuiaOnboarding, lerOnboarding } from "../guia-onboarding";
import { lerCliente, TituloSecao } from "../dados";

export const metadata = { title: "Onboarding" };

export default async function OnboardingCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { gestao, supabase } = await lerCliente(id);
  const dados = await lerOnboarding(supabase, id);
  return (
    <>
      <TituloSecao titulo="Onboarding" descricao="Os primeiros passos com o cliente. A ficha completa (tarefas, documentos, comentários e histórico) abre pelo link." />
      <GuiaOnboarding clientId={id} dados={dados} gestao={gestao} sempre />
    </>
  );
}
