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
    const { date, type, startTime, endTime, slotDuration, modality, reason } = body;

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

    const override = await db.scheduleOverride.create({
      data: {
        professionalId: id,
        date,
        type,
        startTime: type === "extra" ? startTime : null,
        endTime: type === "extra" ? endTime : null,
        slotDuration: type === "extra" ? (slotDuration || 45) : null,
        modality: type === "extra" ? (modality || "ambas") : null,
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
    const { date, type, startTime, endTime, slotDuration, modality, reason } = body;

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
export async function DELETE(
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
    const overrideId = searchParams.get("overrideId");

    if (!overrideId) {
      return NextResponse.json(
        { error: "overrideId es requerido" },
        { status: 400 }
      );
    }

    await db.scheduleOverride.delete({
      where: { id: overrideId, professionalId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete override error:", error);
    return NextResponse.json({ error: "Error al eliminar excepción" }, { status: 500 });
  }
}
