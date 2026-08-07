/**
 * Helper central para formatear nombres de profesionales con su título/prefijo.
 */
export type ProfessionalNameInput = {
  name: string;
  title?: string | null;
  profession?: string | null;
  specialty?: string | null;
};

export function formatProfessionalName(
  prof: ProfessionalNameInput,
  format: "standard" | "formal" = "standard",
  detailSource: "title" | "specialty" = "title"
): string {
  const prefix = prof.title && prof.title !== "Ninguno" ? prof.title.trim() : "";
  const baseName = prof.name?.trim() || "";
  const fullName = prefix ? `${prefix} ${baseName}` : baseName;
  if (format === "standard") return fullName;
  let detail = "";
  if (detailSource === "title") {
    const isShortPrefix = ["Lic.", "Dr.", "Dra.", "Psic.", "Ninguno"].includes(prefix);
    if (isShortPrefix) detail = prof.profession?.trim() || prof.specialty?.trim() || "";
    else detail = prof.title?.trim() || "";
  } else detail = prof.specialty?.trim() || "";
  return detail ? `${fullName} (${detail})` : fullName;
}

export function formatProfessionalShort(prof: ProfessionalNameInput): string {
  return formatProfessionalName(prof, "standard");
}

export function getProfessionalPrefix(prof: ProfessionalNameInput): string {
  const prefix = prof.title?.trim() || "";
  return prefix && prefix !== "Ninguno" ? prefix : "";
}
