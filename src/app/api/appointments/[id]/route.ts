import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendCancellationByProfessionalEmail } from "@/lib/email";

// Valid status transitions
// "cancelled_by_professional" is an intermediate state: professional cancelled but
// admin must decide whether to reassign or delete definitively
// "cancelled_by_patient" is a final state: patient requested cancellation, slot is freed
const validTransitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled", "cancelled_by_professional", "cancelled_by_patient", "rescheduled"],
  confirmed: ["completed", "cancelled", "cancelled_by_professional", "cancelled_by_patient", "absent", "rescheduled"],
  cancelled_by_professional: ["cancelled", "confirmed", "cancelled_by_patient"], // admin can reassign, delete, or mark as patient-cancelled
  completed: [],
  cancelled: [],
  cancelled_by_patient: [], // terminal state — slot is freed
  absent: [],
  rescheduled: ["confirmed", "cancelled", "cancelled_by_professional", "cancelled_by_patient"],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = (session.user as { role: string }).role;
    const userId = (session.user as { id: string }).id;

    const { id } = await params;
    const body = await request.json();
    const { status, notes, cancellationSource, cancellationReason } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Estado es requerido" },
        { status: 400 }
      );
    }

    // Fetch the current appointment to validate status transition
    // Incluimos user (email, name, phone) para poder enviar el email de
    // cancelación sin otra query si el status es cancelled_by_professional
    const currentAppointment = await db.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        },
        professional: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!currentAppointment) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 }
      );
    }

    const currentStatus = currentAppointment.status;

    // If the user is a patient, enforce stricter rules
    if (userRole === "patient") {
      // Verify the patient owns this appointment
      if (currentAppointment.patient.userId !== userId) {
        return NextResponse.json(
          { error: "No tenés permiso para modificar este turno" },
          { status: 403 }
        );
      }

      // Patients can ONLY cancel appointments
      if (status !== "cancelled") {
        return NextResponse.json(
          { error: "Los pacientes solo pueden cancelar turnos" },
          { status: 403 }
        );
      }
    }

    // Validate the status transition
    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        { error: `No se puede cambiar de ${currentStatus} a ${status}` },
        { status: 400 }
      );
    }

    // Authorization: professionals can only manage their own appointments
    if (userRole === "professional") {
      const professional = await db.professional.findUnique({
        where: { userId },
      });
      if (!professional || currentAppointment.professionalId !== professional.id) {
        return NextResponse.json(
          { error: "No autorizado" },
          { status: 403 }
        );
      }
    }
    // Admins can do anything

    const appointment = await db.appointment.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
        // === Origen de cancelación (tarea 2026-07-23) ===
        // Solo persistir si el nuevo status es de cancelación
        cancellationSource:
          status === "cancelled" || status === "cancelled_by_professional" || status === "cancelled_by_patient"
            ? (cancellationSource || null)
            : null, // limpiar si es un status no-cancelación
        cancellationReason:
          status === "cancelled" || status === "cancelled_by_professional" || status === "cancelled_by_patient"
            ? (cancellationReason || null)
            : null,
      },
      include: {
        patient: { include: { user: { select: { name: true } } } },
        professional: { include: { user: { select: { name: true } } } },
      },
    });

    // === Email al paciente si el profesional canceló el turno ===
    // El status 'cancelled_by_professional' es un estado intermedio: el
    // profesional cancela, el admin decide después si reasigna o cancela
    // definitivamente. Avisamos al paciente apenas el profesional cancela
    // para que no se quede esperando el día del turno sin saber.
    //
    // Solo disparamos email si:
    //   - El nuevo status es cancelled_by_professional
    //   - El paciente tiene email (User.email siempre debería existir)
    //   - El turno tenía fecha y hora (si no, no hay nada que avisar)
    //
    // El email es fire-and-forget con captura de errores: si falla, no
    // rompemos el flujo de cancelación (el appointment ya está actualizado).
    const emailSent = { patient: false };
    if (status === "cancelled_by_professional" && currentAppointment.patient.user.email) {
      // Calcular timeEnd según schedule del profesional (igual que en GET /api/appointments)
      let timeEnd: string | null = null;
      if (currentAppointment.time) {
        const [h, m] = currentAppointment.time.split(":").map(Number);
        const professionalSchedules = await db.professionalSchedule.findMany({
          where: {
            professionalId: currentAppointment.professionalId,
            dayOfWeek: new Date(currentAppointment.date + "T12:00:00").getDay() || 7,
          },
          select: { slotDuration: true },
          take: 1,
        });
        const slotDuration = professionalSchedules[0]?.slotDuration || 45;
        const totalMin = h * 60 + m + slotDuration;
        timeEnd = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
      }

      try {
        const result = await sendCancellationByProfessionalEmail({
          patientEmail: currentAppointment.patient.user.email,
          patientName: currentAppointment.patient.user.name,
          professionalName: currentAppointment.professional.user.name,
          date: currentAppointment.date,
          time: currentAppointment.time,
          timeEnd,
          reason: cancellationReason || null,
          modality: currentAppointment.modality || "P",
        });
        emailSent.patient = !result.error;
        if (result.error) {
          console.error("Failed to send cancellation email to patient:", result.error);
        }
      } catch (err) {
        console.error("Failed to send cancellation email to patient:", err);
      }
    }

    return NextResponse.json({ ...appointment, emailSent });
  } catch (error) {
    console.error("Update appointment error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el turno" },
      { status: 500 }
    );
  }
}
