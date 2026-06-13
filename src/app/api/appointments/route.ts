import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { patientId, professionalId, date, time, modality, reason, status } = body;

    if (!patientId || !professionalId || !date || !time) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    // Determine appointment status based on role
    const role = (session.user as { role: string }).role;
    let appointmentStatus = "pending"; // Default for patients
    if ((role === "professional" || role === "admin" || role === "super_admin") && status === "confirmed") {
      appointmentStatus = "confirmed";
    }

    // Check for conflicting appointment
    const conflict = await db.appointment.findFirst({
      where: {
        professionalId,
        date,
        time,
        status: { in: ["pending", "confirmed"] },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: "El turno ya no está disponible" },
        { status: 409 }
      );
    }

    const appointment = await db.appointment.create({
      data: {
        patientId,
        professionalId,
        date,
        time,
        modality: modality || "P",
        reason: reason || null,
        status: appointmentStatus,
      },
      include: {
        patient: { include: { user: { select: { name: true } } } },
        professional: { include: { user: { select: { name: true } } } },
      },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error("Create appointment error:", error);
    return NextResponse.json(
      { error: "Error al crear el turno" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const role = (session.user as { role: string }).role;
    const userId = (session.user as { id: string }).id;

    let where: Record<string, unknown> = {};

    if (role === "patient") {
      const patient = await db.patient.findUnique({
        where: { userId },
      });
      if (patient) {
        where.patientId = patient.id;
      }
    } else if (role === "professional") {
      const professional = await db.professional.findUnique({
        where: { userId },
      });
      if (professional) {
        where.professionalId = professional.id;
        // Professionals see active appointments (exclude only final "cancelled")
        // Include "cancelled_by_professional" so they see their own cancellations
        if (!status) {
          where.status = { notIn: ["cancelled"] };
        }
      }
    }
    // Admin sees all

    if (status) {
      where.status = status;
    }

    const appointments = await db.appointment.findMany({
      where,
      include: {
        patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
        professional: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ date: "desc" }, { time: "asc" }],
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Get appointments error:", error);
    return NextResponse.json(
      { error: "Error al obtener turnos" },
      { status: 500 }
    );
  }
}
