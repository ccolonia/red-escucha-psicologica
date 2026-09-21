import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fromSlug } from "@/lib/seo-helpers";

// ============================================================================
// Helpers de normalización y parsing robusto
// ============================================================================

// Normaliza texto para comparación insensible a:
//  - Mayúsculas/minúsculas
//  - Acentos/diacríticos (á→a, ñ→n, ü→u, etc.)
//  - Espacios al inicio/final
//  - Espacios múltiples internos (colapsados a uno)
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita diacríticos
    .trim()
    .replace(/\s+/g, " ");
}

// Parsea el campo `zones` (o `therapyTypes`) que puede venir en cualquiera
// de los siguientes formatos desde Prisma:
//   1. String JSON válido:   '["Caballito", "Belgrano"]'
//   2. Array de strings:     ["Caballito", "Belgrano"]  (caso raro, fallback)
//   3. String separado por comas: "Caballito, Belgrano"
//   4. null/undefined/vacío: []
function parseZones(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // Intentar JSON.parse
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch { /* no es JSON */ }
  // Fallback: split por coma
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ============================================================================
// GET /api/public/professionals?zona=merlo&especialidad=ansiedad-y-ataques-de-panico
//
// Endpoint PÚBLICO (sin auth) para SEO programático y Triage Wizard.
// Devuelve profesionales filtrados por zona y/o especialidad.
// Fallback automático: si no hay resultados, devuelve todos los activos.
//
// ⚠️ SEGURIDAD CRÍTICA (2026-09-22):
//   Solo se devuelven profesionales cuyo User asociado tiene:
//     - isApproved = true   (aprobado por admin desde panel)
//     - active     = true   (no dado de baja)
//   Profesionales pendientes, rechazados o inactivos quedan EXCLUIDOS.
//   Este filtro es OBLIGATORIO y no tiene bypass.
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zonaSlug = searchParams.get("zona");
    const especialidadSlug = searchParams.get("especialidad");

    // === 1. Consulta con FILTRO ESTRICTO de aprobación ===
    //    Solo profesionales aprobados por el admin (User.isApproved === true)
    //    y con cuenta activa (User.active === true).
    //    Esto evita que profesionales pendientes (ej: Gabriela Botella)
    //    aparezcan en búsquedas públicas, landings SEO o Triage Wizard.
    const allProfessionals = await db.professional.findMany({
      where: {
        user: {
          isApproved: true,
          active: true,
        },
      },
      select: {
        id: true,
        specialty: true,
        title: true,
        profession: true,
        bio: true,
        onlineAttention: true,
        presentialAttention: true,
        homeAttention: true,
        zones: true,
        officeAddress: true,
        therapyTypes: true, // Necesario para el filtro por especialidad
        user: { select: { name: true, phone: true } },
      },
      take: 100, // Suficiente margen para los 45 profesionales aprobados actuales
    });

    if (allProfessionals.length === 0) {
      return NextResponse.json({
        professionals: [],
        total: 0,
        zona: zonaSlug ? fromSlug(zonaSlug) : null,
        especialidad: especialidadSlug ? fromSlug(especialidadSlug) : null,
        debug: "No hay profesionales en la DB",
      });
    }

    // === 2. Filtrar en JavaScript (más robusto que Prisma para JSON strings) ===
    //    IMPORTANTE: el filtrado por zona DEBE ser estricto. La conmutación
    //    al modo "fallback online" la maneja el cliente (TriageWizard) cuando
    //    exactZoneMatches.length === 0. Acá NO incluimos online como fallback
    //    automático de zona, porque eso rompe la lógica de fallback del cliente.
    let filtered = allProfessionals;

    if (zonaSlug) {
      const zonaName = normalizeText(fromSlug(zonaSlug));
      filtered = filtered.filter((p) => {
        const zones = parseZones(p.zones);
        if (zones.length === 0) return false;
        return zones.some((z) => {
          const zNorm = normalizeText(z);
          return zNorm.includes(zonaName) || zonaName.includes(zNorm);
        });
      });
      // NOTA: si filtered.length === 0 después de este filtro, NO hacemos
      // fallback acá. Devolvemos array vacío y el TriageWizard decidirá
      // si muestra el cartel amarillo + listado online.
    }

    if (especialidadSlug) {
      const especialidadName = normalizeText(fromSlug(especialidadSlug));
      filtered = filtered.filter((p) => {
        // Buscar en specialty
        if (p.specialty && normalizeText(p.specialty).includes(especialidadName)) return true;
        // Buscar en therapyTypes (JSON string array)
        const types = parseZones(p.therapyTypes);
        return types.some((t) => normalizeText(t).includes(especialidadName));
      });
    }

    // === 3. Sin fallback final en la API ===
    //    Antes: si el filtro devolvía 0, usábamos todos los aprobados.
    //    Ahora: devolvemos array vacío y dejamos que el cliente decida.
    //    El TriageWizard implementa el fallback online con mensaje explícito.

    // === 4. Formatear respuesta ===
    const formatted = filtered.map((p) => ({
      id: p.id,
      name: p.user?.name || "Profesional",
      title: p.title || "",
      profession: p.profession || "",
      specialty: p.specialty,
      bio: p.bio || "",
      onlineAttention: p.onlineAttention,
      presentialAttention: p.presentialAttention,
      homeAttention: p.homeAttention,
      zones: parseZones(p.zones), // usar helper robusto
      officeAddress: p.officeAddress || null,
      phone: p.user?.phone || null,
    }));

    return NextResponse.json({
      professionals: formatted,
      total: formatted.length,
      zona: zonaSlug ? fromSlug(zonaSlug) : null,
      especialidad: especialidadSlug ? fromSlug(especialidadSlug) : null,
    });
  } catch (error) {
    console.error("[public/professionals] Error:", error);
    return NextResponse.json(
      { error: "Error al buscar profesionales", detail: String(error), professionals: [], total: 0 },
      { status: 500 }
    );
  }
}
