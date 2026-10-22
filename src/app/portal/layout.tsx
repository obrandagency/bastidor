import { Marca } from "@/components/marca";
import { AbasPortal } from "./abas-portal";

export default function LayoutPortal({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-bg">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-4 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-3.5 md:px-7">
          <Marca subtitulo="Portal do cliente" />
        </div>
        <AbasPortal />
      </header>
      <main className="mx-auto max-w-[960px] px-4 pb-14 pt-5 md:px-7 md:pt-7">{children}</main>
    </div>
  );
}
