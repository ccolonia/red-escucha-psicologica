import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateAppointmentsFromSeries } from "@/lib/services/recurring";

// ============================================================================
// POST /api/appointments/recurring
// Crea una serie recurrente + genera los appointments a 30 días vista.
//
// Payload:
//   {
//     patientId: string,
//     professionalId: string,
//     dayOfWeek: number,        // 1=Lunes ... 7=Domingo
//     timeSlot: string,         // "16:00"
//     modality: string,         // "P" presencial, "OL" online
//     slotDuration?: number,    // default 45
//     frequency?: string,       // "WEEKLY" | "BIWEEKLY" | "MONTHLY" (default WEEKLY)
//     startDate: string,        // ISO "YYYY-MM-DD"
//     endDate?: string,         // ISO "YYYY-MM-DD" (opcional, null = 30 días vista)
//   }
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin" && role !== "professional") {
      return NextResponse.json(
        { error: "Solo administradores o profesionales pueden crear series recurrentes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      patientId,
      professionalId,
      dayOfWeek,
      timeSlot,
      modality,
      slotDuration,
      frequency,
      startDate,
      endDate,
    } = body;

    // === Validaciones ===
    if (!patientId || !professionalId || !dayOfWeek || !timeSlot || !startDate) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios: patientId, professionalId, dayOfWeek, timeSlot, startDate" },
        { status: 400 }
      );
    }

    if (dayOfWeek < 1 || dayOfWeek > 7) {
      return NextResponse.json(
        { error: "dayOfWeek debe estar entre 1 (Lunes) y 7 (Domingo)" },
        { status: 400 }
      );
    }

    if (!/^\d{2}:\d{2}$/.test(timeSlot)) {
      return NextResponse.json(
        { error: "timeSlot debe tener formato HH:MM (ej: 16:00)" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return NextResponse.json(
        { error: "startDate debe tener formato YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // === Si es profesional, verificar que sea el dueño de la serie ===
    if (role === "professional") {
      const userId = (session.user as { id: string }).id;
      const prof = await db.professional.findUnique({ where: { userId } });
      if (!prof || prof.id !== professionalId) {
        return NextResponse.json(
          { error: "Solo podés crear series para tu propio perfil" },
          { status: 403 }
        );
      }
    }

    // === Verificar que el paciente y profesional existan ===
    const [patient, professional] = await Promise.all([
      db.patient.findUnique({ where: { id: patientId } }),
      db.professional.findUnique({ where: { id: professionalId } }),
    ]);
    if (!patient) {
      return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    }
    if (!professional) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    // === 1. Crear el registro RecurringSeries ===
    const series = await db.recurringSeries.create({
      data: {
        patientId,
        professionalId,
        dayOfWeek,
        timeSlot,
        frequency: frequency || "WEEKLY",
        modality: modality || "P",
        slotDuration: slotDuration || 45,
        startDate: new Date(startDate + "T12:00:00"),
        endDate: endDate ? new Date(endDate + "T12:00:00") : null,
        active: true,
      },
    });

    // === 2. Generar appointments a 30 días vista ===
    const generateResult = await generateAppointmentsFromSeries({
      seriesId: series.id,
      patientId,
      professionalId,
      timeSlot,
      modality: modality || "P",
      slotDuration: slotDuration || 45,
      dayOfWeek,
      frequency: frequency || "WEEKLY",
      startDate: new Date(startDate + "T12:00:00"),
      endDate: endDate ? new Date(endDate + "T12:00:00") : null,
      projectionDays: 30,
    });

    return NextResponse.json({
      success: true,
      series,
      projection: generateResult,
      message: `Serie creada. Se generaron ${generateResult.scheduled} turnos programados, ${generateResult.skippedHoliday} saltados por feriado, ${generateResult.cancelledByAbsence} cancelados por ausencia.`,
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/appointments/recurring] Error:", error);
    return NextResponse.json(
      { error: "Error al crear la serie recurrente" },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/appointments/recurring
// Lista las series activas, filtrando por professionalId o patientId.
//
// Query params:
//   ?professionalId=X  → filtra por profesional
//   ?patientId=X       → filtra por paciente
//   ?active=true        → solo series activas (default: true)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get("professionalId");
    const patientId = searchParams.get("patientId");
    const activeOnly = searchParams.get("active") !== "false";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (activeOnly) where.active = true;
    if (professionalId) where.professionalId = professionalId;
    if (patientId) where.patientId = patientId;

    const series = await db.recurringSeries.findMany({
      where,
      include: {
        patient: { include: { user: { select: { name: true, email: true } } } },
        professional: { include: { user: { select: { name: true } } } },
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(series);
  } catch (error) {
    console.error("[GET /api/appointments/recurring] Error:", error);
    return NextResponse.json(
      { error: "Error al listar las series recurrentes" },
      { status: 500 }
    );
  }
}
