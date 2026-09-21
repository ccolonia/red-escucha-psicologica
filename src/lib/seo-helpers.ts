import { SPECIALTIES } from "@/lib/professional-categories";

// ============================================================================
// HELPERS PARA SEO PROGRAMÁTICO
// Convierte nombres de zonas y especialidades a slugs URL-friendly y viceversa.
// ============================================================================

/**
 * Convierte un texto a slug URL-friendly.
 * Ej: "Ansiedad y Ataques de Pánico" → "ansiedad-y-ataques-de-panico"
 * Ej: "Vicente López" → "vicente-lopez"
 */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[^a-z0-9\s-]/g, "") // quitar caracteres especiales
    .replace(/\s+/g, "-") // espacios → guiones
    .replace(/-+/g, "-") // múltiples guiones → uno solo
    .replace(/^-|-$/g, ""); // quitar guiones al inicio/fin
}

/**
 * Convierte un slug a texto legible (para mostrar en la UI).
 * Ej: "ansiedad-y-ataques-de-panico" → "Ansiedad y Ataques de Pánico"
 */
export function fromSlug(slug: string): string {
  // Intentar matchear con una especialidad conocida
  const match = SPECIALTIES.find(
    (s) => toSlug(s) === slug
  );
  if (match) return match;

  // Si no matchea, capitalizar cada palabra
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Lista de todas las zonas disponibles (para sitemap y navegación).
 * Debe coincidir con las zonas del formulario de registro.
 */
export const ALL_ZONES: string[] = [
  // CABA
  "Abasto", "Agronomía", "Almagro", "Balvanera (Once)", "Barracas",
  "Belgrano", "Boedo", "Caballito", "Chacarita", "Coghlan",
  "Colegiales", "Congreso - Tribunales", "Constitución", "Flores", "Floresta",
  "La Boca", "La Paternal", "Liniers", "Mataderos", "Monserrat",
  "Monte Castro", "Nueva Pompeya", "Núñez", "Palermo", "Parque Avellaneda",
  "Parque Chacabuco", "Parque Chas", "Parque Patricios", "Puerto Madero",
  "Recoleta - Barrio Norte", "Retiro", "Saavedra", "San Cristobal",
  "San Nicolas", "San Telmo", "Vélez Sarsfield", "Versalles",
  "Villa Crespo", "Villa del Parque", "Villa Devoto", "Villa General Mitre",
  "Villa Lugano", "Villa Luro", "Villa Ortúzar", "Villa Pueyrredón",
  "Villa Real", "Villa Riachuelo", "Villa Santa Rita", "Villa Soldati",
  "Villa Urquiza",
  // GBA Norte
  "Escobar", "General San Martin", "Pilar", "San Fernando",
  "San Isidro", "Tigre - Nordelta", "Vicente López",
  // GBA Oeste
  "General Rodriguez", "Hurlingham", "Ituzaingó", "La Matanza",
  "Merlo", "Moreno", "Morón", "San Miguel", "Tres de Febrero",
  // GBA Sur
  "Almirante Brown", "Avellaneda", "Berazategui", "Esteban Echeverría",
  "Ezeiza", "Florencio Varela", "Lanús", "Lomas de Zamora",
  "Presidente Peron", "Quilmes", "San Vicente",
];

/**
 * Lista de slugs de zonas para el sitemap.
 */
export const ZONE_SLUGS = ALL_ZONES.map(toSlug);

/**
 * Lista de slugs de especialidades para el sitemap.
 */
export const SPECIALTY_SLUGS = SPECIALTIES.map(toSlug);

/**
 * Lista de slugs de especialidades que los profesionales pueden tener
 * (incluye tipos de terapia, no solo especialidades del select).
 * Por ahora usamos las del SPECIALTIES que es lo que se muestra en la landing.
 */
export const INDEXABLE_SPECIALTIES = SPECIALTIES;
