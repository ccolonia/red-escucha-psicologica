import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendBajaNotificationEmail } from "@/lib/email";

// ============================================================================
// POST /api/professionals/[id]/baja
//
// Procesa la baja institucional de un profesional:
//   1. Verifica que sea admin/super_admin
//   2. Marca al User como inactivo (active=false) y no aprobado (isApproved=false)
//   3. Marca al Professional como no disponible (available=false)
//   4. Envía email institucional de agradecimiento y notificación de baja
//   5. Retorna confirmación
//
// El envío de email está aislado en try/catch independiente: si el servicio
// de mail falla (Resend no configurado, sin credenciales, etc.), NO se tumba
// el endpoint. La baja en la DB se completa igual y se reporta el warning.
//
// ⚠️ Next.js 16: params es Promise — hay que hacer `await params`.
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Auth check — solo admin/super_admin puede dar de baja
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }
    const userRole = (session.user as { role: string }).role;
    if (userRole !== "admin" && userRole !== "super_admin") {
      return NextResponse.json(
        { error: "Solo un administrador puede procesar bajas profesionales" },
        { status: 403 }
      );
    }

    // Next.js 16: params es una Promise, hay que await
    const { id: professionalId } = await params;

    // 2. Buscar al profesional con su user (necesitamos el email)
    const professional = await db.professional.findUnique({
      where: { id: professionalId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            active: true,
            isApproved: true,
          },
        },
      },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    if (!professional.user) {
      return NextResponse.json(
        { error: "El profesional no tiene usuario asociado" },
        { status: 404 }
      );
    }

    const { user } = professional;
    const professionalName = user.name || "Profesional";
    const professionalEmail = user.email;

    // 3. === Envío de email institucional (TRY/CATCH INDEPENDIENTE) ===
    // Si el servicio de mail falla (Resend no configurado, sin credenciales,
    // error de red, etc.), NO se tumba el endpoint. La baja en la DB se
    // completa igual y se reporta el warning al frontend.
    let emailSent = false;
    let emailWarning: string | null = null;
    try {
      const emailResult = await sendBajaNotificationEmail({
        professionalEmail,
        professionalName,
      });
      if (emailResult.error) {
        console.error(
          `[Baja Professional] Email falló para ${professionalEmail}:`,
          emailResult.error
        );
        emailWarning = "El email de notificación no pudo enviarse, pero la baja se procesó igualmente.";
      } else {
        emailSent = true;
        console.log(
          `[Baja Professional] ✅ Email enviado a ${professionalEmail} (id: ${emailResult.data?.id || "n/a"})`
        );
      }
    } catch (emailErr) {
      // Aislado: el error de email NO propaga al try/catch externo
      console.error("[BAJA EMAIL ERROR] No se pudo enviar el correo:", emailErr);
      emailWarning = "Hubo un error al enviar el email de notificación, pero la baja se procesó igualmente.";
    }

    // 4. Marcar al profesional como no disponible (available=false)
    await db.professional.update({
      where: { id: professionalId },
      data: {
        available: false,
      },
    });

    // 5. Desactivar al User (active=false + isApproved=false)
    // Esto le impide iniciar sesión. NO borramos al user para preservar
    // el histórico de turnos y auditoría.
    await db.user.update({
      where: { id: user.id },
      data: {
        active: false,
        isApproved: false,
      },
    });

    console.log(
      `[Baja Professional] ✅ Baja procesada: ${professionalName} (${professionalEmail}) | Professional: ${professionalId} | User: ${user.id}`
    );

    // 6. Retornar confirmación
    return NextResponse.json({
      success: true,
      message: "Baja procesada con éxito",
      professional: {
        id: professionalId,
        name: professionalName,
        email: professionalEmail,
      },
      emailSent,
      emailWarning,
    });
  } catch (error) {
    console.error("[Baja Professional] Error:", error);
    return NextResponse.json(
      { error: "Error al procesar la baja del profesional" },
      { status: 500 }
    );
  }
}
