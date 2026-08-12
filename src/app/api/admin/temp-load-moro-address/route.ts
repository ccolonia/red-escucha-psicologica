import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ============================================================================
// POST /api/admin/temp-load-moro-address
// 
// ENDPOINT TEMPORAL para cargar la dirección "Rojas 596 4°B" al perfil del
// Lic. Federico Moro. Se elimina después de usar.
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // Auth check — solo admin
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const userRole = (session.user as { role: string }).role;
    if (userRole !== "admin" && userRole !== "super_admin") {
      return NextResponse.json(
        { error: "Solo admin puede usar este endpoint" },
        { status: 403 }
      );
    }

    // 1. Buscar al Lic. Federico Moro por nombre
    const professional = await db.professional.findFirst({
      where: {
        user: {
          name: {
            contains: "Federico Moro",
            mode: "insensitive",
          },
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "No se encontró al profesional 'Federico Moro'" },
        { status: 404 }
      );
    }

    // 2. Verificar si ya tiene la dirección cargada (para no duplicar)
    const existing = await db.professionalAddress.findFirst({
      where: {
        professionalId: professional.id,
        address: { contains: "Rojas 596", mode: "insensitive" },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "La dirección ya estaba cargada",
        professional: professional.user,
        address: existing,
      });
    }

    // 3. Crear la dirección
    const newAddress = await db.professionalAddress.create({
      data: {
        professionalId: professional.id,
        label: "Consultorio Principal",
        address: "Rojas 596 4°B",
        isActive: true,
      },
    });

    // Si isActive=true, desactivar las demás direcciones del profesional
    await db.professionalAddress.updateMany({
      where: {
        professionalId: professional.id,
        id: { not: newAddress.id },
        isActive: true,
      },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Dirección cargada con éxito",
      professional: professional.user,
      address: newAddress,
    });
  } catch (error) {
    console.error("[temp-load-moro-address] Error:", error);
    return NextResponse.json(
      { error: "Error al cargar la dirección", detail: String(error) },
      { status: 500 }
    );
  }
}
