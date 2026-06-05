import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { db } from "@/lib/db";

// Argentina timezone constant — all date/time comparisons use this
const ARG_TZ = "America/Argentina/Buenos_Aires";

// Convert "HH:MM" string to total minutes since midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Convert total minutes to "HH:MM" string
function minutesToTime(m: number): string {
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// Generate time slots from start to end with given duration.
// Only includes slots whose END time does not exceed endTime (strict boundary).
function generateSlots(startTime: string, endTime: string, duration: number): string[] {
  const slots: string[] = [];
  let currentMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  // Guard: if startTime >= endTime, no valid slots (misconfigured schedule)
  if (currentMinutes >= endMinutes) {
    console.warn(
      `[slots] startTime >= endTime detected (${startTime} >= ${endTime}). Skipping this schedule entry.`
    );
    return [];
  }

  while (currentMinutes + duration <= endMinutes) {
    slots.push(minutesToTime(currentMinutes));
    currentMinutes += duration;
  }

  return slots;
}

// GET /api/professionals/[id]/slots?date=2026-06-15
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  unstable_noStore();

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Fecha es requerida" },
        { status: 400 }
      );
    }

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
      return NextResponse.json([]);
    }

    // ===== TIMEZONE-SAFE DATE PARSING =====
    const [year, month, day] = date.split("-").map(Number);

    // Compute dayOfWeek using numeric constructor (local calendar, no UTC shift).
    // Day of week is an absolute fact — June 4 2026 is always Thursday.
    const dayOfWeekJS = new Date(year, month - 1, day).getDay(); // 0=Sun, 1=Mon..6=Sat

    // Sunday = 0, no slots
    if (dayOfWeekJS === 0) {
      return NextResponse.json([]);
    }

    const dayOfWeek = dayOfWeekJS; // 1=Lun, 2=Mar...6=Sab

    // ===== TIMEZONE-SAFE "IS PAST" CHECK =====
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });

    if (date < todayStr) {
      return NextResponse.json([]);
    }

    // 1. Get the professional's weekly schedule for this day
    const schedules = await db.professionalSchedule.findMany({
      where: { professionalId: id, dayOfWeek },
      orderBy: { startTime: "asc" },
    });

    // Diagnostic log: show what schedules were found for this day
    console.log(
      `[slots] date=${date} dayOfWeek=${dayOfWeek} | Found ${schedules.length} schedule(s):`,
      schedules.map((s) => `${s.startTime}-${s.endTime} (${s.slotDuration}min, modality=${s.modality})`)
    );

    // 2. Get overrides for this specific date
    const overrides = await db.scheduleOverride.findMany({
      where: { professionalId: id, date },
    });

    if (overrides.length > 0) {
      console.log(
        `[slots] date=${date} | Found ${overrides.length} override(s):`,
        overrides.map((o) => `${o.type} ${o.startTime || "?"}-${o.endTime || "?"} (${o.reason || "no reason"})`)
      );
    }

    const blockOverrides = overrides.filter((o) => o.type === "block");
    const extraOverrides = overrides.filter((o) => o.type === "extra");

    // If there's a full-day block (no startTime/endTime on block), no slots
    const fullDayBlock = blockOverrides.some((o) => !o.startTime && !o.endTime);
    if (fullDayBlock) {
      console.log(`[slots] date=${date} | Full-day block detected, returning empty.`);
      return NextResponse.json([]);
    }

    // ===== GENERATE BASE SLOTS FROM WEEKLY SCHEDULE =====
    let allSlots: Array<{ time: string; modality: string }> = [];

    for (const schedule of schedules) {
      const slots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotDuration);

      for (const time of slots) {
        // Strict endTime clamp (numeric comparison — bulletproof against edge cases):
        // A slot's START must be strictly before endTime, and its END (start + duration)
        // must not exceed endTime. generateSlots already enforces this, but we double-check.
        const slotStartMin = timeToMinutes(time);
        const slotEndMin = slotStartMin + schedule.slotDuration;
        const endMin = timeToMinutes(schedule.endTime);

        if (slotStartMin >= endMin || slotEndMin > endMin) {
          console.warn(
            `[slots] Slot ${time} (ends ${minutesToTime(slotEndMin)}) exceeds endTime ${schedule.endTime}. Filtered out.`
          );
          continue;
        }

        // Check if this specific time is blocked by a partial block override
        const isBlocked = blockOverrides.some((block) => {
          if (block.startTime && block.endTime) {
            return time >= block.startTime && time < block.endTime;
          }
          return false;
        });

        if (!isBlocked) {
          allSlots.push({ time, modality: schedule.modality });
        }
      }
    }

    // ===== ADD EXTRA OVERRIDE SLOTS =====
    for (const extra of extraOverrides) {
      if (extra.startTime && extra.endTime) {
        const duration = extra.slotDuration || 45;
        const slots = generateSlots(extra.startTime, extra.endTime, duration);

        for (const time of slots) {
          // Strict endTime clamp for overrides too
          const slotStartMin = timeToMinutes(time);
          const slotEndMin = slotStartMin + duration;
          const endMin = timeToMinutes(extra.endTime);

          if (slotStartMin >= endMin || slotEndMin > endMin) continue;

          // Don't add duplicates (keep the first one, which comes from the weekly schedule)
          if (!allSlots.find((s) => s.time === time)) {
            allSlots.push({ time, modality: extra.modality || "ambas" });
          }
        }
      }
    }

    // 3. Remove already booked slots
    const existingAppointments = await db.appointment.findMany({
      where: {
        professionalId: id,
        date,
        status: { in: ["pending", "confirmed"] },
      },
      select: { time: true },
    });

    const bookedTimes = new Set(existingAppointments.map((a) => a.time));

    // 4. Filter out past times if date is today (using Argentina timezone)
    const isToday = date === todayStr;
    const nowArgTime = isToday
      ? new Date().toLocaleTimeString("en-GB", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit" })
      : null;

    const availableSlots = allSlots.filter((slot) => {
      // Remove booked
      if (bookedTimes.has(slot.time)) return false;

      // Remove past times for today — compare HH:MM strings directly
      if (nowArgTime && slot.time <= nowArgTime) return false;

      return true;
    });

    // Sort by time and return
    availableSlots.sort((a, b) => a.time.localeCompare(b.time));

    console.log(
      `[slots] date=${date} | Returning ${availableSlots.length} available slot(s) from ${allSlots.length} total (${bookedTimes.size} booked)`
    );

    return NextResponse.json(availableSlots);
  } catch (error) {
    console.error("Get slots error:", error);
    return NextResponse.json(
      { error: "Error al obtener turnos disponibles" },
      { status: 500 }
    );
  }
}
