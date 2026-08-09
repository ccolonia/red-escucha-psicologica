/**
 * Normalización de texto para búsquedas insensibles a tildes, mayúsculas y diacríticos.
 *
 * Uso:
 *   normalizeText("Psicología Clínica") → "psicologia clinica"
 *   normalizeText("Mónica") → "monica"
 *   normalizeText("Niños/as") → "ninos/as"
 */
export function normalizeText(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve tildes y diacríticos
    .trim();
}

/**
 * Divide un término de búsqueda en tokens (palabras) normalizados.
 * Ej: "Monica psicologia niños" → ["monica", "psicologia", "ninos"]
 */
export function tokenizeSearch(query: string): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Verifica si TODOS los tokens de búsqueda están presentes en al menos
 * uno de los campos proporcionados del profesional.
 *
 * @param tokens - Array de palabras normalizadas a buscar
 * @param fields - Array de strings (campos del profesional) ya normalizados
 * @returns true si todos los tokens coinciden en al menos un campo
 */
export function matchesAllTokens(tokens: string[], fields: (string | null | undefined)[]): boolean {
  if (tokens.length === 0) return true;
  const normalizedFields = fields.map(normalizeText).join(" ");
  return tokens.every((token) => normalizedFields.includes(token));
}

/**
 * Versión alternativa: verifica si AL MENOS UN token coincide.
 * Útil para búsquedas tipo OR (más permisivas).
 */
export function matchesAnyToken(tokens: string[], fields: (string | null | undefined)[]): boolean {
  if (tokens.length === 0) return true;
  const normalizedFields = fields.map(normalizeText).join(" ");
  return tokens.some((token) => normalizedFields.includes(token));
}
