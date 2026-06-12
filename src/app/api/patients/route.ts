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

    // Admins see all patients; professionals only see patients with appointments with them
    if (role === "admin" || role === "super_admin") {
      // All patients
    } else {
      // Professional: only patients who have (or had) appointments with this professional
      const professional = await db.professional.findUnique({
        where: { userId: session.user.id },
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

    // Apply search filter
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const patients = await db.patient.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, phone: true, active: true, createdAt: true },
        },
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
