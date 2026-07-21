import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin" && role !== "professional") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase();

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = {};

    // === Profesional autenticado (si aplica) ===
    // Se obtiene acá arriba porque lo reutilizamos más abajo para filtrar
    // citas (appointments) y notas privadas (professionalNotes) en el include.
    let professional: { id: string } | null = null;
    if (role === "professional") {
      professional = await db.professional.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!professional) {
        return NextResponse.json([]);
      }

      // Get distinct patient IDs from this professional's appointments
      const appointmentPatientIds = await db.appointment.findMany({
        where: { professionalId: professional.id },
        select: { patientId: true },
        distinct: ["patientId"],
      });

      const patientIds = appointmentPatientIds.map((a) => a.patientId);

      if (patientIds.length === 0) {
        return NextResponse.json([]);
      }

      where.id = { in: patientIds };
    }
    // Admins see all patients — no where filter needed

    // Apply search filter
    // Búsqueda flexible por nombre, email o teléfono — permite al admin
    // encontrar pacientes desde cualquier dato que tenga a mano.
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const patients = await db.patient.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, phone: true, active: true, createdAt: true },
        },
        // === Historial de sesiones ===
        // Para profesionales: filtrar solo SUS citas con cada paciente.
        // Para admins: traer todas las citas (visión global del paciente).
        appointments:
          role === "admin" || role === "super_admin"
            ? {
                select: {
                  id: true,
                  date: true,
                  time: true,
                  status: true,
                  modality: true,
                  reason: true,
                },
                orderBy: { date: "desc" },
              }
            : {
                where: { professionalId: professional?.id ?? "" },
                select: {
                  id: true,
                  date: true,
                  time: true,
                  status: true,
                  modality: true,
                  reason: true,
                },
                orderBy: { date: "desc" },
              },
        // === Notas privadas del profesional ===
        // Solo se incluyen para profesionales (un admin no debe ver las notas
        // clínicas privadas de cada profesional sobre cada paciente).
        professionalNotes:
          role === "professional" && professional
            ? {
                where: { professionalId: professional.id },
                select: { content: true, updatedAt: true },
              }
            : false,
      },
      orderBy: { user: { name: "asc" } },
    });

    return NextResponse.json(patients);
  } catch (error) {
    console.error("Get patients error:", error);
    return NextResponse.json(
      { error: "Error al obtener pacientes" },
      { status: 500 }
    );
  }
}
