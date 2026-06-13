import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Valid status transitions
// "cancelled_by_professional" is an intermediate state: professional cancelled but
// admin must decide whether to reassign or delete definitively
const validTransitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled", "cancelled_by_professional", "rescheduled"],
  confirmed: ["completed", "cancelled", "cancelled_by_professional", "absent", "rescheduled"],
  cancelled_by_professional: ["cancelled", "confirmed"], // admin can reassign or delete
  completed: [],
  cancelled: [],
  absent: [],
  rescheduled: ["confirmed", "cancelled", "cancelled_by_professional"],
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
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Estado es requerido" },
        { status: 400 }
      );
    }

    // Fetch the current appointment to validate status transition
    const currentAppointment = await db.appointment.findUnique({
      where: { id },
      include: { patient: true },
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
      },
      include: {
        patient: { include: { user: { select: { name: true } } } },
        professional: { include: { user: { select: { name: true } } } },
      },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Update appointment error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el turno" },
      { status: 500 }
    );
  }
}
