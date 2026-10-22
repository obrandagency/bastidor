"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/portal", rotulo: "Aprovar conteúdos" },
  { href: "/portal/relatorio", rotulo: "Relatório de entregas" },
  { href: "/portal/metricas", rotulo: "Métricas" },
];

export function AbasPortal() {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal" className="mx-auto flex max-w-[960px] gap-1 overflow-x-auto px-4 md:px-7">
      {ABAS.map((aba) => {
        const ativa = pathname === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-medium ${
              ativa ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
