import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/push/subscribe
// Body: {
//   endpoint: string,
//   keys: { p256dh: string, auth: string },
//   conversationId?: string,  // si es paciente anónimo en una conversación
// }
//
// Si el usuario está autenticado, se vincula la suscripción a su userId.
// Si no, se vincula al conversationId provisto.
//
// Idempotente: si ya existe una suscripción con el mismo endpoint, se actualiza
// (en caso de que el usuario cambie de conversación o se reautentique).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, keys, conversationId } = body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json(
        { error: "endpoint, keys.p256dh y keys.auth son obligatorios" },
        { status: 400 }
      );
    }

    // Intentar obtener userId si el usuario está autenticado (opcional)
    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        userId = (session.user as { id?: string }).id || null;
      }
    } catch {
      // Sin sesión → suscripción anónima vinculada a conversationId
    }

    // Si no hay userId ni conversationId, no podemos vincular la suscripción
    if (!userId && !conversationId) {
      return NextResponse.json(
        { error: "Se requiere conversationId (paciente) o sesión iniciada (admin/profesional)" },
        { status: 400 }
      );
    }

    // User agent para debug (identificar dispositivo/navegador)
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;

    // Upsert: si ya existe una suscripción con este endpoint, actualizarla
    const existing = await db.pushSubscription.findFirst({
      where: { endpoint },
    });

    let subscription;
    if (existing) {
      subscription = await db.pushSubscription.update({
        where: { id: existing.id },
        data: {
          conversationId: conversationId || existing.conversationId,
          userId: userId || existing.userId,
          keys,
          userAgent,
        },
      });
    } else {
      subscription = await db.pushSubscription.create({
        data: {
          endpoint,
          keys,
          conversationId: conversationId || null,
          userId: userId || null,
          userAgent,
        },
      });
    }

    return NextResponse.json({ success: true, id: subscription.id }, { status: 201 });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json({ error: "Error al guardar suscripción" }, { status: 500 });
  }
}

// DELETE /api/push/subscribe
// Body: { endpoint: string }
// Elimina una suscripción (cuando el usuario desactiva notificaciones o se desuscribe)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint es obligatorio" }, { status: 400 });
    }

    await db.pushSubscription.deleteMany({ where: { endpoint } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json({ error: "Error al eliminar suscripción" }, { status: 500 });
  }
}
