// ============================================================================
// Generador de datos estructurados Schema.org (JSON-LD)
// Para SEO programático en /psicologos/[zona] y /psicologos/[zona]/[especialidad]
// ============================================================================

interface JsonLdProfessional {
  id: string;
  specialty: string;
  title?: string | null;
  profession?: string | null;
  bio?: string | null;
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  officeAddress?: string | null;
  user: { name: string; phone?: string | null };
}

/**
 * Genera el JSON-LD para una página de listado de profesionales.
 * Usa el tipo `ItemList` con items de tipo `Physician` (Schema.org).
 *
 * @param professionals Lista de profesionales a incluir
 * @param zonaName Nombre de la zona (ej: "Merlo")
 * @param especialidadName Nombre de la especialidad (ej: "Ansiedad y Ataques de Pánico") o null
 * @returns Objeto JSON-LD listo para ser serializado en un <script type="application/ld+json">
 */
export function generateJsonLd(
  professionals: JsonLdProfessional[],
  zonaName: string,
  especialidadName: string | null
) {
  const itemListElements = professionals.map((prof, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Physician",
      name: prof.title ? `${prof.title} ${prof.user.name}` : prof.user.name,
      medicalSpecialty: prof.specialty,
      description: prof.bio || `Profesional especializado en ${prof.specialty} en ${zonaName}`,
      address: {
        "@type": "PostalAddress",
        addressLocality: zonaName,
        addressRegion: "Buenos Aires",
        addressCountry: "AR",
      },
      telephone: prof.user.phone || undefined,
      availableService: {
        "@type": "MedicalProcedure",
        name: prof.specialty,
        location: {
          "@type": "Place",
          name: zonaName,
        },
      },
      ...(prof.onlineAttention ? {
        areaServed: {
          "@type": "Place",
          name: "Argentina (Online)",
        },
      } : {}),
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: especialidadName
      ? `Psicólogos en ${zonaName} — ${especialidadName}`
      : `Psicólogos en ${zonaName}`,
    description: especialidadName
      ? `Listado de profesionales matriculados especializados en ${especialidadName} con atención en ${zonaName}.`
      : `Listado de profesionales matriculados con atención en ${zonaName}.`,
    numberOfItems: professionals.length,
    itemListElement: itemListElements,
  };
}
