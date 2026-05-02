import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, password, role, license, specialty, bio } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nombre, email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este email" },
        { status: 409 }
      );
    }

    // If role is "professional", verify admin session
    if (role === "professional") {
      const session = await getServerSession(authOptions);
      if (!session?.user || (session.user as { role: string }).role !== "admin") {
        return NextResponse.json(
          { error: "No autorizado para crear profesionales" },
          { status: 403 }
        );
      }

      if (!license || !specialty) {
        return NextResponse.json(
          { error: "Licencia y especialidad son obligatorias para profesionales" },
          { status: 400 }
        );
      }

      // Check if license already exists
      const existingLicense = await db.professional.findUnique({
        where: { license },
      });

      if (existingLicense) {
        return NextResponse.json(
          { error: "Ya existe un profesional con esta licencia" },
          { status: 409 }
        );
      }

      const user = await db.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          password, // In production, hash with bcrypt
          role: "professional",
        },
      });

      await db.professional.create({
        data: {
          userId: user.id,
          license,
          specialty,
          bio: bio || null,
        },
      });

      return NextResponse.json(
        { message: "Profesional creado exitosamente", userId: user.id },
        { status: 201 }
      );
    }

    // Default: create patient (no session check needed for self-registration)
    const user = await db.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password, // In production, hash with bcrypt
        role: "patient",
      },
    });

    await db.patient.create({
      data: {
        userId: user.id,
      },
    });

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
