import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTriagePatientNotification, sendTriageProfessionalNotification } from "@/lib/email";

// POST /api/admin/quick-assign
//
// Asignación rápida de turno desde la Agenda Centralizada del admin.
// Hace upsert de Patient por email (buscar o crear) + crea Appointment
// con status "confirmed" en una transacción atómica.
//
// Body:
//   professionalId  — String (obligatorio)
//   date            — String ISO "2026-06-23" (obligatorio)
//   time            — String "HH:MM" (obligatorio)
//   modality        — String "P" | "OL" | "H" (default "P")
//   patientName     — String (obligatorio)
//   patientPhone    — String (obligatorio)
//   patientEmail    — String (obligatorio)
//   notes           — String (opcional)
//
// Response:
//   200 + { success, appointment, patient, created } — asignación OK
//   400 — faltan datos obligatorios
//   401/403 — no autenticado / no admin
//   409 — conflict (slot ya ocupado o paciente con appointment activo)
//   500 — error
//
// Lógica (transacción Prisma):
//   1. Validar campos obligatorios
//   2. Verificar que el profesional existe y está disponible
//   3. Verificar que el slot no esté ya ocupado (conflict check)
//   4. Upsert de Patient por email:
//      a. Buscar Patient por email (con include user)
//      b. Si no existe, buscar User por email → si existe, crear Patient
//      c. Si no existe User, crear User + Patient (password random, active=false)
//      d. Si el Patient ya existía pero el nombre difiere, actualizar user.name
//         (safety net — mismo patrón que el PATCH de patient-requests)
//   5. Verificar que el paciente no tenga appointment activo en esa fecha/hora
//   6. Crear Appointment con status "confirmed"
//   7. Devolver appointment + patient + flag created (true si se creó nuevo)

