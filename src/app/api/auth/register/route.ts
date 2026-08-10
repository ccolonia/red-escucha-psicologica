import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { sendProfessionalRegistrationConfirmation, sendNewProfessionalAdminNotification } from "@/lib/email";
import { sendAppointmentAlert } from "@/lib/whatsapp-notify";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, email, phone, password, role, license, specialty, bio,
      title, cuil, gender, therapyTypes, targetAudience, therapyModality,
      onlineAttention, presentialAttention, homeAttention, zones,
      otherTherapyDetails,
      // === Campos para registro público de pacientes desde landing page ===
      dni,
      modality: triageModality,
      reason: triageReason,
      notes: patientNotes,
      enableTriage,
      age,
    } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nombre, email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // === Validación estricta cuando es alta de paciente desde el form público ===
    // Solo validamos estos 3 campos cuando enableTriage=true (es decir, cuando
    // viene del formulario de contacto de la landing page, no de un admin
    // creando profesional ni de un paciente existente haciendo login).
    if (enableTriage) {
      const validModalities = ["online", "presencial", "híbrida"];
      const validReasons = [
        "ansiedad", "depresion", "vinculos", "duelo", "autoestima",
        "adicciones", "estres", "laboral", "orientacion_padres",
        "evaluaciones", "discapacidad", "otros",
        "infanto_juvenil", "consulta_general",
      ];

      if (!triageModality || !validModalities.includes(triageModality)) {
        return NextResponse.json(
          { error: "Modalidad es obligatoria (Presencial, Online o Híbrida)", code: "INVALID_MODALITY" },
          { status: 400 }
        );
      }
      if (!triageReason || !validReasons.includes(triageReason)) {
        return NextResponse.json(
          { error: "Motivo de consulta es obligatorio", code: "INVALID_REASON" },
          { status: 400 }
        );
      }
      const ageNum = typeof age === "number" ? age : parseInt(String(age ?? ""), 10);
      if (
        age === null ||
        age === undefined ||
        String(age).trim() === "" ||
        !Number.isFinite(ageNum) ||
        ageNum < 1 ||
        ageNum > 120
      ) {
        return NextResponse.json(
          { error: "Edad del paciente debe ser un número entero entre 1 y 120", code: "INVALID_AGE" },
          { status: 400 }
        );
      }
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // === Si es profesional o admin, bloquear (1 email = 1 rol) ===
      if (existingUser.role !== "patient") {
        const roleMessages: Record<string, string> = {
          professional:
            "Ya existe una cuenta de profesional con este email. Si ya te registraste como profesional, esperá la aprobación del administrador. Si no recordás tu contraseña, usá '¿Olvidaste tu contraseña?' en la pantalla de inicio de sesión.",
          admin:
            "Este email ya está registrado en el sistema como administrador. Contactanos a contacto@redescuchapsicologica.com para asistencia.",
          super_admin:
            "Este email ya está registrado en el sistema como administrador. Contactanos a contacto@redescuchapsicologica.com para asistencia.",
        };
        const specificMessage =
          roleMessages[existingUser.role] ||
          "Ya existe una cuenta con este email. Contactanos a contacto@redescuchapsicologica.com para asistencia.";

        return NextResponse.json(
          {
            error: specificMessage,
            code: "EMAIL_ALREADY_EXISTS",
            existingRole: existingUser.role,
          },
          { status: 409 }
        );
      }

      // === Si es paciente existente, NO bloquear ===
      // En REP, el formulario de contacto es una Mesa de Entrada / Intake.
      // Un mismo paciente (o un familiar con el mismo email) debe poder
      // enviar múltiples solicitudes de turno a lo largo del tiempo.
      // En vez de crear un nuevo User (chocaría con unique email),
      // actualizamos sus datos de contacto y creamos una nueva PatientRequest.
      
      // Actualizar datos de contacto (teléfono, nombre)
      await db.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          phone: phone || existingUser.phone,
        },
      });

      // Actualizar DNI si se proporcionó y el paciente no lo tenía
      if (dni) {
        const finalDniUpdate = dni.replace(/[^0-9]/g, "");
        if (/^\d{7,8}$/.test(finalDniUpdate)) {
          const existingPatient = await db.patient.findUnique({
            where: { userId: existingUser.id },
          });
          if (existingPatient && !existingPatient.dni) {
            await db.patient.update({
              where: { userId: existingUser.id },
              data: { dni: finalDniUpdate },
            });
          }
        }
      }

      // Crear nueva PatientRequest para Triage
      const validModalities = ["online", "presencial", "híbrida"];
      const validReasons = [
        "ansiedad", "depresion", "vinculos", "duelo", "autoestima",
        "adicciones", "estres", "laboral", "orientacion_padres",
        "evaluaciones", "discapacidad", "otros",
        "infanto_juvenil", "consulta_general",
      ];
      const finalModality = validModalities.includes(triageModality) ? triageModality : "presencial";
      const finalReason = validReasons.includes(triageReason) ? triageReason : "otros";

      await db.patientRequest.create({
        data: {
          name,
          email,
          phone: phone || null,
          modality: finalModality,
          reason: finalReason,
          notes: patientNotes || null,
          status: "pending",
        },
      });

      // Enviar email de notificación al admin
      try {
        const { sendContactNotification } = await import("@/lib/email");
        await sendContactNotification({
          name,
          email,
          phone: phone || null,
          message: `Nuevo paciente registrado desde la web. DNI: ${dni || "No cargado"}. Motivo: ${triageReason || "otros"}. Modalidad: ${triageModality || "presencial"}.${patientNotes ? " Mensaje: " + patientNotes : ""}`,
          reason: "solicitar_turno",
          modality: triageModality || "presencial",
          age: age || null,
        });
        console.log(`📧 Notificación de nueva consulta de paciente existente enviada: ${email}`);
      } catch (emailError) {
        console.error("⚠️ Error enviando notificación (no bloqueante):", emailError);
      }

      // === Alerta por WhatsApp al admin (await para que Vercel no corte el fire-and-forget) ===
      try {
        await sendAppointmentAlert({
          patientName: name,
          patientPhone: phone || "",
          patientEmail: email,
          modality: triageModality || null,
          reason: triageReason || null,
          notes: patientNotes || null,
          age: age || null,
        });
      } catch (err) {
        console.error("[WhatsApp Alert] Error no bloqueante:", err);
      }

      return NextResponse.json(
        { message: "¡Gracias por tu consulta! En breve un integrante de nuestro equipo se pondrá en contacto contigo.", userId: existingUser.id },
        { status: 200 }
      );
    }

    // If role is "professional"
    if (role === "professional") {
      if (!license || !specialty) {
        return NextResponse.json(
          { error: "Matrícula y especialidad son obligatorias para profesionales" },
          { status: 400 }
        );
      }

      // === Validar formato de matrícula ===
      // Excepción: si la matrícula es "EN TRÁMITE", se permite sin validar
      // formato (el profesional todavía no tiene la matrícula definitiva).
      // licenseVerified queda en false hasta que el admin la verifique.
      if (license !== "EN TRÁMITE") {
        const licenseClean = license.replace(/[\s.-]/g, "");
        const licenseRegex = /^(MN|MP)(\d{4,6})$/;
        if (!licenseRegex.test(licenseClean)) {
          return NextResponse.json(
            { error: "La matrícula debe ser MN o MP seguido de 4 a 6 dígitos (ej: MN-12345 o MP-5432)" },
            { status: 400 }
          );
        }
      }

      // Check if license already exists
      // === Excepción: "EN TRÁMITE" no se valida como duplicado ===
      // Como TODOS los profesionales sin matrícula usan "EN TRÁMITE", si
      // validáramos duplicados, solo el primero podría registrarse. Los
      // demás chocarían con "Ya existe un profesional con esta matrícula".
      // Para "EN TRÁMITE" generamos un valor único agregando un sufijo.
      let finalLicense = license;
      if (license === "EN TRÁMITE") {
        // Generar un valor único: "EN TRÁMITE-{timestamp}" para evitar colisión
        finalLicense = `EN TRÁMITE-${Date.now()}`;
      }

      const existingLicense = await db.professional.findUnique({
        where: { license: finalLicense },
      });

      if (existingLicense) {
        return NextResponse.json(
          { error: "Ya existe un profesional con esta matrícula" },
          { status: 409 }
        );
      }

      // === Validación: Otras terapias requiere detalle ===
      // Si el profesional seleccionó "Otras terapias" en el array
      // therapyTypes, el campo otherTherapyDetails es obligatorio (no
      // vacío ni whitespace). Sino, se rechaza con 400.
      const hasOtherTherapies = Array.isArray(therapyTypes) &&
        therapyTypes.includes("Otras terapias");
      const trimmedOtherDetails = typeof otherTherapyDetails === "string"
        ? otherTherapyDetails.trim()
        : "";
      if (hasOtherTherapies && trimmedOtherDetails.length < 3) {
        return NextResponse.json(
          {
            error: "Seleccionaste 'Otras terapias' pero no especificaste el enfoque. Por favor, detallá la terapia en el campo 'Especificar otra terapia' (mínimo 3 caracteres).",
            code: "OTHER_THERAPY_DETAILS_REQUIRED",
          },
          { status: 400 }
        );
      }

      // Public registration: professional starts as inactive until admin approves
      const session = await getServerSession(authOptions);
      const userRole = (session?.user as { role: string })?.role;
      const isAdmin = session?.user && (userRole === "admin" || userRole === "super_admin");

      const hashedPassword = await hashPassword(password);

      const user = await db.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          password: hashedPassword,
          role: "professional",
          active: isAdmin ? true : false, // Inactive until admin approves
        },
      });

      // Validate CV data
      const allowedMimeTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      const cvBase64 = body.cvBase64 || null;
      const cvOriginalName = body.cvOriginalName || null;
      const cvMimeType = body.cvMimeType || null;
      const hasValidCv = cvBase64 && cvOriginalName && cvMimeType && allowedMimeTypes.includes(cvMimeType);

      await db.professional.create({
        data: {
          userId: user.id,
          license: finalLicense,
          specialty,
          bio: bio || null,
          title: title || null,
          profession: body.profession || null,
          cuil: cuil || null,
          gender: gender || null,
          therapyTypes: therapyTypes ? JSON.stringify(therapyTypes) : null,
          targetAudience: targetAudience ? JSON.stringify(targetAudience) : null,
          therapyModality: therapyModality ? JSON.stringify(therapyModality) : null,
          // === Persistir detalle de "Otras terapias" ===
          // Solo se guarda si el profesional seleccionó "Otras terapias"
          // y escribió un detalle. En caso contrario queda null.
          otherTherapyDetails: hasOtherTherapies ? trimmedOtherDetails : null,
          onlineAttention: onlineAttention ?? false,
          presentialAttention: presentialAttention ?? false,
          homeAttention: homeAttention ?? false,
          zones: zones ? JSON.stringify(zones) : null,
          cvData: hasValidCv ? cvBase64 : null,
          cvFileName: hasValidCv ? cvOriginalName : null,
          cvMimeType: hasValidCv ? cvMimeType : null,
        },
      });

      const message = isAdmin
        ? "Profesional creado exitosamente"
        : "Tu registro fue enviado exitosamente. Un administrador lo revisará y activará tu cuenta.";

      // Send emails in the background (don't block the response)
      // Only send when it's a public registration (not admin creating)
      if (!isAdmin) {
        // Email to professional: confirmation of receipt
        sendProfessionalRegistrationConfirmation({
          userEmail: email,
          userName: name,
        }).catch((err) => console.error("Failed to send professional registration confirmation:", err));

        // Email to admin: notification of new professional
        sendNewProfessionalAdminNotification({
          professionalName: name,
          professionalEmail: email,
          professionalPhone: phone || null,
          profession: body.profession || null,
          license: finalLicense,
          specialty,
          title: title || null,
        }).catch((err) => console.error("Failed to send admin notification:", err));
      }

      return NextResponse.json(
        { message, userId: user.id },
        { status: 201 }
      );
    }

    // Default: create patient (no session check needed for self-registration)
    // === Validar DNI si viene ===
    let finalDni: string | null = null;
    if (dni && typeof dni === "string" && dni.trim()) {
      finalDni = dni.replace(/[^0-9]/g, "");
      if (!/^\d{7,8}$/.test(finalDni)) {
        return NextResponse.json(
          { error: "El DNI debe tener entre 7 y 8 dígitos numéricos" },
          { status: 400 }
        );
      }
    }

    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: "patient",
      },
    });

    await db.patient.create({
      data: {
        userId: user.id,
        dni: finalDni,
        notes: patientNotes || null,
      },
    });

    // === Crear PatientRequest para Triage si enableTriage ===
    if (enableTriage) {
      const validModalities = ["online", "presencial", "híbrida"];
      const validReasons = [
        "ansiedad", "depresion", "vinculos", "duelo", "autoestima",
        "adicciones", "estres", "laboral", "orientacion_padres",
        "evaluaciones", "discapacidad", "otros",
        "infanto_juvenil", "consulta_general",
      ];
      const finalModality = validModalities.includes(triageModality) ? triageModality : "presencial";
      const finalReason = validReasons.includes(triageReason) ? triageReason : "otros";

      await db.patientRequest.create({
        data: {
          name,
          email,
          phone: phone || null,
          modality: finalModality,
          reason: finalReason,
          notes: patientNotes || null,
          status: "pending",
        },
      });
    }

    // === Enviar email de notificación al admin ===
    // Cuando un paciente se registra desde el formulario de contacto,
    // se le envía un email al admin con todos los datos.
    try {
      const { sendContactNotification } = await import("@/lib/email");
      await sendContactNotification({
        name,
        email,
        phone: phone || null,
        message: `Nuevo paciente registrado desde la web. DNI: ${finalDni || "No cargado"}. Motivo: ${triageReason || "otros"}. Modalidad: ${triageModality || "presencial"}.${patientNotes ? " Mensaje: " + patientNotes : ""}`,
        reason: "solicitar_turno",
        modality: triageModality || "presencial",
        age: age || null,
      });
      console.log(`📧 Notificación de nuevo paciente enviada: ${email}`);
    } catch (emailError) {
      console.error("⚠️ Error enviando notificación de paciente (no bloqueante):", emailError);
    }

    // === Alerta por WhatsApp al admin (await para que Vercel no corte el fire-and-forget) ===
    try {
      await sendAppointmentAlert({
        patientName: name,
        patientPhone: phone || "",
        patientEmail: email,
        modality: triageModality || null,
        reason: triageReason || null,
        notes: patientNotes || null,
        age: age || null,
      });
    } catch (err) {
      console.error("[WhatsApp Alert] Error no bloqueante:", err);
    }

    return NextResponse.json(
      { message: "Cuenta creada exitosamente", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error al crear la cuenta" },
      { status: 500 }
    );
  }
}
