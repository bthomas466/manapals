import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ManaPals",
    short_name: "ManaPals",
    start_url: "/collection",
    display: "browser",
    background_color: "#0c1015",
    theme_color: "#0c1015",
    icons: [
      { src: "/icons/manapals-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/manapals-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
