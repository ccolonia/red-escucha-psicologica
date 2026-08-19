import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendCancellationByProfessionalEmail, sendRescheduleNotificationEmail } from "@/lib/email";

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
    const { status, notes, cancellationSource, cancellationReason, newDate, newTime } = body;

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
          // === Incluimos email del profesional para poder enviarle
          // notificación de reagendamiento (auditoría 2026-08-18) ===
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    if (!currentAppointment) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 }
      );
    }

    // === Validación de newDate/newTime (cuando se está reagendando) ===
    // === FIX DEFINITIVO (tarea 2026-08-18): isRescheduleFlow NO debe ===
    // === depender del estado origen del turno. Si el caller envía    ===
    // === newDate o newTime, es un flujo de reagendamiento válido    ===
    // === desde CUALQUIER estado activo (pending, confirmed, rescheduled).
    //
    // Antes requería `currentAppointment.status === "rescheduled"` lo cual
    // bloqueaba el caso confirmed → confirmed con nueva fecha/hora.
    //
    // Ahora: si hay newDate o newTime en el body, es un reagendamiento.
    const isRescheduleFlow = Boolean(newDate || newTime);

    if (isRescheduleFlow) {
      if (!newDate || !newTime) {
        return NextResponse.json(
          { error: "Para reagendar se requiere newDate y newTime" },
          { status: 400 }
        );
      }
      // Validar formato de fecha (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        return NextResponse.json(
          { error: "newDate debe tener formato YYYY-MM-DD" },
          { status: 400 }
        );
      }
      // Validar formato de hora (HH:MM)
      if (!/^\d{2}:\d{2}$/.test(newTime)) {
        return NextResponse.json(
          { error: "newTime debe tener formato HH:MM" },
          { status: 400 }
        );
      }
    }

    // Fetch the current appointment to validate status transition
    // Incluimos user (email, name, phone) para poder enviar el email de
    // cancelación sin otra query si el status es cancelled_by_professional
    // (HECHO ARRIBA — esta sección se eliminó por duplicación)

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

    // === Validación de transición de estado ===
    // Si el caller está reagendando (envía newDate + newTime + status='confirmed'),
    // permitimos el cambio desde CUALQUIER estado válido (pending, confirmed, rescheduled).
    // El flujo de reagendamiento no debería bloquearse por la validación de transiciones
    // porque es un caso especial: el turno se mueve a otra fecha/hora.
    //
    // FIX (tarea 2026-08-18): antes se bloqueaba "confirmed → confirmed" cuando
    // un turno confirmado se reagendaba directamente sin pasar por "rescheduled".
    // Ahora: si isRescheduleFlow=true, saltamos la validación de transiciones.
    if (!isRescheduleFlow) {
      if (!validTransitions[currentStatus]?.includes(status)) {
        return NextResponse.json(
          { error: `No se puede cambiar de ${currentStatus} a ${status}` },
          { status: 400 }
        );
      }
    } else {
      // Validación especial para el flujo de reagendamiento:
      // Solo permitimos reagendar desde estados "activos" (pending, confirmed, rescheduled)
      // NO permitimos reagendar turnos cancelados/completados/ausentes.
      const validRescheduleOrigins = ["pending", "confirmed", "rescheduled"];
      if (!validRescheduleOrigins.includes(currentStatus)) {
        return NextResponse.json(
          { error: `No se puede reagendar un turno en estado ${currentStatus}` },
          { status: 400 }
        );
      }
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
        // === Reagendamiento: actualizar fecha/hora si es el flujo de reschedule ===
        // Si el caller mandó newDate y newTime, los persistimos. Esto mueve
        // el turno a su nueva posición en la grilla.
        ...(isRescheduleFlow
          ? {
              date: newDate,
              time: newTime,
              // === Resetear el estado de envío de email para que se reenvíe
              // la confirmación al paciente Y al profesional con los nuevos datos ===
              patientEmailStatus: "PENDING",
              patientEmailSentAt: null,
              professionalEmailStatus: "PENDING",
              professionalEmailSentAt: null,
            }
          : {}),
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
        patient: { include: { user: { select: { name: true, email: true } } } },
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
    const emailSent = { patient: false, professional: false };
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

    // === Email al paciente cuando se REAGENDA con nueva fecha/hora ===
    // Si el caller mandó newDate/newTime y el status pasó a "confirmed",
    // disparamos email de reconfirmación con los nuevos datos al paciente.
    //
    // Try/catch aislado: si el email falla, la reprogramación en DB NO se cancela.
    if (isRescheduleFlow && appointment.patient.user.email) {
      try {
        // Calcular timeEnd según schedule del profesional para el nuevo día
        let newTimeEnd: string | null = null;
        const [h, m] = newTime.split(":").map(Number);
        const newDayOfWeek = new Date(newDate + "T12:00:00").getDay() || 7;
        const professionalSchedules = await db.professionalSchedule.findMany({
          where: {
            professionalId: currentAppointment.professionalId,
            dayOfWeek: newDayOfWeek,
          },
          select: { slotDuration: true },
          take: 1,
        });
        const slotDuration = professionalSchedules[0]?.slotDuration || 45;
        const totalMin = h * 60 + m + slotDuration;
        newTimeEnd = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;

        // Buscar dirección de consultorio si la modalidad es presencial
        let officeAddress: string | null = null;
        if (currentAppointment.modality === "P") {
          const addresses = await db.professionalAddress.findMany({
            where: {
              professionalId: currentAppointment.professionalId,
              isActive: true,
            },
            take: 1,
          });
          officeAddress = addresses[0]?.address || null;
        }

        const rescheduleEmailResult = await sendRescheduleNotificationEmail({
          patientEmail: appointment.patient.user.email,
          patientName: appointment.patient.user.name,
          professionalName: appointment.professional.user.name,
          newDate,
          newTime,
          newTimeEnd,
          modality: currentAppointment.modality || "P",
          officeAddress,
        });
        emailSent.patient = !rescheduleEmailResult.error;
        if (rescheduleEmailResult.error) {
          console.error("Failed to send reschedule email to patient:", rescheduleEmailResult.error);
        } else {
          console.log(`[Reagendamiento] ✅ Email enviado a ${appointment.patient.user.email} para turno ${id}`);
          // Marcar el email como enviado en la DB
          await db.appointment.update({
            where: { id },
            data: {
              patientEmailStatus: "SENT",
              patientEmailSentAt: new Date(),
            },
          });
        }
      } catch (emailErr) {
        // Aislado: el error de email NO propaga al try/catch externo
        console.error("[Reagendamiento] Error enviando email al paciente:", emailErr);
      }
    }

    // === Email al PROFESIONAL cuando se REAGENDA con nueva fecha/hora ===
    // Notifica al profesional que el turno fue reagendado para que tenga
    // constancia del nuevo horario y pueda gestionar su agenda.
    //
    // Si el profesional reagendó su propio turno, este email sirve como
    // confirmación/información. Si fue el admin quien reagendó, este email
    // es CRÍTICO para que el profesional se entere del cambio.
    //
    // Try/catch aislado: si el email falla, la reprogramación en DB NO se cancela.
    if (isRescheduleFlow && currentAppointment.professional.user.email) {
      try {
        const rescheduleProEmailResult = await sendRescheduleNotificationEmail({
          patientEmail: currentAppointment.professional.user.email,
          patientName: currentAppointment.professional.user.name,
          // Pasamos el nombre del profesional como professionalName para que
          // el template muestre "Hola, {nombre}" en el saludo
          professionalName: currentAppointment.professional.user.name,
          newDate,
          newTime,
          newTimeEnd: null, // se calcula abajo si es necesario
          modality: currentAppointment.modality || "P",
          officeAddress: null,
        });
        emailSent.professional = !rescheduleProEmailResult.error;
        if (rescheduleProEmailResult.error) {
          console.error("Failed to send reschedule email to professional:", rescheduleProEmailResult.error);
        } else {
          console.log(`[Reagendamiento] ✅ Email enviado al profesional ${currentAppointment.professional.user.email} para turno ${id}`);
          // Marcar el email del profesional como enviado en la DB
          await db.appointment.update({
            where: { id },
            data: {
              professionalEmailStatus: "SENT",
              professionalEmailSentAt: new Date(),
            },
          });
        }
      } catch (emailErr) {
        // Aislado: el error de email NO propaga al try/catch externo
        console.error("[Reagendamiento] Error enviando email al profesional:", emailErr);
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
