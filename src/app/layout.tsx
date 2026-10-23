import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { lerIdentidade } from "@/lib/identidade";
import { estiloDaCor, urlMarca } from "@/lib/marca";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-bricolage",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

// Nome do sistema e da agência vêm de Configurações > Identidade; cada página põe o próprio título antes
export async function generateMetadata(): Promise<Metadata> {
  const id = await lerIdentidade();
  const icone = urlMarca(id.logo);
  return {
    title: { default: id.nome_sistema, template: `%s · ${id.nome_sistema}` },
    description: `Operação de conteúdo da ${id.nome_agencia}`,
    ...(icone ? { icons: { icon: icone } } : {}),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { cor } = await lerIdentidade();
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable}`} style={estiloDaCor(cor)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
