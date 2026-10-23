"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BotaoSair } from "@/components/botao-sair";
import { Icone } from "@/components/icone";
import { Marca } from "@/components/marca";
import { Avatar } from "@/components/tarefa";
import type { Identidade } from "@/lib/marca";
import { ROTULO_PERFIL, menuDoPerfil, type PerfilTime } from "@/lib/permissoes";

type Pessoa = { nome: string; iniciais: string; perfil: PerfilTime; foto: string | null };

export function MenuLateral({
  pessoa,
  identidade,
  avisos = 0,
  contagens = {},
  recolhidoInicial = false,
  children,
}: {
  pessoa: Pessoa;
  identidade: Identidade;
  avisos?: number;
  contagens?: Record<string, number>; // número ao lado do item do menu (ex.: mensagens não lidas no Chat)
  recolhidoInicial?: boolean; // vem do cookie menu_recolhido
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const grupos = menuDoPerfil(pessoa.perfil);
  // Recolhido vale só no computador; no celular o menu continua sendo a gaveta inteira
  const r = (classes: string) => (recolhido ? classes : "");

  function alternar() {
    const v = !recolhido;
    setRecolhido(v);
    document.cookie = `menu_recolhido=${v ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  }

  // No celular, fecha o menu ao trocar de tela
  useEffect(() => setAberto(false), [pathname]);

  return (
    <div className={`grid min-h-full ${recolhido ? "md:grid-cols-[68px_minmax(0,1fr)]" : "md:grid-cols-[236px_minmax(0,1fr)]"}`}>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col gap-[22px] overflow-y-auto border-r border-line bg-bg px-3.5 pb-6 pt-[calc(20px+env(safe-area-inset-top,0px))] transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:w-auto md:translate-x-0 md:pt-5 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        } ${r("md:items-center md:px-2")}`}
      >
        <div className={`flex items-center gap-1 ${r("md:flex-col md:gap-3")}`}>
          <div className={`min-w-0 flex-1 ${r("md:flex-none md:[&_div]:px-0 md:[&_img]:max-w-[44px]")}`}>
            <Marca identidade={identidade} textoClasse={r("md:hidden")} />
          </div>
          <button
            type="button"
            onClick={alternar}
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            className="hidden h-7 w-7 flex-none place-items-center rounded-lg text-rail-muted hover:bg-rail-line hover:text-ink md:grid"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16v14H4zM9 5v14" />
              <path d={recolhido ? "M13 10l2 2-2 2" : "M16 10l-2 2 2 2"} />
            </svg>
          </button>
        </div>
        {grupos.map((g) => (
          <nav key={g.grupo} aria-label={g.grupo} className={`flex flex-col gap-0.5 ${r("md:w-full md:items-center")}`}>
            <div className={`px-2.5 pb-1.5 text-[10.5px] uppercase tracking-[0.12em] text-rail-muted ${r("md:hidden")}`}>{g.grupo}</div>
            {recolhido && <div className="mb-1 hidden h-px w-8 bg-rail-line md:block" aria-hidden="true" />}
            {g.itens.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  title={recolhido ? item.rotulo : undefined}
                  className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] ${
                    ativo ? "bg-accent text-accent-ink" : "text-ink hover:bg-rail-line"
                  } ${r("md:h-10 md:w-10 md:justify-center md:px-0")}`}
                >
                  <Icone nome={item.icone} className={ativo ? "" : "opacity-80"} />
                  <span className={r("md:sr-only")}>{item.rotulo}</span>
                  {!!contagens[item.href] && (
                    <span
                      className={`ml-auto rounded-full px-[7px] font-mono text-[11px] ${ativo ? "bg-white/20" : "bg-rail-line text-ink"} ${r(
                        "md:absolute md:-right-1 md:-top-1 md:ml-0 md:bg-accent md:px-[5px] md:text-[10px] md:text-accent-ink",
                      )}`}
                    >
                      {contagens[item.href]}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        ))}
        <div className={`mt-auto flex items-center gap-2.5 border-t border-rail-line p-2.5 ${r("md:flex-col md:gap-2 md:px-0")}`}>
          <Link href="/conta" title={recolhido ? `${pessoa.nome} · Minha conta` : undefined} className="flex-none">
            <Avatar iniciais={pessoa.iniciais} nome={pessoa.nome} foto={pessoa.foto} />
          </Link>
          <Link href="/conta" className={`min-w-0 flex-1 hover:underline ${r("md:hidden")}`}>
            <div className="truncate font-medium">{pessoa.nome}</div>
            <small className="block text-[11.5px] text-rail-muted">{ROTULO_PERFIL[pessoa.perfil]}</small>
          </Link>
          <Link
            href="/avisos"
            aria-label={avisos ? `${avisos} avisos não lidos` : "Avisos"}
            className="relative grid h-8 w-8 flex-none place-items-center rounded-lg hover:bg-rail-line"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[17px] w-[17px] fill-none stroke-current" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
            </svg>
            {avisos > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[10px] text-accent-ink">
                {avisos > 99 ? "99+" : avisos}
              </span>
            )}
          </Link>
          <BotaoSair />
        </div>
      </aside>

      {aberto && (
        <div className="fixed inset-0 z-25 bg-[rgba(5,7,11,.45)] md:hidden" onClick={() => setAberto(false)} />
      )}

      <div className="min-w-0">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg px-4 py-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            className="rounded-lg border border-rail-line px-2.5 py-1.5"
          >
            Menu
          </button>
          <span className="font-display text-[19px] font-bold tracking-[-0.02em]">{identidade.nome_sistema}</span>
          {avisos > 0 && (
            <Link href="/avisos" className="ml-auto rounded-full bg-accent px-2.5 py-0.5 text-[12px] font-medium text-accent-ink">
              {avisos} aviso{avisos > 1 ? "s" : ""}
            </Link>
          )}
        </div>
        <main className="min-w-0 px-4 pb-24 pt-5 md:px-7 md:pb-24 md:pt-7">{children}</main>
      </div>
    </div>
  );
}
