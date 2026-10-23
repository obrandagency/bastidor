import { TelaRelatorio } from "../telas";

export const metadata = { title: "Relatório de entregas" };

export default async function Relatorio({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  return <TelaRelatorio mes={mes} base="/portal/relatorio" />;
}
