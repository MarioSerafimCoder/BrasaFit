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
    title: "BrasaFit — Seu treino, seu ritmo",
    description: "Treinos pessoais, check-ins de presença e progresso disponíveis mesmo offline.",
    applicationName: "BrasaFit",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "BrasaFit" },
    formatDetection: { telephone: false },
    icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }], shortcut: "/icon-192.png", apple: "/apple-touch-icon.png" },
    openGraph: {
      title: "BrasaFit — Seu treino, seu ritmo",
      description: "Seu treino, sua presença e seu progresso — mesmo offline.",
      type: "website",
      images: [{ url: new URL("/og-checkin.png", base), width: 1200, height: 630, alt: "BrasaFit — Seu treino. Sua presença. Seu ritmo." }],
    },
    twitter: { card: "summary_large_image", title: "BrasaFit", description: "Seu treino. Sua presença. Seu ritmo.", images: [new URL("/og-checkin.png", base)] },
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
