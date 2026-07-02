import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// === POST /api/admin/sanitize-professional-tags ===
// Endpoint UNICAMENTE para admin/super_admin que ejecuta el saneamiento
// de los arrays legacy de tags (targetAudience, therapyTypes, therapyModality)
// en todos los registros de Professional.
//
// Por qué existe este endpoint:
//   El build de Vercel usa `prisma db push` (no `prisma migrate deploy`),
//   lo que significa que las migraciones SQL personalizadas (con funciones
//   y UPDATEs) NUNCA se ejecutan en producción. Para sortear esto, este
//   endpoint ejecuta la misma lógica de saneamiento desde el código
//   usando prisma.$transaction.
//
// Qué hace:
//   1. Lee todos los profesionales con sus 3 campos de arrays
//   2. Para cada uno, parsea el JSON, filtra dejando solo valores
//      canónicos, dedupea, y vuelve a serializar
//   3. Si el array queda vacío, setea el campo a NULL
//   4. Devuelve un reporte con cuántos registros fueron saneados
//
// Uso:
//   POST /api/admin/sanitize-professional-tags
//   (sin body — el saneamiento es automático y total)
//
// Respuesta:
//   200 → { ok, totalProcessed, sanitized: {...} }
//   401 → no autenticado
//   403 → no es admin
//   500 → error

const CANONICAL = {
  targetAudience: [
    "Adolescentes",
    "Adultos",
    "Adultos mayores",
    "Familias",
    "Jóvenes",
    "Niños/as",
    "Orientación a padres",
    "Parejas",
  ],
  therapyTypes: [
    "Adicciones",
    "Deportología",
    "EMDR",
    "Logoterapia",
    "Mindfulness",
    "Neuropsicología",
    "Otras terapias",
    "Psicooncología",
    "Psicoanálisis",
    "Psicocorporal Reichiana",
    "Psicodrama",
    "Psicología clínica",
    "Psicología deportiva",
    "Psicología forense",
    "Psicología geriátrica",
    "Psicología laboral / organizacional",
    "Psicología perinatal",
    "Psicología positiva",
    "Psicoterapia Integral",
    "Psiconutrición",
    "Terapia cognitivo-conductual",
    "Terapia constructivista",
    "Terapia gestáltica",
    "Terapia humanista",
    "Terapia junguiana",
    "Terapia sistémica",
    "Terapia transpersonal",
    "Terapias vinculares",
    "Trastornos alimentarios",
  ],
  therapyModality: [
    "Asesoría a Empresas",
    "Discapacidad",
    "Evaluaciones",
    "Individual",
    "Orientación a Padres",
    "Orientación Vocacional",
    "Pericias",
    "Terapia Grupal",
    "Vincular",
  ],
};

// Sanea un array JSON string: parsea, filtra por canónicos, dedupea, re-serializa
function sanitizeJsonArray(
  raw: string | null | undefined,
  canonical: string[]
): string | null {
  if (!raw || typeof raw !== "string" || raw.trim() === "" || raw === "null") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const canonicalLower = new Set(canonical.map((c) => c.toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!canonicalLower.has(key)) continue; // descarta valores no canónicos
    if (seen.has(key)) continue; // dedup case-insensitive
    seen.add(key);
    result.push(trimmed);
  }

  return result.length > 0 ? JSON.stringify(result) : null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json(
        { error: "Solo admin/super_admin puede ejecutar el saneamiento" },
        { status: 403 }
      );
    }

    // Leer todos los profesionales con sus 3 campos
    const professionals = await db.professional.findMany({
      select: {
        id: true,
        targetAudience: true,
        therapyTypes: true,
        therapyModality: true,
      },
    });

    const report = {
      targetAudience: { changed: 0, cleared: 0 },
      therapyTypes: { changed: 0, cleared: 0 },
      therapyModality: { changed: 0, cleared: 0 },
    };

    // Saneamos cada profesional en una transacción para evitar
    // dejar la DB en estado inconsistente si algo falla a mitad.
    await db.$transaction(async (tx) => {
      for (const prof of professionals) {
        const newTargetAudience = sanitizeJsonArray(
          prof.targetAudience,
          CANONICAL.targetAudience
        );
        const newTherapyTypes = sanitizeJsonArray(
          prof.therapyTypes,
          CANONICAL.therapyTypes
        );
        const newTherapyModality = sanitizeJsonArray(
          prof.therapyModality,
          CANONICAL.therapyModality
        );

        const updates: Prisma.ProfessionalUpdateInput = {};

        if (newTargetAudience !== prof.targetAudience) {
          updates.targetAudience = newTargetAudience;
          if (newTargetAudience === null) report.targetAudience.cleared++;
          else report.targetAudience.changed++;
        }
        if (newTherapyTypes !== prof.therapyTypes) {
          updates.therapyTypes = newTherapyTypes;
          if (newTherapyTypes === null) report.therapyTypes.cleared++;
          else report.therapyTypes.changed++;
        }
        if (newTherapyModality !== prof.therapyModality) {
          updates.therapyModality = newTherapyModality;
          if (newTherapyModality === null) report.therapyModality.cleared++;
          else report.therapyModality.changed++;
        }

        if (Object.keys(updates).length > 0) {
          await tx.professional.update({
            where: { id: prof.id },
            data: updates,
          });
        }
      }
    });

    return NextResponse.json({
      ok: true,
      totalProcessed: professionals.length,
      sanitized: report,
      message:
        `Saneamiento completo. ${professionals.length} profesionales procesados. ` +
        `targetAudience: ${report.targetAudience.changed} modificados, ${report.targetAudience.cleared} vaciados. ` +
        `therapyTypes: ${report.therapyTypes.changed} modificados, ${report.therapyTypes.cleared} vaciados. ` +
        `therapyModality: ${report.therapyModality.changed} modificados, ${report.therapyModality.cleared} vaciados.`,
    });
  } catch (error) {
    console.error("Sanitize professional tags error:", error);
    return NextResponse.json(
      {
        error: "Error al ejecutar el saneamiento",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET devuelve info sobre el endpoint (no ejecuta nada)
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/sanitize-professional-tags",
    method: "POST",
    description:
      "Ejecuta saneamiento de arrays legacy de tags (targetAudience, therapyTypes, therapyModality) en todos los profesionales. Solo admin/super_admin.",
    canonical: CANONICAL,
  });
}
