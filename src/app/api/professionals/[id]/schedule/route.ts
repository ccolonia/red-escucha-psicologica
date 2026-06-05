import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/professionals/[id]/schedule - Get professional's weekly schedule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  unstable_noStore();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const schedules = await db.professionalSchedule.findMany({
      where: { professionalId: id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Get schedule error:", error);
    return NextResponse.json({ error: "Error al obtener agenda" }, { status: 500 });
  }
}

// POST /api/professionals/[id]/schedule - Create a schedule entry
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
    const { dayOfWeek, startTime, endTime, slotDuration, modality } = body;

    if (!dayOfWeek || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Día, hora inicio y hora fin son requeridos" },
        { status: 400 }
      );
    }

    if (dayOfWeek < 1 || dayOfWeek > 6) {
      return NextResponse.json(
        { error: "Día de la semana inválido (1=Lun, 6=Sab)" },
        { status: 400 }
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "La hora de inicio debe ser anterior a la hora de fin" },
        { status: 400 }
      );
    }

    const schedule = await db.professionalSchedule.create({
      data: {
        professionalId: id,
        dayOfWeek,
        startTime,
        endTime,
        slotDuration: slotDuration || 45,
        modality: modality || "ambas",
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error: unknown) {
    console.error("Create schedule error:", error);
    // Handle unique constraint violation
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un horario para ese día y hora de inicio" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Error al crear horario" }, { status: 500 });
  }
}

// PUT /api/professionals/[id]/schedule - Bulk update (replace all schedules)
export async function PUT(
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
    const { schedules } = body as {
      schedules: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        slotDuration: number;
        modality: string;
      }>;
    };

    if (!Array.isArray(schedules)) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }

    // Validate all entries
    for (const s of schedules) {
      if (!s.dayOfWeek || !s.startTime || !s.endTime) {
        return NextResponse.json(
          { error: "Cada horario debe tener día, hora inicio y hora fin" },
          { status: 400 }
        );
      }
      if (s.dayOfWeek < 1 || s.dayOfWeek > 6) {
        return NextResponse.json(
          { error: "Día de la semana inválido" },
          { status: 400 }
        );
      }
      if (s.startTime >= s.endTime) {
        return NextResponse.json(
          { error: "La hora de inicio debe ser anterior a la hora de fin" },
          { status: 400 }
        );
      }
    }

    // Delete existing and create new in a transaction
    await db.$transaction([
      db.professionalSchedule.deleteMany({ where: { professionalId: id } }),
      ...schedules.map((s) =>
        db.professionalSchedule.create({
          data: {
            professionalId: id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            slotDuration: s.slotDuration || 45,
            modality: s.modality || "ambas",
          },
        })
      ),
    ]);

    const result = await db.professionalSchedule.findMany({
      where: { professionalId: id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Bulk update schedule error:", error);
    return NextResponse.json({ error: "Error al actualizar agenda" }, { status: 500 });
  }
}

// DELETE /api/professionals/[id]/schedule?scheduleId=xxx
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
    const scheduleId = searchParams.get("scheduleId");

    if (!scheduleId) {
      return NextResponse.json(
        { error: "scheduleId es requerido" },
        { status: 400 }
      );
    }

    await db.professionalSchedule.delete({
      where: { id: scheduleId, professionalId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete schedule error:", error);
    return NextResponse.json({ error: "Error al eliminar horario" }, { status: 500 });
  }
}
