import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

// POST /api/admin/set-user-password
// Body: { email: string, password: string }
//
// Fuerza el cambio de contraseña de cualquier usuario.
// Solo admin/super_admin puede ejecutar esta acción.
// No requiere token (a diferencia de /api/auth/set-password que es público
// y requiere token de reseteo).
//
// El password se hashea con bcrypt (12 salt rounds) antes de guardarse.

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "email y password son obligatorios" },
        { status: 400 }
      );
    }

    // Validación mínima de contraseña (más permisiva que set-password público
    // porque el admin está forzando el cambio — no pedimos mayúscula/símbolo)
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Buscar usuario por email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Hashear y guardar
    const hashedPassword = await hashPassword(password);
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        active: true,
        passwordSet: true,
        // Resetear tokenVersion para invalidar sesiones previas (forzar re-login)
        // No tocamos tokenVersion para no romper la sesión del admin actual
        // si se está cambiando su propia contraseña.
      },
    });

    return NextResponse.json({
      message: `Contraseña actualizada para ${user.email}`,
      userId: user.id,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("Admin set-user-password error:", error);
    return NextResponse.json(
      { error: "Error al cambiar contraseña: " + (error as Error).message },
      { status: 500 }
    );
  }
}
