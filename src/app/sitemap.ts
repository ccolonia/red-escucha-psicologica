import { MetadataRoute } from "next";
import { ALL_ZONES, INDEXABLE_SPECIALTIES, toSlug } from "@/lib/seo-helpers";

// === Sitemap para Google Search Console ===
// Next.js App Router sirve automáticamente este archivo en /sitemap.xml
//
// Incluye:
// - Página principal (/)
// - Páginas de psicólogos por zona (/psicologos/[zona])
// - Páginas de psicólogos por zona + especialidad (/psicologos/[zona]/[especialidad])
//
// NO incluye:
// - /reset-password (flujo privado)
// - /set-password (flujo privado)
// - Dashboards de admin/profesional (detrás de auth)

const BASE_URL = "https://www.redescuchapsicologica.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];

  // Páginas por zona
  for (const zona of ALL_ZONES) {
    const zonaSlug = toSlug(zona);
    entries.push({
      url: `${BASE_URL}/psicologos/${zonaSlug}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    // Páginas por zona + especialidad
    for (const esp of INDEXABLE_SPECIALTIES) {
      const espSlug = toSlug(esp);
      entries.push({
        url: `${BASE_URL}/psicologos/${zonaSlug}/${espSlug}`,
        lastModified,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
