import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/patient-requests — Create a new patient request (public or authenticated)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { name, email, phone, modality, reason, notes, patientAge, guardianName } = body;

    // If authenticated patient, auto-fill from session
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const role = (session.user as { role: string }).role;
      if (role === "patient") {
        // Auto-fill from session if not provided
        if (!name) name = session.user.name || "";
        if (!email) email = session.user.email || "";
        // Get phone from user record if available
        if (!phone) {
          const user = await db.user.findUnique({
            where: { id: (session.user as { id: string }).id },
            select: { phone: true },
          });
          if (user?.phone) phone = user.phone;
        }
      }
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: "Nombre y email son obligatorios" },
        { status: 400 }
      );
    }

    // === Validación: Edad y Protocolo de Minoridad ===
    // El form público manda patientAge SIEMPRE que el usuario eligió
    // "Solicitar Turno" en el combo principal (el frontend ya filtra).
    // El backend valida por las dudas:
    //   - Si patientAge viene, debe ser entero entre 1 y 120
    //   - Si patientAge < 18, guardianName es obligatorio (no vacío)
    //
    // Si el request viene sin patientAge (otro caller, ej: admin creando
    // manualmente), no validamos — solo persistimos null.
    let patientAgeInt: number | null = null;
    if (patientAge !== undefined && patientAge !== null && patientAge !== "") {
      const parsed = typeof patientAge === "number" ? patientAge : parseInt(String(patientAge), 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
        return NextResponse.json(
          { error: "La edad del paciente debe ser un número entero entre 1 y 120", code: "INVALID_AGE" },
          { status: 400 }
        );
      }
      patientAgeInt = parsed;

      // Protocolo de minoridad: si < 18, exigir tutor
      if (parsed < 18) {
        if (!guardianName || String(guardianName).trim().length < 3) {
          return NextResponse.json(
            {
              error: "Para pacientes menores de 18 años es obligatorio indicar el nombre completo del adulto responsable o tutor",
              code: "GUARDIAN_REQUIRED",
            },
            { status: 400 }
          );
        }
      }
    }
    const guardianNameTrimmed = guardianName ? String(guardianName).trim() : null;

    // === Validación: bloquear si el email ya tiene Patient con appointment activo ===
    // Regla A: un paciente con tratamiento activo o por iniciar no puede volver a
    // solicitar turno. Estados considerados "activos":
    //   - pending:        turnero pendiente de confirmación del profesional
    //   - confirmed:      turno confirmado, sin atender
    //   - rescheduled:    turno reprogramado (sigue activo, esperando nueva fecha)
    // Estados NO activos (permiten nueva solicitud):
    //   - completed:      tratamiento finalizado OK
    //   - cancelled:      turno cancelado (por admin o profesional)
    //   - cancelled_by_professional: cancelado por el profesional
    //   - absent:         paciente no asistió (sin reprogramar)
    //
    // Edge cases cubiertos:
    //   - Paciente que ya terminó tratamiento y vuelve meses después → permitido
    //   - Paciente con 1 turno activo y 1 cancelado → bloqueado (tiene activo)
    //   - Email de usuario ADMIN o PROFESIONAL que pidió como paciente → bloqueado
    //     si tienen appointment activo (no debería pasar, pero por safety)
    const existingPatient = await db.patient.findFirst({
      where: { user: { email } },
      include: {
        appointments: {
          where: {
            status: { in: ["pending", "confirmed", "rescheduled"] },
          },
          select: { id: true, status: true, date: true, time: true },
        },
      },
    });

    if (existingPatient && existingPatient.appointments.length > 0) {
      const nextAppt = existingPatient.appointments
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
      return NextResponse.json(
        {
          error:
            "Ya tenés un turno activo con ese email. " +
            "Si querés reprogramar o tuviste un problema, escribinos a contacto@redescuchapsicologica.com " +
            "o al WhatsApp del profesional que te fue asignado.",
          code: "EMAIL_HAS_ACTIVE_APPOINTMENT",
          // No exponemos datos del profesional ni fecha exacta por privacidad,
          // solo confirmamos que existe un turno activo.
          nextAppointmentDate: nextAppt.date,
        },
        { status: 409 }
      );
    }

    const patientRequest = await db.patientRequest.create({
      data: {
        name,
        email,
        phone: phone || null,
        modality: modality || "presencial",
        // Fallback 'otros' (antes era 'consulta_general', pero ese motivo
        // fue depreciado en la reestructuración de motivos de consulta).
        // Si el caller no manda reason, default a 'otros' que es una
        // opción válida del Select del form público.
        reason: reason || "otros",
        notes: notes || null,
        patientAge: patientAgeInt,
        guardianName: guardianNameTrimmed,
        status: "pending",
      },
    });

    return NextResponse.json(patientRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating patient request:", error);
    return NextResponse.json(
      { error: "Error al crear la solicitud" },
      { status: 500 }
    );
  }
}

// GET /api/patient-requests — List all patient requests (admin only, auth handled by proxy)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = status ? { status } : {};

    const requests = await db.patientRequest.findMany({
      where,
      include: {
        assignedTo: {
          include: {
            user: {
              select: { name: true, email: true, phone: true },
            },
          },
        },
        appointment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching patient requests:", error);
    return NextResponse.json(
      { error: "Error al obtener solicitudes" },
      { status: 500 }
    );
  }
}
