import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token y contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres, una mayúscula y un símbolo" },
        { status: 400 }
      );
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json(
        { error: "La contraseña debe incluir al menos una letra mayúscula" },
        { status: 400 }
      );
    }
    if (!/[!@#$%^&*(),.?":{}|<>_+\-=]/.test(password)) {
      return NextResponse.json(
        { error: "La contraseña debe incluir al menos un símbolo (!, $, #, etc.)" },
        { status: 400 }
      );
    }

    // Find the token
    const passwordToken = await db.passwordToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!passwordToken) {
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 400 }
      );
    }

    // Check if token already used
    if (passwordToken.used) {
      return NextResponse.json(
        { error: "Este enlace ya fue utilizado" },
        { status: 400 }
      );
    }

    // Check if token expired
    if (new Date() > passwordToken.expiresAt) {
      return NextResponse.json(
        { error: "El enlace ha expirado. Contactá al administrador para obtener uno nuevo." },
        { status: 400 }
      );
    }

    // Update user password (hashed) and activate account
    const hashedPassword = await hashPassword(password);
    await db.user.update({
      where: { id: passwordToken.userId },
      data: {
        password: hashedPassword,
        active: true,
        // === Marcar que el profesional ya seteó su contraseña definitiva ===
        // Esto permite al admin ver en el panel quién completó el onboarding
        // y quién todavía tiene pendiente setear su contraseña. Aplica a
        // cualquier rol (admin/professional/patient) — es una bandera de
        // estado del usuario, no específica del profesional.
        passwordSet: true,
      },
    });

    // Mark token as used
    await db.passwordToken.update({
      where: { id: passwordToken.id },
      data: { used: true },
    });

    return NextResponse.json({ message: "Contraseña establecida exitosamente" });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json(
      { error: "Error al establecer la contraseña" },
      { status: 500 }
    );
  }
}

// GET: Validate token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const passwordToken = await db.passwordToken.findUnique({
      where: { token },
    });

    if (!passwordToken) {
      return NextResponse.json({ valid: false, error: "Token inválido" });
    }

    if (passwordToken.used) {
      return NextResponse.json({ valid: false, error: "Este enlace ya fue utilizado" });
    }

    if (new Date() > passwordToken.expiresAt) {
      return NextResponse.json({ valid: false, error: "El enlace ha expirado" });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
