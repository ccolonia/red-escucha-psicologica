import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

// POST /api/admin/patients — Admin manually creates a patient
// Optional: enableTriage=true also creates a PatientRequest (Triage entry)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      password,
      dateOfBirth,
      emergencyContact,
      notes,
      enableTriage,
      modality,
      reason,
    } = body;

    // Basic validations
    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    if (!email?.trim() || !email.includes("@")) {
      return NextResponse.json({ error: "El email es obligatorio y debe ser válido" }, { status: 400 });
    }

    // Check for duplicate email
    const existingUser = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    // Generate a random password if not provided
    const finalPassword = password?.trim() || Math.random().toString(36).slice(-10) + "A1!";
    const hashedPassword = await hashPassword(finalPassword);

    // Determine if we need to create a triage request
    const shouldEnableTriage = enableTriage === true;

    // Create User + Patient (+ PatientRequest if triage) in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          password: hashedPassword,
          role: "patient",
          active: true,
        },
      });

      // 2. Create Patient
      const newPatient = await tx.patient.create({
        data: {
          userId: user.id,
          dateOfBirth: dateOfBirth?.trim() || null,
          emergencyContact: emergencyContact?.trim() || null,
          notes: notes?.trim() || null,
        },
        include: {
          user: { select: { name: true, email: true, phone: true, active: true, createdAt: true } },
        },
      });

      // 3. If enableTriage, create PatientRequest for the Triage queue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let patientRequest: any = null;
      if (shouldEnableTriage) {
        const validModalities = ["online", "presencial", "híbrida"];
        const validReasons = [
          "ansiedad", "vinculos", "depresion", "duelo", "autoestima",
          "estres", "infanto_juvenil", "adiciones", "consulta_general",
        ];

        const triageModality = validModalities.includes(modality) ? modality : "presencial";
        const triageReason = validReasons.includes(reason) ? reason : "consulta_general";

        patientRequest = await tx.patientRequest.create({
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
      }

      return { patient: newPatient, patientRequest };
    });

    // Return appropriate response message
    const message = shouldEnableTriage
      ? "Paciente creado con éxito e ingresado al sistema de Triage"
      : "Paciente creado con éxito";

    return NextResponse.json(
      { ...result, message },
      { status: 201 }
    );
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: unknown; message?: string };
    console.error("Error en Prisma al crear paciente:", {
      code: prismaError.code,
      meta: prismaError.meta,
      message: prismaError.message,
    });
    return NextResponse.json(
      { error: "Error al crear paciente", detail: prismaError.code || "unknown" },
      { status: 500 }
    );
  }
}
