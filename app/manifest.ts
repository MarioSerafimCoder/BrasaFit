import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitLocal — Treino Pessoal",
    short_name: "FitLocal",
    description: "Treinos pessoais, progresso e histórico disponíveis offline.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#a3ff3f",
    orientation: "portrait",
    categories: ["fitness", "health", "lifestyle"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
