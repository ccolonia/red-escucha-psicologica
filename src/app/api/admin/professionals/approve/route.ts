import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendApprovalEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import crypto from "crypto";

// === POST /api/admin/professionals/approve ===
// Aprueba a un profesional y dispara el email de bienvenida con link
// para setear su contraseña definitiva.
//
// Flujo:
//   1. Validar que el caller sea admin/super_admin
//   2. Buscar el User + verificar que sea rol "professional"
//   3. Marcar isApproved = true en User
//   4. Invalidar la contraseña actual con un hash random seguro
//      (esto evita que el profesional pueda loguearse con la contraseña
//      temporal del registro inicial; solo podrá entrar después de setear
//      la definitiva via el link del email)
//   5. Enviar email de aprobación con el link de set-password
//   6. Devolver respuesta con el nuevo estado del profesional
//
// Body:  { userId: string }
// Resp:  200 → { ok: true, user: { id, name, email, isApproved } }
//        400 → userId faltante o usuario no es profesional
//        401 → no autenticado
//        403 → no es admin
//        404 → usuario no encontrado
//        500 → error

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json(
        { error: "Solo admin/super_admin puede aprobar profesionales" },
        { status: 403 }
      );
    }

    const { userId } = await request.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId es requerido" },
        { status: 400 }
      );
    }

    // === Buscar el usuario ===
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        professional: { select: { id: true, specialty: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (user.role !== "professional") {
      return NextResponse.json(
        { error: "Solo se pueden aprobar usuarios con rol professional" },
        { status: 400 }
      );
    }

    if (!user.professional) {
      return NextResponse.json(
        { error: "El usuario no tiene un registro de profesional asociado" },
        { status: 400 }
      );
    }

    // === Paso 1: marcar isApproved = true ===
    // Esto habilita el flujo de onboarding (email + set-password).
    // passwordSet y hasAccessedPanel siguen en false hasta que el
    // profesional complete su parte del flujo.
    await db.user.update({
      where: { id: userId },
      data: { isApproved: true },
    });

    // === Paso 2: invalidar la contraseña actual ===
    // Reemplazamos la contraseña actual (que probablemente es la
    // autogenerada durante el registro) por un hash aleatorio seguro.
    // Esto garantiza que el profesional NO pueda loguearse con la
    // contraseña vieja — solo podrá entrar después de setear la nueva
    // via el link del email que le mandamos acá.
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const hashedRandomPassword = await hashPassword(randomPassword);
    await db.user.update({
      where: { id: userId },
      data: { password: hashedRandomPassword },
    });

    // === Paso 3: enviar email de aprobación ===
    // El email incluye un link con token que lleva a /set-password.
    // El endpoint /api/auth/set-password valida el token y permite
    // setear la nueva contraseña, momento en el que passwordSet se
    // marcará en true (ver set-password/route.ts).
    try {
      await sendApprovalEmail({
        userEmail: user.email,
        userName: user.name,
        userId: user.id,
      });
      console.log(`📧 Email de aprobación enviado a: ${user.email} (${user.name})`);
    } catch (emailError) {
      // Si el email falla, igual dejamos isApproved=true. El admin
      // puede reintentar el envío desde el panel más tarde.
      console.error("⚠️ Error enviando email de aprobación (no bloqueante):", emailError);
      return NextResponse.json({
        ok: true,
        warning: "Profesional aprobado pero el email no pudo enviarse. Reintentar más tarde.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isApproved: true,
          passwordSet: false,
          hasAccessedPanel: false,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Profesional aprobado. Email de bienvenida enviado.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isApproved: true,
        passwordSet: false,
        hasAccessedPanel: false,
      },
    });
  } catch (error) {
    console.error("Approve professional error:", error);
    return NextResponse.json(
      { error: "Error al aprobar al profesional" },
      { status: 500 }
    );
  }
}
