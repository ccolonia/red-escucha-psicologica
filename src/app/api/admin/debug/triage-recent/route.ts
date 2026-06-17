import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/debug/triage-recent
//
// Endpoint de diagnóstico: devuelve los últimos 20 PatientRequests con
// status="assigned" junto con todos sus datos relacionados (patient, user,
// appointment, professional). Solo super_admin.
//
// Uso: cuando un profesional reporta que no ve un paciente/turno en su
// panel después de una asignación de triage, este endpoint permite ver
// exactamente qué se creó en la DB.
//
// Posibles causas que este endpoint ayuda a diagnosticar:
//   - appointment = null → el PATCH no creó el appointment (¿falta date/time?)
//   - appointment.professionalId ≠ profesionalLogueado.id → mismatch de IDs
//   - patient = null → falló la creación del patient
//   - patient.user.active = false → paciente creado pero inactivo (esperado)
//   - patientRequest.appointmentId = null → el PatientRequest no se linkeó
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "super_admin") {
    return NextResponse.json(
      { error: "Solo super_admin puede usar este endpoint de diagnóstico" },
      { status: 403 }
    );
  }

  // Traer los últimos 20 PatientRequests asignados con todas las relaciones
  const requests = await db.patientRequest.findMany({
    where: { status: "assigned" },
    include: {
      assignedTo: {
        include: {
          user: { select: { id: true, name: true, email: true, active: true } },
        },
      },
      appointment: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  // Para cada request, buscar el Patient asociado por email del user
  // (porque PatientRequest no tiene FK directa a Patient)
  const enriched = await Promise.all(
    requests.map(async (req) => {
      let patient: any = null;
      if (req.email) {
        patient = await db.patient.findFirst({
          where: { user: { email: req.email } },
          include: {
            user: { select: { id: true, name: true, email: true, active: true } },
          },
        });
      }

      // Si hay appointment, traer el patient directo via appointment.patientId
      let appointmentPatient: any = null;
      if (req.appointment?.patientId) {
        appointmentPatient = await db.patient.findUnique({
          where: { id: req.appointment.patientId },
          include: {
            user: { select: { id: true, name: true, email: true, active: true } },
          },
        });
      }

      return {
        patientRequest: {
          id: req.id,
          name: req.name,
          email: req.email,
          phone: req.phone,
          status: req.status,
          reason: req.reason,
          modality: req.modality,
          assignedToId: req.assignedToId,
          appointmentId: req.appointmentId,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
        },
        professional: req.assignedTo
          ? {
              id: req.assignedTo.id,
              specialty: req.assignedTo.specialty,
              user: req.assignedTo.user,
            }
          : null,
        appointment: req.appointment
          ? {
              id: req.appointment.id,
              patientId: req.appointment.patientId,
              professionalId: req.appointment.professionalId,
              date: req.appointment.date,
              time: req.appointment.time,
              status: req.appointment.status,
              modality: req.appointment.modality,
              reason: req.appointment.reason,
              createdAt: req.appointment.createdAt,
            }
          : null,
        // Patient encontrado por email del PatientRequest
        patientByEmail: patient
          ? {
              id: patient.id,
              userId: patient.userId,
              user: patient.user,
            }
          : null,
        // Patient encontrado por appointment.patientId (debería coincidir con patientByEmail)
        patientByAppointment: appointmentPatient
          ? {
              id: appointmentPatient.id,
              userId: appointmentPatient.userId,
              user: appointmentPatient.user,
            }
          : null,
        // Diagnostic flags
        diagnosis: {
          appointmentExists: !!req.appointment,
          patientExists: !!patient,
          patientsMatch: !!patient && !!appointmentPatient && patient.id === appointmentPatient.id,
          professionalMatchesAppointment: !!req.appointment && !!req.assignedTo && req.appointment.professionalId === req.assignedTo.id,
        },
      };
    })
  );

  // Info del super_admin logueado para referencia
  const me = await db.user.findUnique({
    where: { id: (session.user as { id: string }).id },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({
    me,
    count: enriched.length,
    items: enriched,
  });
}
