import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendRescheduleNotificationEmail } from "@/lib/email";

// ============================================================================
// PATCH /api/appointments/reschedule
// Reprogramación PUNTUAL de un turno individual.
//
// Mantiene intacta la serie general para los días siguientes.
// Solo actualiza la cita indicada.
//
// Payload:
//   {
//     appointmentId: string,
//     newDate: string,         // ISO "YYYY-MM-DD"
//     newTimeSlot: string,     // "16:00"
//     isOverride?: boolean,    // true si es un sobreturno fuera de grilla normal
//   }
//
// Lógica:
//   1. Guarda la fecha anterior en originalDate (trazabilidad)
//   2. Cambia la fecha/hora al nuevo slot
//   3. Marca isOverride=true si se especifica
//   4. Dispara email de reagendamiento al paciente (try/catch aislado)
//   5. NO afecta la serie general ni otros turnos
// ============================================================================

const ARG_TZ = "America/Argentina/Buenos_Aires";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin" && role !== "professional") {
      return NextResponse.json(
        { error: "Solo administradores o profesionales pueden reprogramar turnos" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { appointmentId, newDate, newTimeSlot, isOverride } = body;

    // === Validaciones ===
    if (!appointmentId || !newDate || !newTimeSlot) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios: appointmentId, newDate, newTimeSlot" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return NextResponse.json(
        { error: "newDate debe tener formato YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (!/^\d{2}:\d{2}$/.test(newTimeSlot)) {
      return NextResponse.json(
        { error: "newTimeSlot debe tener formato HH:MM (ej: 16:00)" },
        { status: 400 }
      );
    }

    // === Buscar el appointment actual ===
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
        professional: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 }
      );
    }

    // === Si es profesional, verificar que sea el dueño del turno ===
    if (role === "professional") {
      const userId = (session.user as { id: string }).id;
      const prof = await db.professional.findUnique({ where: { userId } });
      if (!prof || prof.id !== appointment.professionalId) {
        return NextResponse.json(
          { error: "Solo podés reprogramar tus propios turnos" },
          { status: 403 }
        );
      }
    }

    // === Validar que no haya conflicto (otro turno en la misma fecha/hora) ===
    const conflict = await db.appointment.findFirst({
      where: {
        id: { not: appointmentId },
        professionalId: appointment.professionalId,
        date: newDate,
        time: newTimeSlot,
        status: { in: ["pending", "confirmed", "scheduled"] },
      },
    });
    if (conflict) {
      return NextResponse.json(
        {
          error: `Ya existe un turno en esa fecha y hora con ${conflict.patientId}. Elegí otro horario.`,
        },
        { status: 409 }
      );
    }

    // === Guardar fecha original ANTES de actualizar (trazabilidad) ===
    const originalDate = appointment.date;

    // === Actualizar el appointment ===
    const updated = await db.appointment.update({
      where: { id: appointmentId },
      data: {
        date: newDate,
        time: newTimeSlot,
        // Guardar la fecha original para trazabilidad
        // (si ya tenía originalDate, lo respetamos — significa que ya fue
        // reprogramado antes y queremos preservar la fecha PRIMIGENIA)
        originalDate: appointment.originalDate || originalDate,
        // Marcar como override si se especifica (sobreturno fuera de grilla)
        isOverride: isOverride === true ? true : appointment.isOverride,
        // Resetear estado de emails para reenvío
        patientEmailStatus: "PENDING",
        patientEmailSentAt: null,
      },
      include: {
        patient: { include: { user: { select: { name: true, email: true } } } },
        professional: { include: { user: { select: { name: true } } } },
      },
    });

    console.log(
      `[Reschedule] Turno ${appointmentId} reprogramado: ${originalDate} ${appointment.time} → ${newDate} ${newTimeSlot}` +
      (appointment.seriesId ? ` (pertenece a serie ${appointment.seriesId})` : "") +
      ` — La serie general NO se afecta.`
    );

    // === Email al paciente (try/catch aislado) ===
    // Si el email falla, la reprogramación en DB NO se cancela.
    const emailSent = { patient: false, professional: false };
    if (updated.patient.user.email) {
      try {
        // Calcular timeEnd según schedule del profesional para el nuevo día
        let newTimeEnd: string | null = null;
        const [h, m] = newTimeSlot.split(":").map(Number);
        const newDayOfWeek = new Date(newDate + "T12:00:00").getDay() || 7;
        const profSchedules = await db.professionalSchedule.findMany({
          where: {
            professionalId: appointment.professionalId,
            dayOfWeek: newDayOfWeek,
          },
          select: { slotDuration: true },
          take: 1,
        });
        const slotDuration = profSchedules[0]?.slotDuration || 45;
        const totalMin = h * 60 + m + slotDuration;
        newTimeEnd = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;

        const result = await sendRescheduleNotificationEmail({
          patientEmail: updated.patient.user.email,
          patientName: updated.patient.user.name,
          professionalName: updated.professional.user.name,
          newDate,
          newTime: newTimeSlot,
          newTimeEnd,
          modality: appointment.modality || "P",
          officeAddress: null,
        });
        emailSent.patient = !result.error;
        if (!result.error) {
          // Marcar email como enviado
          await db.appointment.update({
            where: { id: appointmentId },
            data: { patientEmailStatus: "SENT", patientEmailSentAt: new Date() },
          });
        }
      } catch (emailErr) {
        console.error("[Reschedule] Error enviando email al paciente:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      appointment: updated,
      originalDate,
      emailSent,
      message: `Turno reprogramado de ${originalDate} ${appointment.time} → ${newDate} ${newTimeSlot}. La serie general NO se afecta.`,
    });
  } catch (error) {
    console.error("[PATCH /api/appointments/reschedule] Error:", error);
    return NextResponse.json(
      { error: "Error al reprogramar el turno" },
      { status: 500 }
    );
  }
}
