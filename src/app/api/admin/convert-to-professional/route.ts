import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/admin/convert-to-professional
// Body: {
//   email: string,           // email del usuario a migrar
//   profession: string,      // "Psicólogo" | "Psiquiatra" | etc.
//   license?: string,        // matrícula (default: "EN TRÁMITE-{timestamp}")
//   specialty?: string,      // especialidad (default: según profesión)
//   commissionRate?: number, // override (default: null = auto por profesión)
// }
//
// Migra un usuario existente (paciente o cualquier rol) a profesional:
//  1. Si tiene registro en Patient → lo elimina
//  2. Cambia role en User a "professional"
//  3. Crea registro en Professional con profession + commissionRate
//  4. Marca isApproved=true y active=true para que pueda loguear de inmediato
//
// Solo admin/super_admin puede ejecutar esta acción.

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { email, profession, license, specialty, commissionRate } = body;

    if (!email || !profession) {
      return NextResponse.json(
        { error: "email y profession son obligatorios" },
        { status: 400 }
      );
    }

    // 1. Buscar el usuario por email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { professional: true, patient: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // 2. Si ya es profesional, no hacer nada (idempotente)
    if (user.role === "professional" && user.professional) {
      // Actualizar profession por si acaso
      const updated = await db.professional.update({
        where: { userId: user.id },
        data: {
          profession,
          ...(commissionRate !== undefined ? { commissionRate: Number(commissionRate) } : {}),
        },
      });
      return NextResponse.json({
        message: "El usuario ya era profesional. Se actualizó la profesión.",
        professional: updated,
        alreadyProfessional: true,
      });
    }

    // 3. Generar matrícula única si no se proporcionó
    let finalLicense = license || `EN TRÁMITE-${Date.now()}`;
    // Verificar que no exista ya esa matrícula
    const existingLicense = await db.professional.findUnique({
      where: { license: finalLicense },
    });
    if (existingLicense) {
      finalLicense = `${finalLicense}-${Date.now()}`;
    }

    // 4. Inferir specialty si no se proporcionó
    const inferredSpecialty = specialty || (
      profession.toLowerCase().includes("psiquiatr")
        ? "Psiquiatría Clínica"
        : "Psicología Clínica"
    );

    // 5. Inferir commissionRate si no se proporcionó
    // null = usar default por profesión (psiquiatra → 20%, resto → 30%)
    const finalCommissionRate = commissionRate !== undefined ? Number(commissionRate) : null;

    // 6. Eliminar registro de Patient si existe (cascade elimina appointments del paciente)
    if (user.patient) {
      await db.patient.delete({
        where: { userId: user.id },
      });
    }

    // 7. Cambiar role del User a professional + activar
    await db.user.update({
      where: { id: user.id },
      data: {
        role: "professional",
        active: true,
        isApproved: true,
        passwordSet: true,
        hasAccessedPanel: false,
      },
    });

    // 8. Crear registro en Professional
    const professional = await db.professional.create({
      data: {
        userId: user.id,
        license: finalLicense,
        specialty: inferredSpecialty,
        profession,
        commissionRate: finalCommissionRate,
        // Defaults razonables para un profesional migrado
        available: true,
        onlineAttention: true,
        presentialAttention: true,
      },
    });

    return NextResponse.json({
      message: `Usuario migrado a profesional (${profession}) exitosamente`,
      user: { id: user.id, name: user.name, email: user.email, role: "professional" },
      professional: {
        id: professional.id,
        license: professional.license,
        specialty: professional.specialty,
        profession: professional.profession,
        commissionRate: professional.commissionRate,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Convert to professional error:", error);
    return NextResponse.json(
      { error: "Error al migrar usuario a profesional: " + (error as Error).message },
      { status: 500 }
    );
  }
}
