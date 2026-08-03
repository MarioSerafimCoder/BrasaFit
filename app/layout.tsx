import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: "FitLocal — Seu treino, seu ritmo",
    description: "Treinos pessoais, progresso e histórico disponíveis mesmo offline.",
    applicationName: "FitLocal",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FitLocal" },
    formatDetection: { telephone: false },
    icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
    openGraph: {
      title: "FitLocal — Seu treino, seu ritmo",
      description: "Seu aplicativo pessoal de treino, disponível mesmo offline.",
      type: "website",
      images: [{ url: new URL("/og.png", base), width: 1200, height: 630, alt: "FitLocal — Seu treino. Seu ritmo." }],
    },
    twitter: { card: "summary_large_image", title: "FitLocal", description: "Seu treino. Seu ritmo.", images: [new URL("/og.png", base)] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#f4f5ef" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-theme="dark"><body className={geist.variable}>{children}</body></html>;
}
