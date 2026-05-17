import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, email, phone, password, role, license, specialty, bio,
      title, cuil, gender, therapyTypes, targetAudience, therapyModality,
      onlineAttention, presentialAttention, homeAttention, zones,
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

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este email" },
        { status: 409 }
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

      // Check if license already exists
      const existingLicense = await db.professional.findUnique({
        where: { license },
      });

      if (existingLicense) {
        return NextResponse.json(
          { error: "Ya existe un profesional con esta matrícula" },
          { status: 409 }
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

      await db.professional.create({
        data: {
          userId: user.id,
          license,
          specialty,
          bio: bio || null,
          title: title || null,
          profession: body.profession || null,
          cuil: cuil || null,
          gender: gender || null,
          therapyTypes: therapyTypes ? JSON.stringify(therapyTypes) : null,
          targetAudience: targetAudience ? JSON.stringify(targetAudience) : null,
          therapyModality: therapyModality ? JSON.stringify(therapyModality) : null,
          onlineAttention: onlineAttention ?? false,
          presentialAttention: presentialAttention ?? false,
          homeAttention: homeAttention ?? false,
          zones: zones ? JSON.stringify(zones) : null,
        },
      });

      const message = isAdmin
        ? "Profesional creado exitosamente"
        : "Tu registro fue enviado exitosamente. Un administrador lo revisará y activará tu cuenta.";

      return NextResponse.json(
        { message, userId: user.id },
        { status: 201 }
      );
    }

    // Default: create patient (no session check needed for self-registration)
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
