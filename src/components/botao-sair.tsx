import { sair } from "@/app/entrar/acoes";

export function BotaoSair({ className = "" }: { className?: string }) {
  return (
    <form action={sair}>
      <button type="submit" className={`text-[12px] text-muted hover:text-ink hover:underline ${className}`}>
        Sair
      </button>
    </form>
  );
}
