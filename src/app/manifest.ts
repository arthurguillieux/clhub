import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LE CLHUB",
    short_name: "CLHUB",
    description: "Le club, en ligne — prêtothèque et sections à venir.",
    start_url: "/",
    display: "standalone",
    background_color: "#eaebe1",
    theme_color: "#1f3d2e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
