import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendTriagePatientNotification, sendTriageProfessionalNotification } from "@/lib/email";

// POST /api/appointments/[id]/resend-confirmation
// Body: { recipient: "patient" | "professional" | "both" }
//
// Reenvía el mail de confirmación de un turno existente.
// Actualiza los campos patientEmailStatus / professionalEmailStatus en la DB.
// Solo admin/super_admin puede ejecutar esta acción.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const recipient = body.recipient || "both";

    if (!["patient", "professional", "both"].includes(recipient)) {
      return NextResponse.json({ error: "recipient debe ser 'patient', 'professional' o 'both'" }, { status: 400 });
    }

    // Cargar el appointment con relaciones
    const appointment = await db.appointment.findUnique({
      where: { id },
      include: {
        patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
        professional: { include: { user: { select: { name: true, email: true, phone: true } } } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    const updateData: {
      patientEmailStatus?: string;
      patientEmailSentAt?: Date;
      professionalEmailStatus?: string;
      professionalEmailSentAt?: Date;
    } = {};

    const results: { patient?: string; professional?: string } = {};

    // === Enviar mail al PACIENTE ===
    if (recipient === "patient" || recipient === "both") {
      try {
        await sendTriagePatientNotification({
          patientEmail: appointment.patient.user.email,
          patientName: appointment.patient.user.name,
          professionalName: appointment.professional.user.name,
          date: appointment.date,
          time: appointment.time,
          modality: appointment.modality || "P",
        });
        updateData.patientEmailStatus = "SENT";
        updateData.patientEmailSentAt = new Date();
        results.patient = "SENT";
      } catch (err) {
        console.error("Resend patient email error:", err);
        updateData.patientEmailStatus = "FAILED";
        updateData.patientEmailSentAt = new Date();
        results.patient = "FAILED";
      }
    }

    // === Enviar mail al PROFESIONAL ===
    if (recipient === "professional" || recipient === "both") {
      try {
        await sendTriageProfessionalNotification({
          professionalEmail: appointment.professional.user.email,
          professionalName: appointment.professional.user.name,
          patientName: appointment.patient.user.name,
          patientPhone: appointment.patient.user.phone || undefined,
          date: appointment.date,
          time: appointment.time,
          modality: appointment.modality || "P",
        });
        updateData.professionalEmailStatus = "SENT";
        updateData.professionalEmailSentAt = new Date();
        results.professional = "SENT";
      } catch (err) {
        console.error("Resend professional email error:", err);
        updateData.professionalEmailStatus = "FAILED";
        updateData.professionalEmailSentAt = new Date();
        results.professional = "FAILED";
      }
    }

    // Actualizar la DB con los resultados
    await db.appointment.update({
      where: { id },
      data: updateData,
    });

    const parts: string[] = [];
    if (results.patient === "SENT") parts.push("Paciente ✓");
    else if (results.patient === "FAILED") parts.push("Paciente ✗");
    if (results.professional === "SENT") parts.push("Profesional ✓");
    else if (results.professional === "FAILED") parts.push("Profesional ✗");

    return NextResponse.json({
      success: true,
      results,
      message: `Reenvío completado: ${parts.join(" · ")}`,
    });
  } catch (error) {
    console.error("Resend confirmation error:", error);
    return NextResponse.json(
      { error: "Error al reenviar confirmaciones: " + (error as Error).message },
      { status: 500 }
    );
  }
}
