import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  try {
    const { token, password, confirmPassword } = await request.json();

    // Validate required fields
    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "Token es requerido" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "La contraseña es requerida" },
        { status: 400 }
      );
    }

    if (!confirmPassword || typeof confirmPassword !== "string") {
      return NextResponse.json(
        { error: "La confirmación de contraseña es requerida" },
        { status: 400 }
      );
    }

    // Validate password strength
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

    // Validate passwords match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Las contraseñas no coinciden" },
        { status: 400 }
      );
    }

    // Find the token in the database
    const passwordToken = await db.passwordToken.findUnique({
      where: { token: token.trim() },
      include: { user: true },
    });

    if (!passwordToken) {
      return NextResponse.json(
        { error: "Token inválido o no encontrado" },
        { status: 400 }
      );
    }

    // Check if token was already used
    if (passwordToken.used) {
      return NextResponse.json(
        { error: "Este enlace ya fue utilizado. Solicitá uno nuevo." },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (new Date() > passwordToken.expiresAt) {
      return NextResponse.json(
        { error: "El enlace ha expirado. Solicitá uno nuevo desde la página de inicio de sesión." },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password);

    // Update user password — do NOT set active:true (user is already active)
    await db.user.update({
      where: { id: passwordToken.userId },
      data: {
        password: hashedPassword,
        // Mantener passwordSet=true (ya estaba en true si el usuario
        // había seteado contraseña antes, y este reset cuenta como nueva
        // contraseña definitiva). Si por algún caso edge estaba en false
        // (raro), lo dejamos en true acá porque acaba de setear una nueva.
        passwordSet: true,
      },
    });

    // Mark token as used so it cannot be reused
    await db.passwordToken.update({
      where: { id: passwordToken.id },
      data: { used: true },
    });

    console.log(`[reset-password] Password reset successful for user: ${passwordToken.user.email}`);

    return NextResponse.json({
      message: "Contraseña restablecida exitosamente",
    });
  } catch (error) {
    console.error("[reset-password] Error:", error);
    return NextResponse.json(
      { error: "Error al restablecer la contraseña. Intentá de nuevo." },
      { status: 500 }
    );
  }
}

// GET: Validate reset token (check if it's valid without resetting)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ valid: false, error: "Token requerido" });
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
    console.error("[reset-password] Token validation error:", error);
    return NextResponse.json({ valid: false, error: "Error del servidor" });
  }
}
