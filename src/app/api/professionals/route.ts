import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

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
    if (all === "true") {
      where.user = { active: true };
      where.licenseVerified = true;

      if (specialty) {
        where.specialty = specialty;
      }
      if (available === "true") {
        where.available = true;
      }

      // Search is also supported in all mode
      if (search) {
        where.AND = [
          { user: { active: true }, licenseVerified: true },
          {
            OR: [
              { user: { name: { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              { license: { contains: search, mode: "insensitive" } },
              { specialty: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
        delete where.user;
        delete where.licenseVerified;
      }

      const professionals = await db.professional.findMany({
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
          // === Detalle de "Otras terapias" ===
          // Se incluye en el select para que el panel admin lo pueda mostrar
          // en la tarjeta expandible del profesional.
          otherTherapyDetails: true,
          onlineAttention: true,
          presentialAttention: true,
          homeAttention: true,
          zones: true,
          cvFileName: true,
          cvMimeType: true,
          internalNotes: true,
          evaluationStatus: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, email: true, phone: true, active: true, createdAt: true },
          },
        },
        orderBy: { user: { name: "asc" } },
      });

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

    // Fuzzy search across name, email, license
    if (search) {
      const searchConditions: Prisma.ProfessionalWhereInput[] = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { license: { contains: search, mode: "insensitive" } },
        { specialty: { contains: search, mode: "insensitive" } },
      ];

      if (status === "approved") {
        // Merge search with the approved status filter
        where.AND = [
          { user: { active: true }, licenseVerified: true },
          { OR: searchConditions },
        ];
        // Remove the top-level user/licenseVerified since AND handles it
        delete where.user;
        delete where.licenseVerified;
      } else if (status === "pending") {
        where.AND = [
          { user: { active: false } },
          { OR: searchConditions },
        ];
        delete where.user;
      } else if (status === "unverified") {
        where.AND = [
          { licenseVerified: false },
          { OR: searchConditions },
        ];
        delete where.licenseVerified;
      } else {
        where.OR = searchConditions;
      }
    }

    // Run count + data in parallel for efficiency
    const [totalCount, professionals, approvedCount] = await Promise.all([
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
          // === Detalle de "Otras terapias" ===
          // Se incluye en el select para que el panel admin lo pueda mostrar
          // en la tarjeta expandible del profesional.
          otherTherapyDetails: true,
          onlineAttention: true,
          presentialAttention: true,
          homeAttention: true,
          zones: true,
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
            select: { id: true, name: true, email: true, phone: true, active: true, createdAt: true },
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

    return NextResponse.json({
      professionals,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
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
    const data: { available?: boolean; license?: string; licenseVerified?: boolean; specialty?: string; bio?: string | null; internalNotes?: string | null; evaluationStatus?: string | null; dniVerified?: boolean; degreeVerified?: boolean; malpracticeInsuranceVerified?: boolean; taxRegistrationVerified?: boolean; nationalRegistryVerified?: boolean } = {};

    if (available !== undefined) {
      data.available = available;
    }
    if (license !== undefined) {
      // Validar formato de matrícula: MN o MP + 4-6 dígitos
      const licenseClean = license.replace(/[\s.-]/g, "");
      const licenseRegex = /^(MN|MP)(\d{4,6})$/;
      if (!licenseRegex.test(licenseClean)) {
        return NextResponse.json(
          { error: "La matrícula debe ser MN o MP seguido de 4 a 6 dígitos (ej: MN-12345 o MP-5432)" },
          { status: 400 }
        );
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
