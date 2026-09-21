import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fromSlug } from "@/lib/seo-helpers";

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
    let filtered = allProfessionals;

    if (zonaSlug) {
      const zonaName = fromSlug(zonaSlug).toLowerCase();
      filtered = filtered.filter((p) => {
        // Buscar zona en el campo zones (JSON string array)
        if (p.zones) {
          try {
            const zones = JSON.parse(p.zones) as string[];
            if (zones.some((z) => z.toLowerCase().includes(zonaName) || zonaName.includes(z.toLowerCase()))) {
              return true;
            }
          } catch { /* zones no es JSON válido */ }
        }
        // Fallback: incluir profesionales con atención online
        if (p.onlineAttention) return true;
        return false;
      });
    }

    if (especialidadSlug) {
      const especialidadName = fromSlug(especialidadSlug).toLowerCase();
      filtered = filtered.filter((p) => {
        // Buscar en specialty
        if (p.specialty && p.specialty.toLowerCase().includes(especialidadName)) return true;
        // Buscar en therapyTypes (JSON string array)
        if (p.therapyTypes) {
          try {
            const types = JSON.parse(p.therapyTypes) as string[];
            if (types.some((t) => t.toLowerCase().includes(especialidadName))) return true;
          } catch { /* */ }
        }
        return false;
      });
    }

    // === 3. Fallback final: si el filtro devuelve 0, usar todos los APROBADOS ===
    //    (NUNCA incluye pendientes: allProfessionals ya está filtrado por isApproved)
    if (filtered.length === 0) {
      filtered = allProfessionals;
    }

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
      zones: p.zones ? (() => { try { return JSON.parse(p.zones); } catch { return []; } })() : [],
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
