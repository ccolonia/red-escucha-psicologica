import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendTriageProfessionalNotification,
  sendTriagePatientNotification,
} from "@/lib/email";

// PATCH /api/patient-requests/[id] — Update a patient request (assign, change status, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // If assigning to a professional
    if (body.action === "assign") {
      const { professionalId, date, time, appointmentModality } = body;

      if (!professionalId) {
        return NextResponse.json(
          { error: "professionalId es obligatorio para asignar" },
          { status: 400 }
        );
      }

      // Check professional exists and is available
      const professional = await db.professional.findUnique({
        where: { id: professionalId },
        include: { user: true },
      });

      if (!professional) {
        return NextResponse.json(
          { error: "Profesional no encontrado" },
          { status: 404 }
        );
      }

      // ===== ATOMIC ASSIGNMENT VIA TRANSACTION =====
      const updated = await db.$transaction(async (tx) => {
        // 0. Verify the PatientRequest exists BEFORE any mutation
        //    id is a cuid string — do NOT parseInt (schema: String @id @default(cuid()))
        const existingRequest = await tx.patientRequest.findUnique({
          where: { id },
          include: { appointment: true },
        });

        if (!existingRequest) {
          throw new Error(`PatientRequest no encontrada con id: ${id}`);
        }

        // Regla: NO permitir reasignar si la PatientRequest ya está
        // asignada Y tiene un appointment realmente activo (por iniciar
        // o en curso). SÍ permitir reasignar si:
        //   - No está asignada (status !== "assigned")
        //   - Está asignada pero el appointment está en estado terminal
        //     o cancelado: completed, cancelled, cancelled_by_professional,
        //     absent, rescheduled (rescheduled requiere aclaración abajo)
        //   - Está asignada pero no tiene appointment asociado (caso muy
        //     raro, defensivo).
        //
        // Estados considerados ACTIVOS (bloquean reasignación):
        //   - pending:    pendiente de confirmación del profesional
        //   - confirmed:  turno confirmado, sin atender
        //
        // Estados considerados TERMINALES o CANCELADOS (permiten reasignación):
        //   - completed:                 turno atendido, tratamiento hecho
        //   - absent:                    paciente no asistió
        //   - cancelled:                 cancelado (por admin o sistema)
        //   - cancelled_by_professional: cancelado por el profesional
        //   - rescheduled:               el profesional marcó que hay que
        //     reprogramar — semánticamente "requiere acción del admin",
        //     permitir reasignar tiene sentido.
        //
        // Bug previo: esta lista incluía 'rescheduled' como activo, lo que
        // bloqueaba reasignar turnos que el profesional ya había marcado
        // como 'reprogramar'. También include 'completed' y 'absent' por
        // error en una versión intermedia. Ahora solo bloquea con
        // pending/confirmed.
        if (existingRequest.status === "assigned") {
          const appt = existingRequest.appointment;
          const hasActiveAppointment =
            appt &&
            ["pending", "confirmed"].includes(appt.status);

          if (hasActiveAppointment) {
            throw new Error(
              `Esta solicitud ya tiene un turno activo (${appt.status}) ` +
              `para el ${appt.date} a las ${appt.time} hs. ` +
              `Si necesitás reasignar, primero cancelá el turno actual desde el panel del profesional o del admin.`
            );
          }
          // Si llegamos acá: está asignada pero el appointment está en
          // estado terminal o cancelado → permitimos reasignar.
        }

        // 1. Find or create patient
        let patient = await tx.patient.findFirst({
          where: {
            user: body.patientEmail
              ? { email: body.patientEmail }
              : { id: "__never__" }, // avoid matching random patients when no email
          },
          include: { user: true },
        });

        // 2. If no patient exists, create user + patient
        if (!patient && body.patientEmail) {
          const existingUser = await tx.user.findUnique({
            where: { email: body.patientEmail },
          });

          if (existingUser) {
            patient = await tx.patient.findUnique({
              where: { userId: existingUser.id },
              include: { user: true },
            });
          }
        }

        if (!patient) {
          const bcrypt = await import("bcryptjs");
          const tempPassword = await bcrypt.hash(
            Math.random().toString(36).slice(2),
            10
          );
          const newUser = await tx.user.create({
            data: {
              name: body.patientName || existingRequest.name || "Paciente",
              email:
                body.patientEmail ||
                existingRequest.email ||
                `pending-${Date.now()}@redescucha.temp`,
              password: tempPassword,
              role: "patient",
              active: false,
            },
          });
          patient = await tx.patient.create({
            data: {
              userId: newUser.id,
              notes: `Creado desde solicitud de triage`,
            },
            include: { user: true },
          });
        }

        // 2b. Si el Patient ya existía pero el nombre del formulario de
        // solicitud es distinto al del User, actualizamos el User.name
        // para que profesional y admin vean el nombre más reciente.
        // Caso típico: paciente "Test turno" vuelve a solicitar turno
        // poniéndose el nombre "Paciente test" → sin esto, todas las
        // tarjetas de turnos del profesional seguirían mostrando "Test
        // turno" porque appointment.patient.user.name no se actualiza.
        const newName = body.patientName || existingRequest.name;
        if (patient && newName && patient.user.name !== newName) {
          await tx.user.update({
            where: { id: patient.userId },
            data: { name: newName },
          });
          // Refresh para que el return del transaction y los emails
          // usen el nombre actualizado
          patient = await tx.patient.findUnique({
            where: { id: patient.id },
            include: { user: true },
          });
        }

        // 3. Create appointment if date and time provided
        let appointmentId: string | null = null;
        if (date && time && patient) {
          const appointment = await tx.appointment.create({
            data: {
              patientId: patient.id,
              professionalId: professional.id,
              date,
              time,
              modality: appointmentModality || "P",
              status: "confirmed",
              reason: `Solicitud de paciente: ${body.patientReason || existingRequest.reason || "otros"}`,
            },
          });
          appointmentId = appointment.id;
        }

        // 4. Update the patient request — status must be "assigned" (lowercase, String field)
        //    Schema: status String @default("pending") // "pending", "assigned", "contacted", "rejected"
        const result = await tx.patientRequest.update({
          where: { id },
          data: {
            status: "assigned",
            assignedToId: professionalId,
            appointmentId,
          },
          include: {
            assignedTo: {
              include: {
                user: { select: { name: true, email: true, phone: true } },
              },
            },
            appointment: true,
          },
        });

        return result;
      });

      // Send notification emails (capture results to report back to admin UI)
      // Ya no es fire-and-forget: esperamos ambos envíos y devolvemos el estado
      // en `emailSent` para que el frontend pueda mostrar un toast informativo
      // si algún email falló (la asignación igualmente se completó OK).
      const patientRequest = await db.patientRequest.findUnique({
        where: { id },
      });
      const emailSent = { professional: false, patient: false };
      if (patientRequest && updated.assignedTo) {
        // Calculate timeEnd from schedule slotDuration
        let timeEnd: string | null = null;
        let officeAddress: string | null = null;
        if (time) {
          // Try to get the professional's schedule to compute endTime
          const [hours, minutes] = time.split(":").map(Number);
          const professionalWithSchedule = await db.professional.findUnique({
            where: { id: professionalId },
            include: {
              schedules: {
                where: { dayOfWeek: new Date(date + "T12:00:00").getDay() || 7 },
                select: { slotDuration: true, startTime: true, endTime: true, direccionId: true },
              },
              addresses: { select: { id: true, label: true, address: true } },
            },
          });
          const slotDuration = professionalWithSchedule?.schedules?.[0]?.slotDuration || 45;
          timeEnd = `${String(hours + Math.floor((minutes + slotDuration) / 60)).padStart(2, "0")}:${String((minutes + slotDuration) % 60).padStart(2, "0")}`;

          // === Resolver officeAddress desde ProfessionalAddress ===
          // 1. Buscar el schedule que contiene la hora del appointment
          // 2. Si tiene direccionId, resolver la dirección
          // 3. Si no, fallback a officeAddress legacy
          const matchingSchedule = professionalWithSchedule?.schedules?.find(
            (s) => time! >= s.startTime && time! < s.endTime
          );
          if (matchingSchedule?.direccionId) {
            const foundAddr = professionalWithSchedule?.addresses?.find((a) => a.id === matchingSchedule.direccionId);
            officeAddress = foundAddr ? `${foundAddr.label}: ${foundAddr.address}` : null;
          } else {
            officeAddress = professionalWithSchedule?.officeAddress || null;
          }

          // === SANITIZAR: quitar emails del profesional del officeAddress ===
          // El paciente NO debe ver el email del profesional en su notificación.
          if (officeAddress) {
            officeAddress = officeAddress.replace(/[^\s:]+@[^\s:]+\.[^\s:]+/g, "").trim().replace(/:\s*$/g, "").trim() || null;
          }
        }

        try {
          const profResult = await sendTriageProfessionalNotification({
            professionalEmail: updated.assignedTo.user.email,
            professionalName: updated.assignedTo.user.name,
            patientName: patientRequest.name,
            patientPhone: patientRequest.phone,
            modality: patientRequest.modality,
            date: date || null,
            time: time || null,
            timeEnd,
            reason: patientRequest.reason,
            officeAddress,
          });
          emailSent.professional = !profResult.error;
          if (profResult.error) {
            console.error("Failed to send professional triage email:", profResult.error);
          }
        } catch (err) {
          console.error("Failed to send professional triage email:", err);
        }

        try {
          const patientResult = await sendTriagePatientNotification({
            patientEmail: patientRequest.email,
            patientName: patientRequest.name,
            professionalName: updated.assignedTo.user.name,
            modality: patientRequest.modality,
            date: date || null,
            time: time || null,
            timeEnd,
            officeAddress,
          });
          emailSent.patient = !patientResult.error;
          if (patientResult.error) {
            console.error("Failed to send patient triage email:", patientResult.error);
          }
        } catch (err) {
          console.error("Failed to send patient triage email:", err);
        }
      }

      return NextResponse.json({ ...updated, emailSent });
    }

    // Simple status change
    if (body.status) {
      const validStatuses = ["pending", "assigned", "contacted", "rejected"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: "Estado inválido" },
          { status: 400 }
        );
      }

      const updated = await db.patientRequest.update({
        where: { id },
        data: { status: body.status },
        include: {
          assignedTo: {
            include: {
              user: { select: { name: true, email: true, phone: true } },
            },
          },
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Acción no especificada" },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al actualizar la solicitud";
    console.error("Error updating patient request:", error);

    // Return specific error for transaction validation failures
    if (message.includes("PatientRequest no encontrada")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    // Conflictos de asignación (solicitud ya asignada con turno activo, etc.)
    if (message.includes("ya tiene un turno activo") || message.includes("ya fue asignada")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Error al actualizar la solicitud" },
      { status: 500 }
    );
  }
}

// DELETE /api/patient-requests/[id] — Delete a patient request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.patientRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting patient request:", error);
    return NextResponse.json(
      { error: "Error al eliminar la solicitud" },
      { status: 500 }
    );
  }
}
