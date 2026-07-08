import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { db } from "@/lib/db";

// GET /api/professionals/[id]/next-available-slot
//
// Busca el primer slot disponible del profesional en los próximos 14 días
// (excluye domingos y fechas pasadas). Útil para el botón "Primer turno
// disponible" del Triage — evita que el frontend tenga que llamar al
// endpoint de slots 14 veces para encontrar la primera fecha con hueco.
//
// Response:
//   200 + { date, time, endTime, modality, duration }  → primer slot hallado
//   200 + { date: null, ... }                          → no hay slots en 14 días
//   400/404/500                                        → errores
//
// Lógica:
//   - Itera los próximos 14 días (incluyendo hoy si todavía hay horario)
//   - Skip domingos (dayOfWeek === 0)
//   - Para cada día, replica la lógica del endpoint /slots: genera slots
//     desde ProfessionalSchedule, aplica ScheduleOverrides, filtra booked
//     y filtra past times si es hoy
//   - Devuelve el primer slot encontrado (ordenado por fecha, luego hora)
//   - Si ningún día tiene slots → { date: null }
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  unstable_noStore();

  try {
    const { id } = await params;

    const professional = await db.professional.findUnique({
      where: { id },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    if (!professional.available) {
      return NextResponse.json({ date: null });
    }

    const ARG_TZ = "America/Argentina/Buenos_Aires";
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
    const nowArgTime = new Date().toLocaleTimeString("en-GB", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit" });

    // Helpers (duplicados del endpoint /slots — refactor futuro: mover a lib)
    const timeToMinutes = (t: string): number => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const minutesToTime = (m: number): string => {
      const hours = Math.floor(m / 60);
      const minutes = m % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    };
    const generateSlots = (startTime: string, endTime: string, duration: number): string[] => {
      const slots: string[] = [];
      let currentMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      if (currentMinutes >= endMinutes) return [];
      while (currentMinutes + duration <= endMinutes) {
        slots.push(minutesToTime(currentMinutes));
        currentMinutes += duration;
      }
      return slots;
    };

    // Iterar los próximos 14 días
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      // Skip domingos
      if (d.getDay() === 0) continue;

      const dateStr = d.toLocaleDateString("sv-SE");
      // Skip si por alguna razón es anterior a hoy (defensivo)
      if (dateStr < todayStr) continue;

      const [year, month, day] = dateStr.split("-").map(Number);
      const dayOfWeekJS = new Date(year, month - 1, day).getDay(); // 0=Dom..6=Sab
      const dayOfWeek = dayOfWeekJS; // 1=Lun..6=Sab (0 ya skippeado)

      // 1. Schedules del profesional para este día
      const schedules = await db.professionalSchedule.findMany({
        where: { professionalId: id, dayOfWeek },
        orderBy: { startTime: "asc" },
      });

      if (schedules.length === 0) continue; // no trabaja este día

      // 2. Overrides para esta fecha
      const overrides = await db.scheduleOverride.findMany({
        where: { professionalId: id, date: dateStr },
      });

      const blockOverrides = overrides.filter((o) => o.type === "block");
      const extraOverrides = overrides.filter((o) => o.type === "extra");

      // Full-day block → skip este día
      const fullDayBlock = blockOverrides.some((o) => !o.startTime && !o.endTime);
      if (fullDayBlock) continue;

      // 3. Generar slots base desde schedules
      const allSlots: Array<{ time: string; endTime: string; modality: string; duration: number }> = [];
      for (const schedule of schedules) {
        const slots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotDuration);
        for (const time of slots) {
          const slotStartMin = timeToMinutes(time);
          const slotEndMin = slotStartMin + schedule.slotDuration;
          const endMin = timeToMinutes(schedule.endTime);
          if (slotStartMin >= endMin || slotEndMin > endMin) continue;

          const isBlocked = blockOverrides.some((block) => {
            if (block.startTime && block.endTime) {
              return time >= block.startTime && time < block.endTime;
            }
            return false;
          });
          if (!isBlocked) {
            allSlots.push({ time, endTime: minutesToTime(slotEndMin), modality: schedule.modality, duration: schedule.slotDuration });
          }
        }
      }

      // 4. Agregar extra overrides
      for (const extra of extraOverrides) {
        if (extra.startTime && extra.endTime) {
          const duration = extra.slotDuration || 45;
          const slots = generateSlots(extra.startTime, extra.endTime, duration);
          for (const time of slots) {
            const slotStartMin = timeToMinutes(time);
            const slotEndMin = slotStartMin + duration;
            const endMin = timeToMinutes(extra.endTime);
            if (slotStartMin >= endMin || slotEndMin > endMin) continue;
            if (!allSlots.find((s) => s.time === time)) {
              allSlots.push({ time, endTime: minutesToTime(slotEndMin), modality: extra.modality || "ambas", duration });
            }
          }
        }
      }

      if (allSlots.length === 0) continue;

      // 5. Filtrar booked
      const existingAppointments = await db.appointment.findMany({
        where: {
          professionalId: id,
          date: dateStr,
          status: { in: ["pending", "confirmed"] },
        },
        select: { time: true },
      });
      const bookedTimes = new Set(existingAppointments.map((a) => a.time));

      // 6. Filtrar past times si es hoy
      const isToday = dateStr === todayStr;

      const availableSlots = allSlots
        .filter((slot) => {
          if (bookedTimes.has(slot.time)) return false;
          if (isToday && slot.time <= nowArgTime) return false;
          return true;
        })
        .sort((a, b) => a.time.localeCompare(b.time));

      if (availableSlots.length > 0) {
        // Devolver el primer slot disponible de este día
        const first = availableSlots[0];
        return NextResponse.json({
          date: dateStr,
          time: first.time,
          endTime: first.endTime,
          modality: first.modality,
          duration: first.duration,
        });
      }
    }

    // Ningún slot disponible en 14 días
    return NextResponse.json({ date: null });
  } catch (error) {
    console.error("Get next available slot error:", error);
    return NextResponse.json(
      { error: "Error al buscar próximo turno disponible" },
      { status: 500 }
    );
  }
}
