import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fromSlug, toSlug } from "@/lib/seo-helpers";

// ============================================================================
// GET /api/public/professionals?zona=merlo&especialidad=ansiedad-y-ataques-de-panico
//
// Endpoint PÚBLICO (sin auth) para SEO programático.
// Devuelve profesionales activos filtrados por zona y/o especialidad.
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zonaSlug = searchParams.get("zona");
    const especialidadSlug = searchParams.get("especialidad");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      available: true,
      user: { active: true, isApproved: true },
    };

    // Filtrar por zona — si se especifica zona, buscar en zones (JSON string)
    // o también incluir profesionales con atención online (fallback)
    if (zonaSlug) {
      const zonaName = fromSlug(zonaSlug);
      where.OR = [
        { zones: { contains: zonaName, mode: "insensitive" } },
        { onlineAttention: true }, // incluir profesionales online como fallback
      ];
    }

    // Filtrar por especialidad
    if (especialidadSlug) {
      const especialidadName = fromSlug(especialidadSlug);
      where.OR = [
        { specialty: { contains: especialidadName, mode: "insensitive" } },
        { therapyTypes: { contains: especialidadName, mode: "insensitive" } },
      ];
    }

    const professionals = await db.professional.findMany({
      where,
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
        addresses: { select: { id: true, label: true, address: true, isActive: true } },
        user: { select: { name: true, email: true, phone: true } },
      },
      take: 50,
      orderBy: { user: { name: "asc" } },
    });

    // Formatear respuesta
    const formatted = professionals.map((p) => ({
      id: p.id,
      name: p.user.name,
      title: p.title || "",
      profession: p.profession || "",
      specialty: p.specialty,
      bio: p.bio || "",
      onlineAttention: p.onlineAttention,
      presentialAttention: p.presentialAttention,
      homeAttention: p.homeAttention,
      zones: p.zones ? JSON.parse(p.zones) : [],
      officeAddress: p.officeAddress || null,
      addresses: p.addresses || [],
      phone: p.user.phone || null,
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
      { error: "Error al buscar profesionales", professionals: [], total: 0 },
      { status: 500 }
    );
  }
}
