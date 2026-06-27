import { MetadataRoute } from "next";

// === Sitemap para Google Search Console ===
// Next.js App Router sirve automáticamente este archivo en /sitemap.xml
//
// Incluye solo las páginas PÚBLICAS indexables:
// - / (landing page principal con todas las secciones)
//
// NO incluye:
// - /reset-password (flujo privado, no debe indexarse)
// - /set-password (flujo privado, no debe indexarse)
// - Dashboards de admin/profesional (detrás de auth)
//
// Las secciones de la landing (#nosotros, #especialidades, #como-funciona,
// #testimonios, #contacto) NO se incluyen como URLs separadas porque Google
// no indexa anchor links en sitemaps. El contenido de todas las secciones
// está en la misma página / y se indexa como un todo.

const BASE_URL = "https://www.redescuchapsicologica.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];
}
