"use client";

import { useEffect, useRef } from "react";

// Seletor de emojis (emoji-mart, em português, com busca). Carregado só quando abre.
// Fica fixo na tela perto de onde foi aberto e fecha ao clicar fora ou apertar Esc.
export function SeletorEmoji({ ancora, escolher, fechar }: { ancora: DOMRect; escolher: (emoji: string) => void; fechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [{ Picker }, dados, i18n] = await Promise.all([import("emoji-mart"), import("@emoji-mart/data"), import("@emoji-mart/data/i18n/pt.json")]);
      if (!ativo || !caixa.current) return;
      const p = new Picker({
        data: dados.default,
        i18n: i18n.default,
        locale: "pt",
        theme: "light",
        previewPosition: "none",
        skinTonePosition: "search",
        maxFrequentRows: 2,
        onEmojiSelect: (e: { native: string }) => escolher(e.native),
      });
      caixa.current.replaceChildren(p as unknown as Node);
    })();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && fechar();
    window.addEventListener("keydown", tecla);
    // Espera o clique que abriu terminar antes de ouvir cliques fora
    const t = setTimeout(() => document.addEventListener("mousedown", fora), 0);
    return () => {
      ativo = false;
      clearTimeout(t);
      window.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", fora);
    };
  }, [escolher, fechar]);

  // 352 x 435 é o tamanho do seletor; encaixa na tela
  const largura = 352;
  const altura = 435;
  const left = Math.max(8, Math.min(ancora.right - largura, window.innerWidth - largura - 8));
  const top = ancora.bottom + altura + 8 < window.innerHeight ? ancora.bottom + 6 : Math.max(8, ancora.top - altura - 6);
  return (
    <div ref={caixa} style={{ left, top }} className="fixed z-[80] min-h-[100px] min-w-[200px] rounded-xl bg-card shadow-pop">
      <div className="p-4 text-[12.5px] text-muted">Carregando emojis…</div>
    </div>
  );
}
