import { MetadataRoute } from "next";

// === robots.txt para Google Search Console ===
// Next.js App Router sirve automáticamente este archivo en /robots.txt
//
// Permite que todos los crawlers indexen toda la página pública.
// No hay rutas privadas que bloquear (las rutas /reset-password y
// /set-password no tienen contenido indexable útil y Google las
// ignora naturalmente si no hay links hacia ellas desde páginas públicas).

const BASE_URL = "https://www.redescuchapsicologica.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
