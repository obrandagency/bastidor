"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BotaoSair } from "@/components/botao-sair";
import { Icone } from "@/components/icone";
import { Marca } from "@/components/marca";
import { ROTULO_PERFIL, menuDoPerfil, type PerfilTime } from "@/lib/permissoes";

type Pessoa = { nome: string; iniciais: string; perfil: PerfilTime };

export function MenuLateral({ pessoa, children }: { pessoa: Pessoa; children: React.ReactNode }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const grupos = menuDoPerfil(pessoa.perfil);

  // No celular, fecha o menu ao trocar de tela
  useEffect(() => setAberto(false), [pathname]);

  return (
    <div className="grid min-h-full md:grid-cols-[236px_minmax(0,1fr)]">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col gap-[22px] overflow-y-auto border-r border-line bg-bg px-3.5 pb-6 pt-[calc(20px+env(safe-area-inset-top,0px))] transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:w-auto md:translate-x-0 md:pt-5 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Marca subtitulo="O.BRAND" />
        {grupos.map((g) => (
          <nav key={g.grupo} aria-label={g.grupo} className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-1.5 text-[10.5px] uppercase tracking-[0.12em] text-rail-muted">{g.grupo}</div>
            {g.itens.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] ${
                    ativo ? "bg-accent text-accent-ink" : "text-ink hover:bg-rail-line"
                  }`}
                >
                  <Icone nome={item.icone} className={ativo ? "" : "opacity-80"} />
                  <span>{item.rotulo}</span>
                </Link>
              );
            })}
          </nav>
        ))}
        <div className="mt-auto flex items-center gap-2.5 border-t border-rail-line p-2.5">
          <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-ink text-[10.5px] font-semibold text-bg">
            {pessoa.iniciais}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{pessoa.nome}</div>
            <small className="block text-[11.5px] text-rail-muted">{ROTULO_PERFIL[pessoa.perfil]}</small>
          </div>
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
          <span className="font-display text-[19px] font-bold tracking-[-0.02em]">Bastidor</span>
        </div>
        <main className="min-w-0 px-4 pb-14 pt-5 md:px-7 md:pb-16 md:pt-7">{children}</main>
      </div>
    </div>
  );
}
