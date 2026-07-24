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
        // === LÓGICA DE SLOTS (tarea 2026-07-24) ===
        // El profesional ve TODOS sus turnos (incluidos los cancelados por
        // paciente) para que la pestaña "Lista" del dashboard pueda mostrar
        // el histórico de cancelaciones para auditoría.
        //
        // La Agenda Visual (professional-weekly-agenda.tsx) filtra los
        // cancelled_by_patient localmente para que la grilla muestre el
        // slot como LIBRE y el profesional pueda activarlo para otro
        // paciente.
        //
        // Excluimos solo "cancelled" (legacy sin origen) porque esos no
        // aportan info útil y ya estaban excluidos antes.
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

    // === Enriquecer cada appointment con timeEnd calculado según el
    // slotDuration del schedule del profesional para ese día de la semana.
    // Si no hay schedule para ese día (ej: turno creado manualmente para
    // un día no laboral), caemos a 45 min default.
    //
    // Optimización: obtenemos todos los professionalIds y days únicos en
    // una sola query en vez de N+1 queries.
    const professionalIds = [...new Set(appointments.map((a) => a.professionalId))];
    const scheduleItems = professionalIds.length > 0
      ? await db.professionalSchedule.findMany({
          where: { professionalId: { in: professionalIds } },
          select: {
            professionalId: true,
            dayOfWeek: true,
            slotDuration: true,
          },
        })
      : [];

    // Map<professionalId, Map<dayOfWeek, slotDuration>> — si hay múltiples
    // schedules para el mismo día, tomamos el del primer slot (todos deberían
    // tener el mismo slotDuration, pero por las dudas).
    const scheduleMap = new Map<string, Map<number, number>>();
    for (const s of scheduleItems) {
      if (!scheduleMap.has(s.professionalId)) {
        scheduleMap.set(s.professionalId, new Map());
      }
      const inner = scheduleMap.get(s.professionalId)!;
      // Solo seteamos si no existe (primer schedule gana)
      if (!inner.has(s.dayOfWeek)) {
        inner.set(s.dayOfWeek, s.slotDuration);
      }
    }

    // Helper: calcular timeEnd a partir de time + slotDuration
    const computeTimeEnd = (time: string, slotDuration: number): string => {
      const [h, m] = time.split(":").map(Number);
      const totalMinutes = h * 60 + m + slotDuration;
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    };

    // Helper: obtener dayOfWeek a partir de un date string "YYYY-MM-DD"
    // 0=Dom, 1=Lun, ..., 6=Sab (igual que getDay() de JS)
    const getDayOfWeek = (dateStr: string): number => {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d).getDay();
    };

    const enrichedAppointments = appointments.map((a) => {
      const inner = scheduleMap.get(a.professionalId);
      const dayOfWeek = getDayOfWeek(a.date);
      const slotDuration = inner?.get(dayOfWeek) || 45; // default 45 min
      const timeEnd = computeTimeEnd(a.time, slotDuration);
      return { ...a, timeEnd };
    });

    return NextResponse.json(enrichedAppointments);
  } catch (error) {
    console.error("Get appointments error:", error);
    return NextResponse.json(
      { error: "Error al obtener turnos" },
      { status: 500 }
    );
  }
}
