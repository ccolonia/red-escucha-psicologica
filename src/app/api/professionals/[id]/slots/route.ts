import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { db } from "@/lib/db";

// Argentina timezone constant — all date/time comparisons use this
const ARG_TZ = "America/Argentina/Buenos_Aires";

// Generate time slots from start to end with given duration
function generateSlots(startTime: string, endTime: string, duration: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + duration <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
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
    // Parse date string directly by splitting to avoid any UTC interpretation.
    // "2026-06-04" → year=2026, month=6, day=4
    const [year, month, day] = date.split("-").map(Number);

    // Compute dayOfWeek from date components using numeric constructor,
    // which interprets arguments as local calendar date (no UTC shift).
    // For any calendar date, the day of week is an absolute fact
    // (June 4 2026 is always Thursday), so numeric constructor is safe.
    const dayOfWeekJS = new Date(year, month - 1, day).getDay(); // 0=Sun, 1=Mon..6=Sat

    // Sunday = 0, no slots
    if (dayOfWeekJS === 0) {
      return NextResponse.json([]);
    }

    const dayOfWeek = dayOfWeekJS; // 1=Lun, 2=Mar...6=Sab

    // ===== TIMEZONE-SAFE "IS PAST" CHECK =====
    // Use Argentina timezone to determine "today" — avoids UTC shift where
    // Thursday 21:00 Arg becomes Friday 00:00 UTC, incorrectly marking
    // Thursday as "past".
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });

    if (date < todayStr) {
      return NextResponse.json([]);
    }

    // 1. Get the professional's weekly schedule for this day
    const schedules = await db.professionalSchedule.findMany({
      where: { professionalId: id, dayOfWeek },
    });

    // 2. Get overrides for this specific date
    const overrides = await db.scheduleOverride.findMany({
      where: { professionalId: id, date },
    });

    // 3. If no schedule defined for this day, check if there are "extra" overrides
    //    If no schedule and no extra overrides, return empty
    const blockOverrides = overrides.filter((o) => o.type === "block");
    const extraOverrides = overrides.filter((o) => o.type === "extra");

    // If there's a full-day block (no startTime/endTime on block), no slots
    const fullDayBlock = blockOverrides.some((o) => !o.startTime && !o.endTime);
    if (fullDayBlock) {
      return NextResponse.json([]);
    }

    // Generate base slots from weekly schedule
    let allSlots: Array<{ time: string; modality: string }> = [];

    for (const schedule of schedules) {
      const slots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotDuration);
      for (const time of slots) {
        // Check if this specific time is blocked by a partial block override
        const isBlocked = blockOverrides.some((block) => {
          if (block.startTime && block.endTime) {
            return time >= block.startTime && time < block.endTime;
          }
          return false; // full-day blocks already handled above
        });

        if (!isBlocked) {
          allSlots.push({ time, modality: schedule.modality });
        }
      }
    }

    // Add extra override slots
    for (const extra of extraOverrides) {
      if (extra.startTime && extra.endTime) {
        const duration = extra.slotDuration || 45;
        const slots = generateSlots(extra.startTime, extra.endTime, duration);
        for (const time of slots) {
          // Don't add duplicates
          if (!allSlots.find((s) => s.time === time)) {
            allSlots.push({ time, modality: extra.modality || "ambas" });
          }
        }
      }
    }

    // 4. Remove already booked slots
    const existingAppointments = await db.appointment.findMany({
      where: {
        professionalId: id,
        date,
        status: { in: ["pending", "confirmed"] },
      },
      select: { time: true },
    });

    const bookedTimes = new Set(existingAppointments.map((a) => a.time));

    // 5. Filter out past times if date is today (using Argentina timezone)
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

    return NextResponse.json(availableSlots);
  } catch (error) {
    console.error("Get slots error:", error);
    return NextResponse.json(
      { error: "Error al obtener turnos disponibles" },
      { status: 500 }
    );
  }
}
