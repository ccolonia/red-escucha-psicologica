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

      // Find or create a patient for this request
      let patient = await db.patient.findFirst({
        where: { user: { email: body.patientEmail || undefined } },
        include: { user: true },
      });

      // If no patient exists, we need to create one with a user account
      // But for triage flow, the patient might not have an account yet
      // We'll create a minimal appointment linked to the request

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

      // Create appointment if date and time provided
      let appointmentId: string | null = null;
      if (date && time && patient) {
        const appointment = await db.appointment.create({
          data: {
            patientId: patient.id,
            professionalId: professional.id,
            date,
            time,
            modality: appointmentModality || "P",
            status: "confirmed",
            reason: `Solicitud de paciente: ${body.patientReason || "consulta_general"}`,
          },
        });
        appointmentId = appointment.id;
      } else if (date && time && !patient) {
        // No patient account yet - create appointment linked to request only
        // We'll create a placeholder patient for the appointment
        const existingUser = await db.user.findUnique({
          where: { email: body.patientEmail },
        });

        if (existingUser) {
          patient = await db.patient.findUnique({
            where: { userId: existingUser.id },
          });
        }

        if (!patient) {
          // Create user + patient
          const bcrypt = await import("bcryptjs");
          const tempPassword = await bcrypt.hash(
            Math.random().toString(36).slice(2),
            10
          );
          const newUser = await db.user.create({
            data: {
              name: body.patientName || "Paciente",
              email: body.patientEmail || `pending-${Date.now()}@redescucha.temp`,
              password: tempPassword,
              role: "patient",
              active: false, // Not yet activated - will set password later
            },
          });
          patient = await db.patient.create({
            data: {
              userId: newUser.id,
              notes: `Creado desde solicitud de triage`,
            },
          });
        }

        if (patient) {
          const appointment = await db.appointment.create({
            data: {
              patientId: patient.id,
              professionalId: professional.id,
              date,
              time,
              modality: appointmentModality || "P",
              status: "confirmed",
              reason: `Solicitud de paciente: ${body.patientReason || "consulta_general"}`,
            },
          });
          appointmentId = appointment.id;
        }
      }

      // Update the patient request
      const updated = await db.patientRequest.update({
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

      // Send notification emails (non-blocking - don't fail the assignment if email fails)
      const patientRequest = await db.patientRequest.findUnique({ where: { id } });
      if (patientRequest && updated.assignedTo) {
        // Notify professional
        sendTriageProfessionalNotification({
          professionalEmail: updated.assignedTo.user.email,
          professionalName: updated.assignedTo.user.name,
          patientName: patientRequest.name,
          patientPhone: patientRequest.phone,
          modality: patientRequest.modality,
          date: date || null,
          time: time || null,
          reason: patientRequest.reason,
        }).catch((err) => console.error("Failed to send professional triage email:", err));

        // Notify patient
        sendTriagePatientNotification({
          patientEmail: patientRequest.email,
          patientName: patientRequest.name,
          professionalName: updated.assignedTo.user.name,
          modality: patientRequest.modality,
          date: date || null,
          time: time || null,
        }).catch((err) => console.error("Failed to send patient triage email:", err));
      }

      return NextResponse.json(updated);
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
  } catch (error) {
    console.error("Error updating patient request:", error);
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
