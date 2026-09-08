import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendApprovalEmail } from "@/lib/email";

// ============================================================================
// POST /api/admin/professionals/resend-access-email
//
// Reenvía el correo de "Establecer contraseña" a un profesional cuyo enlace
// anterior haya expirado (los tokens expiran a las 48hs).
//
// Genera un NUEVO token de reseteo con 48hs de validez y dispara el email
// oficial de aprobación/acceso con la URL correspondiente.
//
// Payload:
//   { professionalId: string }  o  { userId: string }
//
// Respuesta:
//   200 → { success: true, message: "...", email: "..." }
//   400 → { error: "Falta professionalId o userId" }
//   403 → { error: "Solo administradores pueden reenviar emails de acceso" }
//   404 → { error: "Profesional o usuario no encontrado" }
//   500 → { error: "Error al enviar el email" }
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // === Auth check — solo admin/super_admin ===
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden reenviar emails de acceso" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { professionalId, userId } = body;

    if (!professionalId && !userId) {
      return NextResponse.json(
        { error: "Se requiere professionalId o userId" },
        { status: 400 }
      );
    }

    // === Buscar al usuario ===
    let user: { id: string; email: string; name: string; role: string; active: boolean } | null = null;

    if (professionalId) {
      const prof = await db.professional.findUnique({
        where: { id: professionalId },
        include: { user: { select: { id: true, email: true, name: true, role: true, active: true } } },
      });
      if (!prof) {
        return NextResponse.json(
          { error: "Profesional no encontrado" },
          { status: 404 }
        );
      }
      user = prof.user;
    } else if (userId) {
      user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, role: true, active: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // === Invalidar tokens anteriores no usados ===
    // Para que no queden múltiples links activos simultáneamente
    await db.passwordToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: { used: true },
    });

    // === Generar nuevo token + enviar email ===
    // sendApprovalEmail ya hace todo:
    //   1. Genera token con crypto.randomBytes(32).toString("hex")
    //   2. Guarda en PasswordToken con expiración de 48hs
    //   3. Envía email con la URL /set-password?token=...
    //   4. Lanza error si falla el envío
    try {
      await sendApprovalEmail({
        userEmail: user.email,
        userName: user.name,
        userId: user.id,
      });
    } catch (emailErr) {
      console.error("[resend-access-email] Error enviando email:", emailErr);
      return NextResponse.json(
        { error: "No se pudo enviar el email de acceso. Verificá la configuración de Resend." },
        { status: 500 }
      );
    }

    console.log(`[resend-access-email] ✅ Email reenviado a ${user.email} (userId: ${user.id})`);

    return NextResponse.json({
      success: true,
      message: `Correo de acceso reenviado a ${user.email}`,
      email: user.email,
    });
  } catch (error) {
    console.error("[resend-access-email] Error:", error);
    return NextResponse.json(
      { error: "Error al reenviar el email de acceso" },
      { status: 500 }
    );
  }
}
