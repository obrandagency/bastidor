"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icone, type NomeIcone } from "@/components/icone";
import { LogoCliente } from "@/components/tarefa";

type Item = { rotulo: string; href: string; icone: NomeIcone; contagem?: number };

export function MenuCliente({
  cliente,
  clientes,
  perfil,
  gestao,
  aprovar,
}: {
  cliente: { id: string; nome: string; cor: string; logo: string | null; ativo: boolean; segmento: string | null };
  clientes: { id: string; nome: string }[];
  perfil: string;
  gestao: boolean;
  aprovar: number;
}) {
  const caminho = usePathname();
  const router = useRouter();
  const base = `/clientes/${cliente.id}`;

  const grupos: { grupo: string; itens: Item[] }[] = [
    {
      grupo: "Geral",
      itens: [
        { rotulo: "Início", href: base, icone: "inicio" },
        { rotulo: "Tarefas", href: `/tarefas?cliente=${cliente.id}`, icone: "tarefas" },
        { rotulo: "Materiais", href: `${base}/materiais`, icone: "pasta" },
      ],
    },
    {
      grupo: "Estratégia",
      itens: [
        { rotulo: "Diretrizes", href: `${base}/diretrizes`, icone: "documento" },
        { rotulo: "Público-alvo", href: `${base}/publico`, icone: "alvo" },
        { rotulo: "Reuniões", href: `${base}/reunioes`, icone: "camera" },
      ],
    },
    {
      grupo: "Conteúdo",
      itens: [
        { rotulo: "Inspirações", href: `${base}/inspiracoes`, icone: "lampada" },
        { rotulo: "Roteiros", href: `${base}/roteiros`, icone: "roteiros" },
        { rotulo: "Criação", href: `/criacao?cliente=${cliente.id}`, icone: "criacao" },
        { rotulo: "Aprovação", href: `${base}/aprovacao`, icone: "aprovacao", contagem: aprovar },
      ],
    },
    ...(gestao
      ? [
          {
            grupo: "Comercial",
            itens: [
              { rotulo: "Contrato", href: `${base}/contrato`, icone: "contrato" as NomeIcone },
              { rotulo: "Métricas", href: `${base}/metricas`, icone: "dashboards" as NomeIcone },
            ],
          },
        ]
      : []),
    {
      grupo: "Conta",
      itens: [
        ...(gestao ? [{ rotulo: "Pessoas do cliente", href: `${base}/pessoas`, icone: "pessoas" as NomeIcone }] : []),
        { rotulo: "Acessos", href: `${base}/acessos`, icone: "chave" },
        { rotulo: "Onboarding", href: `${base}/onboarding`, icone: "onboarding" },
        ...(perfil === "socio" ? [{ rotulo: "Dados (LGPD)", href: `${base}/lgpd`, icone: "escudo" as NomeIcone }] : []),
      ],
    },
  ];
  const ativo = (href: string) => (href === base ? caminho === base : caminho.startsWith(href));

  return (
    <aside className="min-w-0 rounded-xl border border-line bg-card lg:sticky lg:top-4 lg:w-[248px] lg:flex-none">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <LogoCliente nome={cliente.nome} cor={cliente.cor} logo={cliente.logo} quadrado classe="h-12 w-12 text-[18px]" />
        <div className="min-w-0 flex-1">
          <b className="block truncate font-display text-[16px] font-bold">{cliente.nome}</b>
          <span className="flex items-center gap-1.5 text-[12px]">
            <span className={`rounded-full px-2 py-px font-medium ${cliente.ativo ? "bg-ok-soft text-ok" : "bg-surface text-muted"}`}>{cliente.ativo ? "Ativo" : "Inativo"}</span>
            {cliente.segmento && <span className="truncate text-muted">{cliente.segmento}</span>}
          </span>
        </div>
        {gestao && (
          <Link href={`${base}/editar`} title="Editar cadastro" aria-label="Editar cadastro" className={`grid h-8 w-8 flex-none place-items-center rounded-lg hover:bg-surface ${caminho.startsWith(`${base}/editar`) ? "text-accent" : "text-muted"}`}>
            <Icone nome="criacao" />
          </Link>
        )}
      </div>

      {clientes.length > 1 && (
        <div className="border-b border-line px-4 py-3">
          <label className="sr-only" htmlFor="trocar-cliente">
            Trocar de cliente
          </label>
          <select
            id="trocar-cliente"
            value={cliente.id}
            onChange={(e) => router.push(`/clientes/${e.target.value}`)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* No celular o menu vira uma faixa que rola para o lado */}
      <nav aria-label={`Menu de ${cliente.nome}`} className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:p-3">
        {grupos.map((g) => (
          <div key={g.grupo} className="flex flex-none gap-1 lg:mb-2 lg:flex-col lg:gap-0.5 lg:last:mb-0">
            <span className="hidden px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted lg:block">{g.grupo}</span>
            {g.itens.map((i) => {
              const sel = ativo(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={sel ? "page" : undefined}
                  className={`flex flex-none items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-[7px] text-[13.5px] ${
                    sel ? "bg-accent-soft font-semibold text-accent" : "text-ink/80 hover:bg-surface hover:text-ink"
                  }`}
                >
                  <Icone nome={i.icone} className={sel ? "" : "text-muted"} />
                  <span className="flex-1">{i.rotulo}</span>
                  {!!i.contagem && <span className="rounded-full bg-warn px-1.5 font-mono text-[11px] font-semibold text-white">{i.contagem}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <Link href="/clientes" className="hidden items-center gap-2 border-t border-line px-4 py-3 text-[12.5px] text-muted hover:text-ink lg:flex">
        ‹ Todos os clientes
      </Link>
    </aside>
  );
}
