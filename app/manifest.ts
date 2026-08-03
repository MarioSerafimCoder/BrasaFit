import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BrasaFit — Treino Pessoal",
    short_name: "BrasaFit",
    description: "Treinos pessoais, progresso e histórico disponíveis offline.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#ff6a00",
    orientation: "portrait",
    categories: ["fitness", "health", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
