import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// === Utilidades de auth ===
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }), session: null };
  const role = (session.user as { role: string }).role;
  if (role !== "admin" && role !== "super_admin") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

// GET /api/chat
// - Admin: lista todas las conversaciones (con último mensaje + count no leídos)
// - Público (sin auth): lista UNA conversación por ?conversationId=xxx (para que el paciente vea su hilo)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    // Caso público: paciente pidiendo su propia conversación
    if (conversationId) {
      const conv = await db.chatConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!conv) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      return NextResponse.json(conv);
    }

    // Caso admin: listar todas las conversaciones
    const { error } = await requireAdmin();
    if (error) return error;

    const conversations = await db.chatConversation.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // último mensaje para preview
        },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Chat GET error:", error);
    return NextResponse.json({ error: "Error al obtener conversaciones" }, { status: 500 });
  }
}

// POST /api/chat
// Body: { action: "start" | "send" | "admin-send", conversationId?, patientName, patientPhone, patientEmail?, text }
// - action="start": crea conversación + primer mensaje (paciente)
// - action="send": agrega mensaje a conversación existente (paciente)
// - action="admin-send": admin envía mensaje a conversación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // === INICIAR conversación (público) ===
    if (action === "start") {
      const { patientName, patientPhone, patientEmail, text } = body;
      if (!patientName || !patientPhone || !text) {
        return NextResponse.json({ error: "Nombre, teléfono y mensaje son obligatorios" }, { status: 400 });
      }
      const conv = await db.chatConversation.create({
        data: {
          patientName: String(patientName).slice(0, 120),
          patientPhone: String(patientPhone).slice(0, 60),
          patientEmail: patientEmail ? String(patientEmail).slice(0, 200) : null,
          unreadAdmin: true,
          unreadUser: false,
          messages: {
            create: {
              sender: "PATIENT",
              text: String(text).slice(0, 4000),
            },
          },
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      return NextResponse.json(conv, { status: 201 });
    }

    // === ENVIAR mensaje como paciente (público) ===
    if (action === "send") {
      const { conversationId, text } = body;
      if (!conversationId || !text) {
        return NextResponse.json({ error: "conversationId y text son obligatorios" }, { status: 400 });
      }
      const conv = await db.chatConversation.findUnique({ where: { id: conversationId } });
      if (!conv) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      if (conv.status === "CLOSED") {
        return NextResponse.json({ error: "Conversación cerrada" }, { status: 400 });
      }
      const msg = await db.chatMessage.create({
        data: {
          conversationId,
          sender: "PATIENT",
          text: String(text).slice(0, 4000),
        },
      });
      await db.chatConversation.update({
        where: { id: conversationId },
        data: { unreadAdmin: true, updatedAt: new Date() },
      });
      return NextResponse.json(msg, { status: 201 });
    }

    // === ENVIAR mensaje como ADMIN (auth requerida) ===
    if (action === "admin-send") {
      const { error } = await requireAdmin();
      if (error) return error;

      const { conversationId, text } = body;
      if (!conversationId || !text) {
        return NextResponse.json({ error: "conversationId y text son obligatorios" }, { status: 400 });
      }
      const conv = await db.chatConversation.findUnique({ where: { id: conversationId } });
      if (!conv) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });

      const msg = await db.chatMessage.create({
        data: {
          conversationId,
          sender: "ADMIN",
          text: String(text).slice(0, 4000),
        },
      });
      await db.chatConversation.update({
        where: { id: conversationId },
        data: { unreadUser: true, unreadAdmin: false, updatedAt: new Date() },
      });
      return NextResponse.json(msg, { status: 201 });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Chat POST error:", error);
    return NextResponse.json({ error: "Error al procesar mensaje" }, { status: 500 });
  }
}

// PATCH /api/chat
// Body: { conversationId, action: "mark-admin-read" | "mark-user-read" | "close" | "reopen" }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, action } = body;
    if (!conversationId || !action) {
      return NextResponse.json({ error: "conversationId y action son obligatorios" }, { status: 400 });
    }

    if (action === "mark-admin-read") {
      const { error } = await requireAdmin();
      if (error) return error;
      await db.chatConversation.update({
        where: { id: conversationId },
        data: { unreadAdmin: false },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "mark-user-read") {
      // Público: el paciente marcó sus mensajes como leídos
      await db.chatConversation.update({
        where: { id: conversationId },
        data: { unreadUser: false },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "close" || action === "reopen") {
      const { error } = await requireAdmin();
      if (error) return error;
      await db.chatConversation.update({
        where: { id: conversationId },
        data: { status: action === "close" ? "CLOSED" : "ACTIVE" },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Chat PATCH error:", error);
    return NextResponse.json({ error: "Error al actualizar conversación" }, { status: 500 });
  }
}
