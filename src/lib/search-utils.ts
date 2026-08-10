/**
 * Normalización de texto para búsquedas insensibles a tildes, mayúsculas y diacríticos.
 * Implementación 100% blindada contra null/undefined/números/objetos.
 */

// 1. Normalización ultra-segura contra null/undefined/números
export function normalizeText(str: any): string {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') {
    if (Array.isArray(str)) return str.map(normalizeText).join(' ');
    str = String(str);
  }
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// 2. Extractor seguro de JSON / Array / Strings anidados
export function safeExtract(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    if (val.startsWith('[') || val.startsWith('{')) {
      try {
        const parsed = JSON.parse(val);
        return safeExtract(parsed);
      } catch {
        return normalizeText(val);
      }
    }
    return normalizeText(val);
  }
  if (Array.isArray(val)) {
    return val.map(safeExtract).join(' ');
  }
  if (typeof val === 'object') {
    return Object.values(val).map(safeExtract).join(' ');
  }
  return normalizeText(val);
}

// 3. Construcción del texto consolidado del profesional
export function buildSearchableText(p: any): string {
  try {
    const fields = [
      p.firstName,
      p.lastName,
      p.name,
      p.user?.firstName,
      p.user?.lastName,
      p.user?.name,
      p.email,
      p.user?.email,
      p.profession,
      p.specialty,
      p.bio,
      p.officeAddress,
      p.license,
      safeExtract(p.zones),
      safeExtract(p.therapyTypes),
      safeExtract(p.targetAudience),
      safeExtract(p.therapyModality),
      safeExtract(p.otherTherapyDetails),
    ];

    return fields.map(normalizeText).join(' ');
  } catch (err) {
    console.error("Error building searchable text for professional:", p?.id, err);
    return '';
  }
}

// 4. Filtrado principal
export function filterProfessionals(professionals: any[], query: string): any[] {
  if (!query || !query.trim()) return professionals;

  const normalizedQuery = normalizeText(query);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) return professionals;

  return professionals.filter(p => {
    try {
      const searchableText = buildSearchableText(p);
      return queryTokens.every(token => searchableText.includes(token));
    } catch (err) {
      console.error("Error filtering prof:", p?.id, err);
      return false;
    }
  });
}

// Mantener compatibilidad con imports anteriores
export function tokenizeSearch(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

export function matchesAllTokens(tokens: string[], fields: (string | null | undefined)[]): boolean {
  if (tokens.length === 0) return true;
  const normalizedFields = fields.map(normalizeText).join(' ');
  return tokens.every(token => normalizedFields.includes(token));
}
