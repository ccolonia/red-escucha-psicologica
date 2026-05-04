import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token y contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
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

    // Update user password and activate account
    await db.user.update({
      where: { id: passwordToken.userId },
      data: {
        password,
        active: true,
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