export async function POST(request: NextRequest) {
  try {
    // === Auth: solo admin/super_admin ===
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const {
      professionalId,
      date,
      time,
      modality,
      patientName,
      patientPhone,
      patientEmail,
      notes,
      isLead,
      leadId,
    } = body;

    // === Validación de campos obligatorios ===
    if (!professionalId || !date || !time) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (professionalId, date, time)" },
        { status: 400 }
      );
    }
    if (!patientName?.trim() || !patientEmail?.trim() || !patientPhone?.trim()) {
      return NextResponse.json(
        { error: "Nombre, email y teléfono del paciente son obligatorios" },
        { status: 400 }
      );
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(patientEmail.trim())) {
      return NextResponse.json(
        { error: "Email del paciente inválido" },
        { status: 400 }
      );
    }

    const trimmedName = patientName.trim();
    const trimmedEmail = patientEmail.trim().toLowerCase();
    const trimmedPhone = patientPhone.trim();
    const trimmedNotes = notes?.trim() || null;
    const appointmentModality = modality || "P";

    // === Bloqueo de asignaciones retroactivas (pasado) ===
    // Combinar date ("2026-06-19") + time ("21:00") en un objeto Date
    // ajustado a timezone Argentina. Si la fecha/hora del turno es
    // anterior al momento actual, abortar con 400.
    //
    // El formato "2026-06-19T21:00:00" sin Z al final es interpretado
    // como hora local por el motor JS, pero como el servidor de Vercel
    // puede estar en otra timezone, forzamos la interpretación como
    // America/Argentina/Buenos_Aires usando en-US con timeZone option.
    const ARG_TZ = "America/Argentina/Buenos_Aires";
    const nowInArgentina = new Date(new Date().toLocaleString("en-US", { timeZone: ARG_TZ }));

    // Construir la fecha/hora del turno en Argentina: combinamos date + time
    // en formato "YYYY-MM-DDTHH:MM:00" y lo parseamos como hora local de Argentina.
    // Usamos el mismo truco: crear la fecha y luego reinterpretar.
    const slotDateTimeStr = `${date}T${time}:00`;
    const slotDateRaw = new Date(slotDateTimeStr);
    // Ajustar la fecha del slot a la timezone de Argentina para comparar
    // correctamente con nowInArgentina (ambos en la misma referencia temporal).
    const slotInArgentina = new Date(slotDateRaw.toLocaleString("en-US", { timeZone: ARG_TZ }));

    if (slotInArgentina < nowInArgentina) {
      return NextResponse.json(
        { error: "No es posible asignar turnos en fechas u horarios pasados." },
        { status: 400 }
      );
    }

    // === Transacción atómica ===
    const result = await db.$transaction(async (tx) => {
      // 1. Verificar que el profesional existe y está disponible
      const professional = await tx.professional.findUnique({
        where: { id: professionalId },
        include: { user: { select: { name: true } } },
      });

      if (!professional) {
        throw new Error("Profesional no encontrado");
      }
      if (!professional.available) {
        throw new Error("El profesional no está disponible");
      }

      // 2. Conflict check: ¿ya hay un appointment en ese slot?
      const existingAppointment = await tx.appointment.findFirst({
        where: {
          professionalId,
          date,
          time,
          status: { in: ["pending", "confirmed"] },
        },
      });

      if (existingAppointment) {
        throw new Error(
          `El slot ${date} a las ${time} hs ya está ocupado por otro turno (status: ${existingAppointment.status}). ` +
          `Recargá la búsqueda para ver slots actualizados.`
        );
      }

      // 3. Upsert de Patient por email (mismo patrón que PATCH /api/patient-requests/[id])
      let patient = await tx.patient.findFirst({
        where: { user: { email: trimmedEmail } },
        include: { user: true },
      });

      // Si no hay Patient pero sí User, crear Patient vinculado
      if (!patient) {
        const existingUser = await tx.user.findUnique({
          where: { email: trimmedEmail },
        });

        if (existingUser) {
          patient = await tx.patient.findUnique({
            where: { userId: existingUser.id },
            include: { user: true },
          });
        }
      }

      let patientCreated = false;

      // Si todavía no hay Patient, crear User + Patient
      if (!patient) {
        const bcrypt = await import("bcryptjs");
        const tempPassword = await bcrypt.hash(
          Math.random().toString(36).slice(2),
          10
        );
        const newUser = await tx.user.create({
          data: {
            name: trimmedName,
            email: trimmedEmail,
            password: tempPassword,
            phone: trimmedPhone,
            role: "patient",
            active: false,
          },
        });
        patient = await tx.patient.create({
          data: {
            userId: newUser.id,
            notes: `Creado desde asignación rápida por admin (${new Date().toISOString().split("T")[0]})`,
          },
          include: { user: true },
        });
        patientCreated = true;
      } else {
        // Patient ya existía — actualizar name y phone si difieren
        // (safety net del commit b4dd4b1)
        if (patient.user.name !== trimmedName) {
          await tx.user.update({
            where: { id: patient.userId },
            data: { name: trimmedName },
          });
        }
        // Actualizar phone si el User no lo tiene o es distinto
        if (patient.user.phone !== trimmedPhone) {
          await tx.user.update({
            where: { id: patient.userId },
            data: { phone: trimmedPhone },
          });
        }
        // Refrescar patient para tener los datos actualizados
        patient = await tx.patient.findUnique({
          where: { id: patient.id },
          include: { user: true },
        });
      }

      if (!patient) {
        throw new Error("Error al crear/obtener el paciente");
      }

      // 4. Verificar que el paciente no tenga appointment activo en esa fecha/hora
      // (evita doble booking del mismo paciente en horarios superpuestos)
      const patientConflict = await tx.appointment.findFirst({
        where: {
          patientId: patient.id,
          date,
          time,
          status: { in: ["pending", "confirmed"] },
        },
      });

      if (patientConflict) {
        throw new Error(
          `El paciente ya tiene un turno activo el ${date} a las ${time} hs. ` +
          `Elegí otro horario para evitar superposición.`
        );
      }

      // 5. Crear Appointment con status "confirmed"
      const appointment = await tx.appointment.create({
        data: {
          patientId: patient.id,
          professionalId,
          date,
          time,
          modality: appointmentModality,
          status: "confirmed",
          reason: `Asignación rápida por admin: ${trimmedName}`,
          notes: trimmedNotes,
        },
        include: {
          patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
          professional: { include: { user: { select: { name: true } } } },
        },
      });

      // 6. Si viene de un PatientRequest (isLead), marcarlo como "assigned"
      // para sacarlo de la bandeja de pendientes del Triage.
      if (isLead && leadId) {
        await tx.patientRequest.update({
          where: { id: leadId },
          data: {
            status: "assigned",
            assignedToId: professionalId,
            appointmentId: appointment.id,
          },
        }).catch(() => {
          // Si el PatientRequest no existe o ya fue asignado, no romper
          // el flujo — el appointment ya está creado.
        });
      }

      return {
        appointment,
        patient: {
          id: patient.id,
          name: patient.user.name,
          email: patient.user.email,
          phone: patient.user.phone,
        },
        created: patientCreated,
      };
    });

    // === Notificación automática dual (paciente + profesional) ===
    // try/catch aislado: si los emails fallan, la cita NO se revierte.
    const emailSent = { patient: false, professional: false };
    try {
      const professionalName = result.appointment.professional?.user?.name || "Profesional";
      // Calcular timeEnd + officeAddress según schedule del profesional
      let timeEnd: string | null = null;
      let officeAddress: string | null = null;
      if (result.appointment.time) {
        const [h, m] = result.appointment.time.split(":").map(Number);
        const profWithSchedule = await db.professional.findUnique({
          where: { id: professionalId },
          include: {
            schedules: {
              where: { dayOfWeek: new Date(result.appointment.date + "T12:00:00").getDay() || 7 },
              select: { slotDuration: true },
              take: 1,
            },
          },
        });
        const slotDuration = profWithSchedule?.schedules?.[0]?.slotDuration || 45;
        const totalMin = h * 60 + m + slotDuration;
        timeEnd = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
        officeAddress = profWithSchedule?.officeAddress || null;
      }

      // 1. Email al paciente
      try {
        const patientResult = await sendTriagePatientNotification({
          patientEmail: result.patient.email,
          patientName: result.patient.name,
          professionalName,
          modality: result.appointment.modality || "P",
          date: result.appointment.date,
          time: result.appointment.time,
          timeEnd,
        });
        emailSent.patient = !patientResult.error;
        if (patientResult.error) {
          console.error("Failed to send quick-assign patient notification:", patientResult.error);
        }
      } catch (err) {
        console.error("Quick-assign patient notification exception:", err);
      }

      // 2. Email al profesional
      try {
        // Buscar el email del profesional (no viene en el result de la transacción)
        const profUser = await db.professional.findUnique({
          where: { id: professionalId },
          include: { user: { select: { email: true, name: true } } },
        });
        if (profUser?.user?.email) {
          const profResult = await sendTriageProfessionalNotification({
            professionalEmail: profUser.user.email,
            professionalName: profUser.user.name,
            patientName: result.patient.name,
            patientPhone: result.patient.phone || null,
            modality: result.appointment.modality || "P",
            date: result.appointment.date,
            time: result.appointment.time,
            timeEnd,
            reason: isLead
              ? `Paciente nuevo derivado de Solicitud Online. ${trimmedNotes || ""}`.trim()
              : `Asignación rápida por admin. ${trimmedNotes || ""}`.trim(),
            officeAddress,
          });
          emailSent.professional = !profResult.error;
          if (profResult.error) {
            console.error("Failed to send quick-assign professional notification:", profResult.error);
          }
        }
      } catch (err) {
        console.error("Quick-assign professional notification exception:", err);
      }
    } catch (emailErr) {
      console.error("Quick-assign notification outer exception:", emailErr);
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: result.appointment.id,
        date: result.appointment.date,
        time: result.appointment.time,
        modality: result.appointment.modality,
        status: result.appointment.status,
      },
      patient: result.patient,
      created: result.created,
      emailSent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al asignar el turno";
    console.error("Error in quick-assign:", error);

    // Errores de validación de negocio → 409
    if (
      message.includes("ya está ocupado") ||
      message.includes("ya tiene un turno activo") ||
      message.includes("no está disponible") ||
      message.includes("no encontrado")
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
