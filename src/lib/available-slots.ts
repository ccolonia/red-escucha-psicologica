// === Helper: Obtener próximos slots disponibles para el bot de WhatsApp ===
//
// Esta función consulta la base de datos y devuelve los próximos N slots
// disponibles (overrides type="extra" activados por los profesionales que
// no tengan appointment confirmado/pendiente y que sean futuros).
//
// Es una versión simplificada de la lógica de /api/admin/search-professionals
// optimizada para el caso de uso del bot de WhatsApp: obtener rápido 2-3
// opciones de turnos cercanos para ofrecer al paciente.

import { db } from "@/lib/db";

const ARG_TZ = "America/Argentina/Buenos_Aires";

// === Helpers de tiempo ===
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// === Generador de slots estrictamente contiguos ===
// NO hay snapping/rounding a :00 o :30. El siguiente slot empieza EXACTAMENTE
// donde termina el anterior (currentStart = currentEnd).
// Ej: 14:00-19:30 con 45 min → 14:00, 14:45, 15:30, 16:15, 17:00, 17:45, 18:30
// (sin gaps artificiales entre slots)
function generateSlots(startTime: string, endTime: string, duration: number): string[] {
  const slots: string[] = [];
  let currentMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (currentMinutes >= endMinutes) return [];
  while (currentMinutes + duration <= endMinutes) {
    slots.push(minutesToTime(currentMinutes));
    currentMinutes += duration;
  }
  return slots;
}

// === Tipos ===
export type AvailableSlot = {
  professionalId: string;
  professionalName: string;
  professionalProfession: string | null;
  professionalSpecialty: string | null;
  date: string;          // ISO "2026-07-21"
  time: string;          // "14:00"
  endTime: string;       // "14:45"
  modality: string;      // "P" | "OL" | "ambas" | "H"
  duration: number;
};

/**
 * Obtiene los próximos N slots disponibles, ordenados por proximidad temporal.
 *
 * @param limit Cantidad máxima de slots a devolver (default 3)
 * @param daysAhead Cuántos días hacia adelante buscar (default 14)
 * @returns Array de AvailableSlot ordenados cronológicamente
 */
export async function getUpcomingAvailableSlots(
  limit: number = 3,
  daysAhead: number = 14
): Promise<AvailableSlot[]> {
  // === Calcular rango de fechas en timezone Argentina ===
  // Forzamos ARG_TZ porque el servidor Vercel está en UTC y necesitamos
  // que "hoy" sea "hoy" en Argentina, no en UTC.
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
  const todayDate = new Date(todayStr + "T12:00:00");
  const futureDate = new Date(todayDate);
  futureDate.setDate(todayDate.getDate() + daysAhead);

  // Generar todas las fechas ISO del rango
  const weekDates: { date: string; dayOfWeek: number }[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() + i);
    const isoDate = d.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
    const dayOfWeek = new Date(isoDate + "T12:00:00").getDay();
    weekDates.push({ date: isoDate, dayOfWeek });
  }
  const dateStrings = weekDates.map((w) => w.date);

  // === Traer todos los profesionales disponibles con sus schedules y overrides ===
  const professionals = await db.professional.findMany({
    where: {
      available: true,
      user: { active: true },
      licenseVerified: true,
    },
    select: {
      id: true,
      profession: true,
      specialty: true,
      user: { select: { name: true } },
      schedules: true,
      scheduleOverrides: {
        where: { date: { in: dateStrings } },
      },
      appointments: {
        where: {
          date: { in: dateStrings },
          status: { in: ["pending", "confirmed", "rescheduled"] },
        },
        select: { date: true, time: true },
      },
    },
  });

  // === Hora actual en Argentina (para filtrar slots pasados de hoy) ===
  const nowArgTime = new Date().toLocaleTimeString("en-GB", {
    timeZone: ARG_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });

  // === Para cada profesional, computar slots disponibles por fecha ===
  const allSlots: AvailableSlot[] = [];

  for (const prof of professionals) {
    // Agrupar overrides y appointments por fecha
    const overridesByDate: Record<string, typeof prof.scheduleOverrides> = {};
    for (const ov of prof.scheduleOverrides) {
      if (!overridesByDate[ov.date]) overridesByDate[ov.date] = [];
      overridesByDate[ov.date].push(ov);
    }
    const appointmentsByDate: Record<string, Set<string>> = {};
    for (const apt of prof.appointments) {
      if (!appointmentsByDate[apt.date]) appointmentsByDate[apt.date] = new Set();
      appointmentsByDate[apt.date].add(apt.time);
    }

    for (const { date: dateStr } of weekDates) {
      const dayOverrides = overridesByDate[dateStr] || [];
      const bookedTimes = appointmentsByDate[dateStr] || new Set<string>();

      // === Solo procesar extraOverrides (slots activados manualmente) ===
      // Misma lógica que computeAvailableSlots de search-professionals
      const extraOverrides = dayOverrides.filter((o) => o.type === "extra");

      for (const extra of extraOverrides) {
        if (!extra.startTime || !extra.endTime) continue;
        const duration = extra.slotDuration || 45;
        const slots = generateSlots(extra.startTime, extra.endTime, duration);

        for (const time of slots) {
          const slotStartMin = timeToMinutes(time);
          const slotEndMin = slotStartMin + duration;
          const endMin = timeToMinutes(extra.endTime);
          if (slotStartMin >= endMin || slotEndMin > endMin) continue;

          // Filtrar slots ya reservados
          if (bookedTimes.has(time)) continue;

          // Filtrar slots pasados (solo si es hoy)
          if (dateStr === todayStr && time <= nowArgTime) continue;

          allSlots.push({
            professionalId: prof.id,
            professionalName: prof.user.name,
            professionalProfession: prof.profession,
            professionalSpecialty: prof.specialty,
            date: dateStr,
            time,
            endTime: minutesToTime(slotEndMin),
            modality: extra.modality || "ambas",
            duration,
          });
        }
      }
    }
  }

  // === Ordenar por proximidad temporal (fecha + hora) ===
  allSlots.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  // === Limitar a los N más próximos ===
  return allSlots.slice(0, limit);
}

/**
 * Formatea un slot como string legible para el bot de WhatsApp.
 * Ej: "Vie 21/07 a las 14:00 hs con Lic. María Monge (Online)"
 */
export function formatSlotForWhatsApp(slot: AvailableSlot): string {
  const [y, m, d] = slot.date.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diaSemana = dias[date.getDay()];
  const fechaCorta = `${diaSemana} ${parseInt(d)}/${parseInt(m)}`;

  const modalityLabel =
    slot.modality === "OL" || slot.modality === "ambas"
      ? "Online"
      : slot.modality === "P"
      ? "Presencial"
      : slot.modality === "H"
      ? "Híbrida"
      : slot.modality;

  // Tomar solo el primer nombre del profesional (ej: "Lic. María Monge" → "María")
  // para no revelar apellido completo en el primer contacto del bot
  const primerNombre = slot.professionalName.split(" ")[0] || slot.professionalName;

  return `📅 ${fechaCorta} a las ${slot.time} hs\n   con ${primerNombre} (${modalityLabel})`;
}
