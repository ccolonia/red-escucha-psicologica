import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfWeek, addDays, format } from "date-fns";

// POST /api/professionals/[id]/schedule/copy
//
// Acciones masivas sobre la agenda semanal del profesional:
//
// Acción A — copy-day:
//   Body: { action: "copy-day", fromDay: number, toDay: number }
//   Copia TODOS los bloques de ProfessionalSchedule del fromDay al toDay.
//   Borra los bloques existentes del toDay antes de clonar (evita solapamientos).
//   Transaccional: si algo falla, rollback.
//
// Acción B — duplicate-template:
//   Body: { action: "duplicate-template" }
//   Clona la estructura base (ProfessionalSchedule) hacia ScheduleOverride
//   tipo "extra" para la próxima semana calendario (Lun-Dom).
//   Esto deja los días pre-configurados explícitamente y blinda la
//   disponibilidad a futuro.
//
// Auth: el profesional puede operar su propia agenda, o admin/super_admin
// puede operar la de cualquiera.

const ARG_TZ = "America/Argentina/Buenos_Aires";

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
    const userId = (session.user as { id: string }).id;
    const { id: professionalId } = await params;
    const body = await request.json();
    const { action } = body;

    // === Verificar permisos ===
    // El profesional puede operar su propia agenda, o admin/super_admin
    if (role !== "admin" && role !== "super_admin") {
      const ownProf = await db.professional.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!ownProf || ownProf.id !== professionalId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    // === Verificar que el profesional existe ===
    const professional = await db.professional.findUnique({
      where: { id: professionalId },
    });
    if (!professional) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    // ================================================================
    // ACCIÓN A: copy-day
    // ================================================================
    if (action === "copy-day") {
      const { fromDay, toDay } = body;

      // Validar días (0-6)
      if (fromDay == null || toDay == null || fromDay === toDay) {
        return NextResponse.json(
          { error: "fromDay y toDay son obligatorios y deben ser distintos" },
          { status: 400 }
        );
      }
      if (![0, 1, 2, 3, 4, 5, 6].includes(fromDay) || ![0, 1, 2, 3, 4, 5, 6].includes(toDay)) {
        return NextResponse.json(
          { error: "fromDay y toDay deben ser enteros entre 0 y 6" },
          { status: 400 }
        );
      }

      const result = await db.$transaction(async (tx) => {
        // 1. Leer bloques del fromDay
        const sourceBlocks = await tx.professionalSchedule.findMany({
          where: { professionalId, dayOfWeek: fromDay },
        });

        if (sourceBlocks.length === 0) {
          throw new Error(`No hay bloques horarios configurados para el día origen (dayOfWeek=${fromDay})`);
        }

        // 2. Borrar bloques existentes del toDay
        const deleted = await tx.professionalSchedule.deleteMany({
          where: { professionalId, dayOfWeek: toDay },
        });

        // 3. Clonar bloques del fromDay al toDay
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const created: any[] = [];
        for (const block of sourceBlocks) {
          const newBlock = await tx.professionalSchedule.create({
            data: {
              professionalId,
              dayOfWeek: toDay,
              startTime: block.startTime,
              endTime: block.endTime,
              slotDuration: block.slotDuration,
              modality: block.modality,
            },
          });
          created.push(newBlock);
        }

        return { deleted: deleted.count, created: created.length, sourceBlocks: sourceBlocks.length };
      });

      return NextResponse.json({
        success: true,
        action: "copy-day",
        message: `${result.created} bloque(s) copiado(s) correctamente`,
        ...result,
      });
    }

    // ================================================================
    // ACCIÓN B: duplicate-template
    // ================================================================
    if (action === "duplicate-template") {
      // Calcular la próxima semana calendario (Lun-Dom)
      const now = new Date();
      const todayStr = now.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
      const today = new Date(todayStr + "T12:00:00");
      const nextMonday = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
      const nextSunday = addDays(nextMonday, 6);

      // Generar 7 fechas ISO de la próxima semana
      const weekDates: { date: string; dayOfWeek: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(nextMonday, i);
        const isoDate = format(d, "yyyy-MM-dd");
        const dow = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getDay();
        weekDates.push({ date: isoDate, dayOfWeek: dow });
      }

      const result = await db.$transaction(async (tx) => {
        // 1. Leer TODOS los bloques base del profesional (los 7 días)
        const allBlocks = await tx.professionalSchedule.findMany({
          where: { professionalId },
        });

        if (allBlocks.length === 0) {
          throw new Error("No hay bloques horarios configurados en la plantilla base");
        }

        // 2. Borrar ScheduleOverride tipo "extra" existentes para la próxima semana
        // (para no duplicar si el admin corre la acción 2 veces)
        const deleted = await tx.scheduleOverride.deleteMany({
          where: {
            professionalId,
            date: { in: weekDates.map((w) => w.date) },
            type: "extra",
            reason: "Plantilla semanal replicada",
          },
        });

        // 3. Crear ScheduleOverride tipo "extra" por cada bloque base
        let created = 0;
        for (const { date, dayOfWeek } of weekDates) {
          const dayBlocks = allBlocks.filter((b) => b.dayOfWeek === dayOfWeek);
          for (const block of dayBlocks) {
            await tx.scheduleOverride.create({
              data: {
                professionalId,
                date,
                type: "extra",
                startTime: block.startTime,
                endTime: block.endTime,
                slotDuration: block.slotDuration,
                modality: block.modality,
                reason: "Plantilla semanal replicada",
              },
            });
            created++;
          }
        }

        return {
          deleted: deleted.count,
          created,
          weekRange: { start: weekDates[0].date, end: weekDates[6].date },
        };
      });

      return NextResponse.json({
        success: true,
        action: "duplicate-template",
        message: `Plantilla replicada para la semana ${result.weekRange.start} → ${result.weekRange.end}. ${result.created} bloques creados.`,
        ...result,
      });
    }

    // Acción no reconocida
    return NextResponse.json(
      { error: `Acción no válida: "${action}". Usá "copy-day" o "duplicate-template".` },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error en acción masiva";
    console.error("Error in schedule/copy:", error);

    // Errores de validación → 400
    if (message.includes("No hay bloques") || message.includes("obligatorios")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
