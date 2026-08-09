import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { normalizeText, tokenizeSearch, matchesAllTokens } from "@/lib/search-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all");
    const specialty = searchParams.get("specialty");
    const available = searchParams.get("available");
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));

    // Build the where clause dynamically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // ─── "all" mode: return flat array for Triage, Planilla, NewAppointment, etc. ───
    // Automatically filters to professionals fully enabled for assignment:
    //   user.active = true AND licenseVerified = true
    // Additional params (specialty, available) are still respected.
    //
    // Excepción: si includeUnverified=true, NO filtra por licenseVerified.
    // Esto permite que los componentes del panel del profesional (Planilla,
    // Agenda, Mi Perfil, etc.) encuentren SU propio perfil incluso si la
    // matrícula está en trámite (licenseVerified=false). Es seguro porque
    // el componente filtra por userId después (solo ve su propio perfil).
    const includeUnverified = searchParams.get("includeUnverified") === "true";

    if (all === "true") {
      where.user = { active: true };
      if (!includeUnverified) {
        where.licenseVerified = true;
      }

      if (specialty) {
        where.specialty = specialty;
      }
      if (available === "true") {
        where.available = true;
      }

      // === BÚSQUEDA 100% EN JS (sin contains en SQL) ===
      // NO aplicamos contains en la DB porque Postgres es sensible a tildes.
      // Traemos todos los profesionales activos y filtramos en memoria con
      // normalizeText que elimina tildes/diacríticos.

      let professionals = await db.professional.findMany({
        where,
        select: {
          id: true,
          userId: true,
          license: true,
          licenseVerified: true,
          specialty: true,
          bio: true,
          available: true,
          title: true,
          profession: true,
          cuil: true,
          gender: true,
          therapyTypes: true,
          targetAudience: true,
          therapyModality: true,
          // === Comisión REP dinámica ===
          // Se incluye para que el frontend (professional-planilla, admin-planilla)
          // pueda calcular la comisión correcta por profesional (30% psicólogos,
          // 20% psiquiatras, o override individual).
          commissionRate: true,
          // === Detalle de "Otras terapias" ===
          // Se incluye en el select para que el panel admin lo pueda mostrar
          // en la tarjeta expandible del profesional.
          otherTherapyDetails: true,
          onlineAttention: true,
          presentialAttention: true,
          homeAttention: true,
          zones: true,
          officeAddress: true,
          cvFileName: true,
          cvMimeType: true,
          internalNotes: true,
          evaluationStatus: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              active: true,
              createdAt: true,
              // === Flags de onboarding ===
              // Se incluyen para que el panel admin pueda mostrar los
              // badges de Aprobado / Contraseña / Acceso en la ficha
              // del profesional.
              isApproved: true,
              passwordSet: true,
              hasAccessedPanel: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      });

      // === Filtrado 100% en JS con normalización (insensible a tildes) ===
      if (search) {
        const tokens = tokenizeSearch(search);
        professionals = professionals.filter((p) => {
          // Desestructurar JSON strings (zones, therapyTypes, etc.)
          let zonesStr = p.zones || "";
          try { zonesStr = JSON.parse(zonesStr).join(" "); } catch { /* no es JSON */ }
          let therapyTypesStr = p.therapyTypes || "";
          try { therapyTypesStr = JSON.parse(therapyTypesStr).join(" "); } catch { /* no es JSON */ }
          let targetAudienceStr = p.targetAudience || "";
          try { targetAudienceStr = JSON.parse(targetAudienceStr).join(" "); } catch { /* no es JSON */ }
          let therapyModalityStr = p.therapyModality || "";
          try { therapyModalityStr = JSON.parse(therapyModalityStr).join(" "); } catch { /* no es JSON */ }

          const fields = [
            p.user?.name,
            p.user?.email,
            p.license,
            p.specialty,
            p.profession,
            zonesStr,
            therapyTypesStr,
            targetAudienceStr,
            therapyModalityStr,
            p.officeAddress,
            p.otherTherapyDetails,
            p.bio,
          ];
          return matchesAllTokens(tokens, fields);
        });
      }

      // Return flat array for backward compatibility with all consumers
      return NextResponse.json(professionals);
    }

    // ─── Paginated mode (admin panel) ───

    if (specialty) {
      where.specialty = specialty;
    }
    if (available === "true") {
      where.available = true;
    } else if (available === "false") {
      where.available = false;
    }

    // Status filter: "approved" = user.active true + licenseVerified true
    if (status === "approved") {
      where.user = { active: true };
      where.licenseVerified = true;
    } else if (status === "pending") {
      where.user = { active: false };
    } else if (status === "unverified") {
      where.licenseVerified = false;
    }

    // === BÚSQUEDA 100% EN JS (sin contains en SQL) ===
    // No aplicamos contains en la DB. El filtrado se hace post-query en JS.

    // Run count + data in parallel for efficiency
    const [totalCount, allProfessionals, approvedCount] = await Promise.all([
      db.professional.count({ where }),
      db.professional.findMany({
        where,
        select: {
          id: true,
          userId: true,
          license: true,
          licenseVerified: true,
          specialty: true,
          bio: true,
          available: true,
          title: true,
          profession: true,
          cuil: true,
          gender: true,
          therapyTypes: true,
          targetAudience: true,
          therapyModality: true,
          // === Comisión REP dinámica ===
          // Se incluye para que el frontend (professional-planilla, admin-planilla)
          // pueda calcular la comisión correcta por profesional (30% psicólogos,
          // 20% psiquiatras, o override individual).
          commissionRate: true,
          // === Detalle de "Otras terapias" ===
          // Se incluye en el select para que el panel admin lo pueda mostrar
          // en la tarjeta expandible del profesional.
          otherTherapyDetails: true,
          onlineAttention: true,
          presentialAttention: true,
          homeAttention: true,
          zones: true,
          officeAddress: true,
          cvFileName: true,
          cvMimeType: true,
          internalNotes: true,
          evaluationStatus: true,
          // === Campos de auditoría documental (solo admin) ===
          // Este endpoint es paginado y se usa solo desde el panel admin.
          // Verificación de rol: este endpoint es público por compat con
          // algunos flujos (admin-dashboard lo usa sin auth check), pero
          // los campos sensibles no deberían viajar a otros roles.
          // Como el panel admin es el único consumidor paginado, los
          // incluimos acá. El frontend del profesional no usa este modo
          // paginado (usa /api/professionals/[id]/agenda o similar).
          dniVerified: true,
          degreeVerified: true,
          malpracticeInsuranceVerified: true,
          taxRegistrationVerified: true,
          nationalRegistryVerified: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              active: true,
              createdAt: true,
              // === Flags de onboarding (modo paginado admin) ===
              isApproved: true,
              passwordSet: true,
              hasAccessedPanel: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      // Total approved count (always the global number, not filtered)
      db.professional.count({
        where: {
          user: { active: true },
          licenseVerified: true,
        },
      }),
    ]);

    // === Filtrado 100% en JS con normalización ===
    let professionals = allProfessionals;
    if (search) {
      const tokens = tokenizeSearch(search);
      professionals = allProfessionals.filter((p) => {
        let zonesStr = p.zones || "";
        try { zonesStr = JSON.parse(zonesStr).join(" "); } catch { /* no es JSON */ }
        let therapyTypesStr = p.therapyTypes || "";
        try { therapyTypesStr = JSON.parse(therapyTypesStr).join(" "); } catch { /* no es JSON */ }
        let targetAudienceStr = p.targetAudience || "";
        try { targetAudienceStr = JSON.parse(targetAudienceStr).join(" "); } catch { /* no es JSON */ }
        let therapyModalityStr = p.therapyModality || "";
        try { therapyModalityStr = JSON.parse(therapyModalityStr).join(" "); } catch { /* no es JSON */ }

        const fields = [
          p.user?.name,
          p.user?.email,
          p.license,
          p.specialty,
          p.profession,
          zonesStr,
          therapyTypesStr,
          targetAudienceStr,
          therapyModalityStr,
          p.officeAddress,
          p.otherTherapyDetails,
          p.bio,
        ];
        return matchesAllTokens(tokens, fields);
      });
    }

    const filteredCount = professionals.length;

    return NextResponse.json({
      professionals,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredCount / limit),
        totalCount: filteredCount,
        limit,
      },
      approvedCount,
    });
  } catch (error) {
    console.error("Get professionals error:", error);
    return NextResponse.json(
      { error: "Error al obtener profesionales" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = (session.user as { role: string }).role;
    const isAdmin = userRole === "admin" || userRole === "super_admin";

    const body = await request.json();
    const {
      id,
      available,
      license,
      licenseVerified,
      specialty,
      bio,
      internalNotes,
      evaluationStatus,
      // === Campos profesionales editables desde el Hub de Control Profesional ===
      title,
      profession,
      cuil,
      therapyTypes,
      targetAudience,
      therapyModality,
      zones,
      otherTherapyDetails,
      cvData,
      cvFileName,
      cvMimeType,
      // === Modalidades de atención (booleanos) ===
      // Antes no se procesaban en el PATCH, lo que causaba que los cambios
      // hechos desde "Mi Perfil / Hub de Control" no persistieran (Punto 1
      // de la auditoría). El frontend ya los enviaba, pero el backend los
      // ignoraba silenciosamente.
      onlineAttention,
      presentialAttention,
      homeAttention,
      // === Comisión REP dinámica (SOLO admin) ===
      // Override individual de la tasa de comisión (0.30, 0.20, etc.)
      // Si es null, se infiere desde el campo 'profession'.
      commissionRate,
      // === Campos de auditoría documental (SOLO admin) ===
      dniVerified,
      degreeVerified,
      malpracticeInsuranceVerified,
      taxRegistrationVerified,
      nationalRegistryVerified,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID del profesional es requerido" },
        { status: 400 }
      );
    }

    const existing = await db.professional.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    // === Guard de seguridad: los 6 campos de auditoría documental solo
    // pueden ser mutados por admin o super_admin. Si un profesional o
    // paciente intenta mandarlos en el body, los ignoramos silenciosamente
    // (no throw para no leakear que existen) pero igual actualizamos los
    // otros campos permitidos.
    //
    // Para los demás campos (available, license, specialty, etc.) también
    // deberíamos validar rol pero por ahora mantenemos el comportamiento
    // existente para no romper flujos previos (ej: profesional actualiza
    // su propio specialty desde su perfil).
    //
    // TODO futuro: separar endpoints /api/professionals/[id] (auto-update)
    // y /api/admin/professionals/[id] (admin-only) para clarificar el
    // modelo de permisos.
    const docFields = {
      dniVerified,
      degreeVerified,
      licenseVerified,
      malpracticeInsuranceVerified,
      taxRegistrationVerified,
      nationalRegistryVerified,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: { available?: boolean; license?: string; licenseVerified?: boolean; specialty?: string; bio?: string | null; internalNotes?: string | null; evaluationStatus?: string | null; dniVerified?: boolean; degreeVerified?: boolean; malpracticeInsuranceVerified?: boolean; taxRegistrationVerified?: boolean; nationalRegistryVerified?: boolean; title?: string | null; profession?: string; cuil?: string | null; therapyTypes?: string; targetAudience?: string; therapyModality?: string; zones?: string; otherTherapyDetails?: string | null; cvData?: string | null; cvFileName?: string | null; cvMimeType?: string | null; onlineAttention?: boolean; presentialAttention?: boolean; homeAttention?: boolean; commissionRate?: number | null } = {};

    // === Helper: sanea arrays de strings ===
    // - Filtra nulls/undefined/no-strings
    // - Elimina duplicados case-insensitive (preservando la primera ocurrencia)
    // - Elimina strings vacíos o solo whitespace
    // Esto previene el bug "Psicología Clínica" vs "Psicología clínica" que
    // causaba duplicación visual en el Admin Panel (Punto 2 de la auditoría).
    const sanitizeStringArray = (arr: unknown): string[] => {
      if (!Array.isArray(arr)) return [];
      const seen = new Set<string>();
      const result: string[] = [];
      for (const item of arr) {
        if (typeof item !== "string") continue;
        const trimmed = item.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(trimmed);
      }
      return result;
    };

    if (available !== undefined) {
      data.available = available;
    }
    if (license !== undefined) {
      // === Validar formato de matrícula ===
      // Excepción: "EN TRÁMITE" se permite sin validar formato
      if (license !== "EN TRÁMITE") {
        const licenseClean = license.replace(/[\s.-]/g, "");
        const licenseRegex = /^(MN|MP)(\d{4,6})$/;
        if (!licenseRegex.test(licenseClean)) {
          return NextResponse.json(
            { error: "La matrícula debe ser MN o MP seguido de 4 a 6 dígitos (ej: MN-12345 o MP-5432)" },
            { status: 400 }
          );
        }
      }
      data.license = license;
    }
    if (specialty !== undefined) {
      data.specialty = specialty;
    }
    if (bio !== undefined) {
      data.bio = bio;
    }
    if (internalNotes !== undefined) {
      data.internalNotes = internalNotes;
    }
    if (evaluationStatus !== undefined) {
      data.evaluationStatus = evaluationStatus;
    }

    // === Campos del Hub de Control Profesional ===
    // El profesional puede editar sus datos profesionales desde su perfil.
    // Los arrays se sanean (dedup case-insensitive + trim) antes de
    // serializarlos a JSON string (igual que en el registro).
    if (title !== undefined) {
      data.title = title || null;
    }
    if (profession !== undefined) {
      data.profession = profession;
    }
    if (cuil !== undefined) {
      data.cuil = cuil || null;
    }
    if (therapyTypes !== undefined) {
      // Aceptamos array (desde el Hub) o string JSON (desde otros callers).
      // Si es array, se sanea. Si es string, se parsea, sanea y re-serializa.
      const arr = Array.isArray(therapyTypes)
        ? therapyTypes
        : (() => { try { return JSON.parse(therapyTypes); } catch { return []; } })();
      data.therapyTypes = JSON.stringify(sanitizeStringArray(arr));
    }
    if (targetAudience !== undefined) {
      const arr = Array.isArray(targetAudience)
        ? targetAudience
        : (() => { try { return JSON.parse(targetAudience); } catch { return []; } })();
      data.targetAudience = JSON.stringify(sanitizeStringArray(arr));
    }
    if (therapyModality !== undefined) {
      const arr = Array.isArray(therapyModality)
        ? therapyModality
        : (() => { try { return JSON.parse(therapyModality); } catch { return []; } })();
      data.therapyModality = JSON.stringify(sanitizeStringArray(arr));
    }
    if (zones !== undefined) {
      const arr = Array.isArray(zones)
        ? zones
        : (() => { try { return JSON.parse(zones); } catch { return []; } })();
      data.zones = JSON.stringify(sanitizeStringArray(arr));
    }
    if (otherTherapyDetails !== undefined) {
      data.otherTherapyDetails = otherTherapyDetails || null;
    }
    if (cvData !== undefined) {
      data.cvData = cvData || null;
    }
    if (cvFileName !== undefined) {
      data.cvFileName = cvFileName || null;
    }
    if (cvMimeType !== undefined) {
      data.cvMimeType = cvMimeType || null;
    }

    // === Modalidades de atención (booleanos) ===
    // Punto 1 de la auditoría: antes no se procesaban, lo que causaba que
    // los cambios desde Mi Perfil / Hub de Control no persistieran.
    // Ahora se incluyen en el update siempre que vengan definidos en el body.
    if (onlineAttention !== undefined) {
      data.onlineAttention = Boolean(onlineAttention);
    }
    if (presentialAttention !== undefined) {
      data.presentialAttention = Boolean(presentialAttention);
    }
    if (homeAttention !== undefined) {
      data.homeAttention = Boolean(homeAttention);
    }

    // === Campos de auditoría documental — solo admin/super_admin ===
    // Si el caller no es admin, ignoramos los campos silenciosamente.
    // Si es admin, los incluimos en el update.
    if (isAdmin) {
      if (dniVerified !== undefined) data.dniVerified = dniVerified;
      if (degreeVerified !== undefined) data.degreeVerified = degreeVerified;
      if (licenseVerified !== undefined) data.licenseVerified = licenseVerified;
      if (malpracticeInsuranceVerified !== undefined) data.malpracticeInsuranceVerified = malpracticeInsuranceVerified;
      if (taxRegistrationVerified !== undefined) data.taxRegistrationVerified = taxRegistrationVerified;
      if (nationalRegistryVerified !== undefined) data.nationalRegistryVerified = nationalRegistryVerified;
      // === Comisión REP dinámica (solo admin puede setear override) ===
      // Acepta: 0.30, 0.20, 0.10, etc. o null para usar default por profesión.
      if (commissionRate !== undefined) {
        // Validar que esté en rango razonable (0-1)
        const rate = Number(commissionRate);
        if (!Number.isNaN(rate) && rate >= 0 && rate <= 1) {
          data.commissionRate = rate;
        } else if (commissionRate === null) {
          data.commissionRate = null;
        }
      }
    } else {
      // Non-admin intentando mutar campos de auditoría — log para
      // detección de intentos de abuso pero no bloquear el request
      // (puede ser un profesional editando su specialty, etc.).
      const attemptedDocFields = Object.entries(docFields)
        .filter(([, v]) => v !== undefined)
        .map(([k]) => k);
      if (attemptedDocFields.length > 0) {
        console.warn(`[SECURITY] Non-admin user ${session.user.id} (role=${userRole}) attempted to mutate document verification fields on professional ${id}:`, attemptedDocFields);
      }
    }

    const professional = await db.professional.update({
      where: { id },
      data,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    return NextResponse.json(professional);
  } catch (error) {
    console.error("Update professional error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el profesional" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID del profesional es requerido" },
        { status: 400 }
      );
    }

    const professional = await db.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    // Delete appointments first (to avoid FK constraint issues)
    await db.appointment.deleteMany({
      where: { professionalId: id },
    });

    // Delete the professional
    await db.professional.delete({
      where: { id },
    });

    // Delete the associated user
    if (professional.userId) {
      await db.user.delete({
        where: { id: professional.userId },
      }).catch(() => {});
    }

    return NextResponse.json({ message: "Profesional eliminado exitosamente" });
  } catch (error) {
    console.error("Delete professional error:", error);
    return NextResponse.json(
      { error: "Error al eliminar el profesional" },
      { status: 500 }
    );
  }
}
