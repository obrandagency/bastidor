import { TelaMetricas } from "../telas";

export const metadata = { title: "Métricas" };

export default async function Metricas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  return <TelaMetricas mes={mes} base="/portal/metricas" />;
}
