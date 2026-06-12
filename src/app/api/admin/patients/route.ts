import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

// POST /api/admin/patients — Admin manually creates a patient
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
    const { name, email, phone, password, dateOfBirth, emergencyContact, notes } = body;

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

    // Create User + Patient in a transaction
    const patient = await db.$transaction(async (tx) => {
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

      return newPatient;
    });

    return NextResponse.json(patient, { status: 201 });
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
