import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hashPassword, comparePassword, isHashed } from "@/lib/password";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Contraseña actual y nueva contraseña son obligatorias" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const userId = (session.user as { id: string }).id;

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Secure password comparison using bcrypt (with legacy plaintext support)
    let isValid = false;
    if (isHashed(user.password)) {
      isValid = await comparePassword(currentPassword, user.password);
    } else {
      isValid = user.password === currentPassword;
    }
    if (!isValid) {
      return NextResponse.json(
        { error: "Contraseña actual incorrecta" },
        { status: 400 }
      );
    }

    const hashedNewPassword = await hashPassword(newPassword);

    // === LOG TEMPORAL para diagnosticar por qué la nueva contraseña no funciona ===
    console.log("[change-password] DEBUG:", {
      userId,
      currentPasswordLength: currentPassword.length,
      newPasswordLength: newPassword.length,
      newPasswordFirst3: newPassword.substring(0, 3),
      hashedNewPasswordFirst10: hashedNewPassword.substring(0, 10),
      hashedNewPasswordLength: hashedNewPassword.length,
    });

    await db.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Verificar que se guardó correctamente
    const updatedUser = await db.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    console.log("[change-password] POST-UPDATE:", {
      dbPasswordFirst10: updatedUser?.password.substring(0, 10),
      dbPasswordLength: updatedUser?.password.length,
      matchesHashed: updatedUser?.password === hashedNewPassword,
    });

    return NextResponse.json({ message: "Contraseña actualizada exitosamente" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Error al cambiar la contraseña" },
      { status: 500 }
    );
  }
}
