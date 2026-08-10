import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { sanitizeDni, isValidDni } from "@/app/api/admin/patients/route";
import { sendContactNotification } from "@/lib/email";
import { sendAppointmentAlert } from "@/lib/whatsapp-notify";

// === POST /api/public/register-patient ===
// Endpoint PÚBLICO (sin autenticación) para que los visitantes de la
// landing page puedan registrarse como pacientes desde el formulario
// de contacto.
//
// Crea: User (role=patient) + Patient (con DNI) + PatientRequest (triage)
// Envía: email de notificación al admin
//
// Seguridad:
// - Password SIEMPRE autogenerada (no se acepta del cliente)
// - DNI validado con regex /^\d{7,8}$/
// - Email validado con regex básico
// - enableTriage SIEMPRE true
// - active = false (inactivo hasta revisión del admin)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      dni,
      notes,
      modality,
      reason,
      age,
    } = body;

    // === Validaciones ===
    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    if (!email?.trim() || !email.includes("@")) {
      return NextResponse.json({ error: "El email es obligatorio y debe ser válido" }, { status: 400 });
    }

    // === Validación de DNI ===
    let finalDni: string | null = null;
    if (dni && typeof dni === "string" && dni.trim()) {
      finalDni = sanitizeDni(dni);
      if (!isValidDni(finalDni)) {
        return NextResponse.json(
          { error: "El DNI debe tener entre 7 y 8 dígitos numéricos (ej: 12345678)" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate email
    const existingUser = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    // === Generar password aleatoria ===
    const randomPassword = Math.random().toString(36).slice(-10) + "A1!";
    const hashedPassword = await hashPassword(randomPassword);

    // === Crear User + Patient + PatientRequest en transacción ===
    const result = await db.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          password: hashedPassword,
          role: "patient",
          active: false, // Inactivo hasta que el admin lo revise
        },
      });

      // 2. Create Patient
      const newPatient = await tx.patient.create({
        data: {
          userId: user.id,
          dni: finalDni,
          notes: notes?.trim() || null,
        },
      });

      // 3. Create PatientRequest para Triage
      const validModalities = ["online", "presencial", "híbrida"];
      const validReasons = [
        "ansiedad", "depresion", "vinculos", "duelo", "autoestima",
        "adicciones", "estres", "laboral", "orientacion_padres",
        "evaluaciones", "discapacidad", "otros",
        "infanto_juvenil", "consulta_general",
      ];

      const triageModality = validModalities.includes(modality) ? modality : "presencial";
      const triageReason = validReasons.includes(reason) ? reason : "otros";

      const patientRequest = await tx.patientRequest.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          modality: triageModality,
          reason: triageReason,
          notes: notes?.trim() || null,
          status: "pending",
        },
      });

      return { patient: newPatient, patientRequest };
    });

    // === Enviar email de notificación al admin ===
    try {
      await sendContactNotification({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        message: `Nuevo paciente registrado desde la web. DNI: ${finalDni || "No cargado"}. Motivo: ${reason || "otros"}. Modalidad: ${modality || "presencial"}. ${notes ? "Mensaje: " + notes : ""}`,
        reason: "solicitar_turno",
        modality: modality || "presencial",
      });
    } catch (emailError) {
      console.error("⚠️ Error enviando notificación (no bloqueante):", emailError);
    }

    // === Alerta por WhatsApp al admin (await para que Vercel no corte el fire-and-forget) ===
    try {
      await sendAppointmentAlert({
        patientName: name.trim(),
        patientPhone: phone?.trim() || "",
        patientEmail: email.trim().toLowerCase(),
        zone: reason || null,
        modality: modality || null,
        reason: notes || null,
        age: age || null,
      });
    } catch (err) {
      console.error("[WhatsApp Alert] Error no bloqueante:", err);
    }

    return NextResponse.json(
      { ...result, message: "Paciente registrado con éxito e ingresado al sistema de Triage" },
      { status: 201 }
    );
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: unknown; message?: string };
    console.error("Error en registro público de paciente:", {
      code: prismaError.code,
      meta: prismaError.meta,
      message: prismaError.message,
    });
    return NextResponse.json(
      { error: "Error al registrar paciente", detail: prismaError.code || "unknown" },
      { status: 500 }
    );
  }
}
