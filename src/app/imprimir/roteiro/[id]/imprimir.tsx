"use client";

import { useEffect } from "react";

// Abre a janela de impressão assim que o timbrado carregar; lá se escolhe "Salvar como PDF"
export function BotaoImprimir() {
  useEffect(() => {
    const imgs = [...document.images];
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => ((i.onload = ok), (i.onerror = ok)))))).then(() => setTimeout(() => window.print(), 300));
  }, []);
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] print:hidden">
      <button onClick={() => window.print()} className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-medium text-accent-ink">
        Imprimir ou salvar em PDF
      </button>
      <span className="text-muted">Na janela de impressão, escolha &quot;Salvar como PDF&quot;, papel A4 e deixe as margens no padrão.</span>
    </div>
  );
}
