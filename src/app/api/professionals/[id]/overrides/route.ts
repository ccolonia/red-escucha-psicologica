import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/professionals/[id]/overrides - Get all overrides for a professional
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = { professionalId: id };
    if (from || to) {
      const dateFilter: Record<string, string> = {};
      if (from) dateFilter.gte = from;
      if (to) dateFilter.lte = to;
      where.date = dateFilter;
    }

    const overrides = await db.scheduleOverride.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(overrides);
  } catch (error) {
    console.error("Get overrides error:", error);
    return NextResponse.json({ error: "Error al obtener excepciones" }, { status: 500 });
  }
}

// POST /api/professionals/[id]/overrides - Create an override
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = (session.user as { role: string }).role;
    if (role !== "professional" && role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { date, type, startTime, endTime, slotDuration, modality, direccionId, reason } = body;

    if (!date || !type) {
      return NextResponse.json(
        { error: "Fecha y tipo son requeridos" },
        { status: 400 }
      );
    }

    if (!["block", "extra"].includes(type)) {
      return NextResponse.json(
        { error: "Tipo debe ser 'block' o 'extra'" },
        { status: 400 }
      );
    }

    if (type === "extra" && (!startTime || !endTime)) {
      return NextResponse.json(
        { error: "Horario de inicio y fin son requeridos para excepciones de tipo 'extra'" },
        { status: 400 }
      );
    }

    // type === "block" puede ser:
    // - Bloqueo de día completo: sin startTime/endTime (null)
    // - Bloqueo parcial de slot: con startTime/endTime (ej: "09:00"-"09:45")

    // === Evitar duplicados en type="extra" ===
    // Si ya existe un override con la misma fecha + startTime + type="extra",
    // no crear otro. Devolver el existente como si fuera nuevo (idempotente).
    if (type === "extra" && startTime) {
      const existing = await db.scheduleOverride.findFirst({
        where: {
          professionalId: id,
          date,
          type: "extra",
          startTime,
        },
      });
      if (existing) {
        // Ya existe — devolver sin crear duplicado
        return NextResponse.json(existing, { status: 200 });
      }
    }

    const override = await db.scheduleOverride.create({
      data: {
        professionalId: id,
        date,
        type,
        startTime: startTime || null,
        endTime: endTime || null,
        slotDuration: type === "extra" ? (slotDuration || 45) : null,
        modality: type === "extra" ? (modality || "ambas") : null,
        // direccionId solo aplica a type="extra" (horario adicional presencial)
        direccionId: type === "extra" ? (direccionId || null) : null,
        reason: reason || null,
      },
    });

    return NextResponse.json(override, { status: 201 });
  } catch (error) {
    console.error("Create override error:", error);
    return NextResponse.json({ error: "Error al crear excepción" }, { status: 500 });
  }
}

// PATCH /api/professionals/[id]/overrides?overrideId=xxx - Update an override
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = (session.user as { role: string }).role;
    if (role !== "professional" && role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const overrideId = searchParams.get("overrideId");

    if (!overrideId) {
      return NextResponse.json(
        { error: "overrideId es requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { date, type, startTime, endTime, slotDuration, modality, direccionId, reason } = body;

    // Verify the override belongs to this professional
    const existing = await db.scheduleOverride.findFirst({
      where: { id: overrideId, professionalId: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Excepción no encontrada" },
        { status: 404 }
      );
    }

    const updateType = type || existing.type;

    if (updateType && !["block", "extra"].includes(updateType)) {
      return NextResponse.json(
        { error: "Tipo debe ser 'block' o 'extra'" },
        { status: 400 }
      );
    }

    if (updateType === "extra" && !startTime && !existing.startTime && !endTime && !existing.endTime) {
      return NextResponse.json(
        { error: "Horario de inicio y fin son requeridos para excepciones de tipo 'extra'" },
        { status: 400 }
      );
    }

    const updated = await db.scheduleOverride.update({
      where: { id: overrideId },
      data: {
        date: date || existing.date,
        type: updateType,
        startTime: updateType === "extra" ? (startTime ?? existing.startTime) : null,
        endTime: updateType === "extra" ? (endTime ?? existing.endTime) : null,
        slotDuration: updateType === "extra" ? (slotDuration ?? existing.slotDuration ?? 45) : null,
        modality: updateType === "extra" ? (modality ?? existing.modality ?? "ambas") : null,
        // direccionId solo aplica a type="extra"
        direccionId: updateType === "extra" ? (direccionId !== undefined ? (direccionId || null) : existing.direccionId) : null,
        reason: reason !== undefined ? (reason || null) : existing.reason,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update override error:", error);
    return NextResponse.json({ error: "Error al actualizar excepción" }, { status: 500 });
  }
}

// DELETE /api/professionals/[id]/overrides?overrideId=xxx
// DELETE /api/professionals/[id]/overrides?date=2026-09-24&startTime=17:00&type=extra
//
// Acepta DOS modos de invocación:
//   1) Por overrideId explícito (modo legacy): ?overrideId=xxx
//   2) Por tupla única [date, startTime, type]: ?date=...&startTime=...&type=extra
//      Esto permite al frontend desactivar un slot "Disponible" sin necesidad
//      de conocer el overrideId persistido — útil cuando el slot visualmente
//      aparece como "available" pero el state local del frontend no tiene el ID
//      (por desync, race condition, o rango de fecha no cubierto por el fetch
//      inicial).
//
// En cualquier modo, si el override NO existe en DB, se devuelve 200 OK con
// { success: true, notFound: true } para que el frontend pueda hacer optimistic
// UI sin tener que manejar un error 404 que no es realmente un error (el slot
// ya está "desactivado" desde el punto de vista funcional).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = (session.user as { role: string }).role;
    if (role !== "professional" && role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const overrideId = searchParams.get("overrideId");
    const date = searchParams.get("date");
    const startTime = searchParams.get("startTime");
    const type = searchParams.get("type") || "extra"; // default "extra" para toggle de disponibles

    // === Validar que tenemos al menos un modo de búsqueda ===
    if (!overrideId && (!date || !startTime)) {
      return NextResponse.json(
        { error: "Se requiere overrideId O (date + startTime)" },
        { status: 400 }
      );
    }

    // === Construir cláusula where según el modo ===
    const where: { professionalId: string; id?: string; date?: string; startTime?: string; type?: string } = {
      professionalId: id,
    };

    if (overrideId) {
      where.id = overrideId;
    } else {
      where.date = date!;
      where.startTime = startTime!;
      where.type = type;
    }

    // === findFirst en vez de delete directo para evitar P2025 ===
    // Si el override no existe (puede pasar si el state local del frontend estaba
    // desactualizado), devolvemos 200 OK con notFound=true para que el frontend
    // pueda hacer optimistic UI sin error.
    const existing = await db.scheduleOverride.findFirst({ where });

    if (!existing) {
      return NextResponse.json({
        success: true,
        notFound: true,
        message: "El override ya no existe en la base de datos (probablemente ya fue desactivado).",
      });
    }

    await db.scheduleOverride.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true, deletedId: existing.id });
  } catch (error) {
    console.error("Delete override error:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el horario. Reintentá en unos momentos." },
      { status: 500 }
    );
  }
}
