import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/search-professionals
//
// Motor de asignación inteligente para la Agenda Centralizada del admin.
// Devuelve profesionales que matchean los filtros clínicos, con sus slots
// (libres y ocupados) computados para TODA la semana calendario (Lun-Dom).
//
// Query params (todos opcionales):
//   weekStart       — ISO date del LUNES de la semana a consultar (ej: "2026-06-23")
//                     Si no se pasa, se calcula el lunes de la semana actual.
//   profession      — string parcial (ej: "Psicólogo")
//   specialty       — string parcial (ej: "Psicología Clínica")
//   therapyTypes    — comma-separated (ej: "Psicoanálisis,EMDR")
//   targetAudience  — comma-separated (ej: "Adultos,Adolescentes")
//   therapyModalities — comma-separated (ej: "Individual,Vincular")
//   modality        — "presencial" | "online" | "híbrida" | "ambas"
//
// Respuesta:
//   200 + {
//     criteria,
//     summary,
//     weekDates: string[7],  // ISO dates Lun-Dom
//     professionals: [
//       { id, name, ..., weeklySlots: { 1: {date, availableSlots, bookedSlots}, ..., 0: {...} },
//         totalFreeSlots, totalBookedSlots, hasAvailability }
//     ]
//   }
//
// Lógica:
//   1. Calcular rango de la semana (Lun-Dom) a partir de weekStart
//   2. Filtrar professionals por campos clínicos (where clause)
//   3. Aplicar Barrera 1: filtrado por modalidad a nivel perfil
//   4. Traer professionals con TODOS los schedules (sin filtro dayOfWeek),
//      overrides de las 7 fechas, y appointments de las 7 fechas
//   5. Para cada profesional, computar slots disponibles para cada día
//      de la semana (reutiliza computeAvailableSlots)
//   6. Barrera 2: filtrar slots por modalidad compatible
//   7. Devolver estructura con weeklySlots mapeado por dayOfWeek (0-6)

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

// === Helper: compatibilidad de modalidad ===
function isModalityCompatible(scheduleModality: string, requestedModality: string): boolean {
  if (!requestedModality || requestedModality === "ambas") return true;
  const sm = scheduleModality.toUpperCase();
  if (requestedModality === "presencial") return sm === "P" || sm === "AMBI" || sm === "AMBAS" || sm === "H";
  if (requestedModality === "online") return sm === "OL" || sm === "AMBI" || sm === "AMBAS" || sm === "H";
  if (requestedModality === "híbrida" || requestedModality === "hibrida") return sm === "H" || sm === "AMBI" || sm === "AMBAS";
  return true;
}

// === Helper: computar slots disponibles para un professional en una fecha ===
function computeAvailableSlots(
  schedules: { startTime: string; endTime: string; slotDuration: number; modality: string; dayOfWeek: number }[],
  overrides: { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null }[],
  bookedTimes: Set<string>,
  dateStr: string,
  todayStr: string,
  targetDayOfWeek: number
): { time: string; endTime: string; modality: string; duration: number }[] {
  // Filtrar schedules del día específico
  const daySchedules = schedules.filter((s) => s.dayOfWeek === targetDayOfWeek);
  const blockOverrides = overrides.filter((o) => o.type === "block");
  const extraOverrides = overrides.filter((o) => o.type === "extra");

  const fullDayBlock = blockOverrides.some((o) => !o.startTime && !o.endTime);
  if (fullDayBlock) return [];

  const allSlots: { time: string; endTime: string; modality: string; duration: number }[] = [];
  for (const schedule of daySchedules) {
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

  const isToday = dateStr === todayStr;
  const nowArgTime = isToday
    ? new Date().toLocaleTimeString("en-GB", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit" })
    : null;

  return allSlots
    .filter((slot) => {
      if (bookedTimes.has(slot.time)) return false;
      if (nowArgTime && slot.time <= nowArgTime) return false;
      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

// === Helper NUEVO: computar slots bloqueados por el profesional ===
// Devuelve los slots que el profesional bloqueó manualmente (type="block" con
// startTime/endTime) para que el admin los vea como "Ocupado" en la grilla.
// Estos slots NO están en availableSlots (los filtra computeAvailableSlots),
// pero sí queremos mostrarlos visualmente en la grilla del admin con el
// estado "blocked" para que el admin sepa que ese horario no está libre.
function computeBlockedSlots(
  schedules: { startTime: string; endTime: string; slotDuration: number; modality: string; dayOfWeek: number }[],
  overrides: { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null }[],
  bookedTimes: Set<string>,
  targetDayOfWeek: number
): { time: string; endTime: string; modality: string; duration: number }[] {
  const daySchedules = schedules.filter((s) => s.dayOfWeek === targetDayOfWeek);
  const blockOverrides = overrides.filter((o) => o.type === "block" && o.startTime && o.endTime);

  const blockedSlots: { time: string; endTime: string; modality: string; duration: number }[] = [];

  for (const schedule of daySchedules) {
    const slots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotDuration);
    for (const time of slots) {
      // Si ya hay un appointment en este horario, no duplicar como bloqueado
      if (bookedTimes.has(time)) continue;

      const isBlocked = blockOverrides.some((block) => {
        return time >= block.startTime! && time < block.endTime!;
      });

      if (isBlocked) {
        const slotStartMin = timeToMinutes(time);
        const slotEndMin = slotStartMin + schedule.slotDuration;
        // Evitar duplicados
        if (!blockedSlots.find((s) => s.time === time)) {
          blockedSlots.push({
            time,
            endTime: minutesToTime(slotEndMin),
            modality: schedule.modality,
            duration: schedule.slotDuration,
          });
        }
      }
    }
  }

  return blockedSlots.sort((a, b) => a.time.localeCompare(b.time));
}

// === Helper: calcular el lunes de una semana (weekStartsOn: 1) ===
function getMondayOfWeek(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeekJs = date.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const monday = new Date(date);
  monday.setDate(date.getDate() - (dayOfWeekJs === 0 ? 6 : dayOfWeekJs - 1));
  return monday;
}

// === Helper: generar 7 fechas ISO a partir del lunes ===
// CRÍTICO: todas las fechas se generan en timezone Argentina (UTC-3)
// para evitar desfasajes en el cambio de mes (ej: junio→julio) cuando
// el servidor Vercel está en UTC. Si no forzamos ARG_TZ, una fecha
// como 2026-07-01 podría generarse como 2026-06-30 a ciertas horas,
// causando que los overrides de bloqueo se apliquen al día equivocado.
function generateWeekDates(monday: Date): { date: string; dayOfWeek: number }[] {
  const dates: { date: string; dayOfWeek: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    // Usar formato YYYY-MM-DD con timezone Argentina forzada
    const isoDate = d.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
    // Calcular dayOfWeek en timezone Argentina también
    const [yy, mm, dd] = isoDate.split("-").map(Number);
    const dayOfWeekJs = new Date(yy, mm - 1, dd).getDay();
    dates.push({ date: isoDate, dayOfWeek: dayOfWeekJs });
  }
  return dates;
}

export async function GET(request: NextRequest) {
  unstable_noStore();

  try {
    // === Auth: solo admin/super_admin ===
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // === Parsear query params ===
    const { searchParams } = new URL(request.url);
    const profession = searchParams.get("profession")?.trim() || "";
    const specialty = searchParams.get("specialty")?.trim() || "";
    const therapyTypesParam = searchParams.get("therapyTypes")?.trim() || "";
    const targetAudienceParam = searchParams.get("targetAudience")?.trim() || "";
    const therapyModalitiesParam = searchParams.get("therapyModalities")?.trim() || "";
    const weekStartParam = searchParams.get("weekStart")?.trim() || "";
    const modality = searchParams.get("modality")?.trim().toLowerCase() || "";

    const therapyTypes = therapyTypesParam ? therapyTypesParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const targetAudience = targetAudienceParam ? targetAudienceParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const therapyModalities = therapyModalitiesParam ? therapyModalitiesParam.split(",").map((t) => t.trim()).filter(Boolean) : [];

    // === Calcular rango de la semana (Lun-Dom) ===
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
    const referenceDate = weekStartParam || todayStr;
    const monday = getMondayOfWeek(referenceDate);
    const weekDates = generateWeekDates(monday); // [{date, dayOfWeek} x7]
    const weekDateStrings = weekDates.map((w) => w.date);

    // === Construir where clause para professionals ===
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      available: true,
      user: { active: true },
      licenseVerified: true,
    };

    if (profession) {
      where.profession = { contains: profession, mode: "insensitive" };
    }
    if (specialty) {
      where.specialty = { contains: specialty, mode: "insensitive" };
    }

    const andConditions: any[] = [];
    if (therapyTypes.length > 0) {
      for (const t of therapyTypes) {
        andConditions.push({ therapyTypes: { contains: `"${t}"`, mode: "insensitive" } });
      }
    }
    if (targetAudience.length > 0) {
      for (const t of targetAudience) {
        andConditions.push({ targetAudience: { contains: `"${t}"`, mode: "insensitive" } });
      }
    }
    if (therapyModalities.length > 0) {
      for (const t of therapyModalities) {
        andConditions.push({ therapyModality: { contains: `"${t}"`, mode: "insensitive" } });
      }
    }
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // === BARRERA 1: Filtrado por modalidad a nivel PERFIL ===
    if (modality && modality !== "ambas") {
      if (modality === "presencial") {
        where.OR = [{ presentialAttention: true }, { homeAttention: true }];
      } else if (modality === "online") {
        where.onlineAttention = true;
      } else if (modality === "híbrida" || modality === "hibrida") {
        where.OR = [
          { onlineAttention: true, presentialAttention: true },
          { onlineAttention: true, homeAttention: true },
          { presentialAttention: true, homeAttention: true },
          { onlineAttention: true, presentialAttention: true, homeAttention: true },
        ];
      }
    }

    // === Traer professionals con TODOS los schedules, overrides y appointments de la semana ===
    const professionals = await db.professional.findMany({
      where,
      select: {
        id: true,
        specialty: true,
        profession: true,
        onlineAttention: true,
        presentialAttention: true,
        homeAttention: true,
        therapyModality: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        // Traer TODOS los schedules (sin filtro dayOfWeek) — necesitamos los 7 días
        schedules: true,
        // Overrides de las 7 fechas de la semana
        scheduleOverrides: { where: { date: { in: weekDateStrings } } },
        // Appointments de las 7 fechas de la semana (activos)
        appointments: {
          where: {
            date: { in: weekDateStrings },
            status: { in: ["pending", "confirmed", "rescheduled", "cancelled_by_professional", "completed", "absent"] },
          },
          select: {
            id: true,
            date: true,
            time: true,
            modality: true,
            status: true,
            notes: true,
            patient: { select: { user: { select: { name: true, email: true, phone: true } } } },
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    // === Para cada professional, computar slots por día de la semana ===
    const enrichedProfessionals = professionals.map((prof) => {
      // Agrupar appointments por fecha
      const appointmentsByDate: Record<string, typeof prof.appointments> = {};
      for (const apt of prof.appointments) {
        if (!appointmentsByDate[apt.date]) appointmentsByDate[apt.date] = [];
        appointmentsByDate[apt.date].push(apt);
      }

      // Agrupar overrides por fecha
      const overridesByDate: Record<string, typeof prof.scheduleOverrides> = {};
      for (const ov of prof.scheduleOverrides) {
        if (!overridesByDate[ov.date]) overridesByDate[ov.date] = [];
        overridesByDate[ov.date].push(ov);
      }

      // Computar slots para cada día de la semana
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const weeklySlots: Record<number, any> = {};
      let totalFreeSlots = 0;
      let totalBookedSlots = 0;

      for (const { date: dateStr, dayOfWeek } of weekDates) {
        const dayAppointments = appointmentsByDate[dateStr] || [];
        const dayOverrides = overridesByDate[dateStr] || [];
        const bookedTimes = new Set(dayAppointments.map((a) => a.time));

        const availableSlotsRaw = computeAvailableSlots(
          prof.schedules as { startTime: string; endTime: string; slotDuration: number; modality: string; dayOfWeek: number }[],
          dayOverrides as { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null }[],
          bookedTimes,
          dateStr,
          todayStr,
          dayOfWeek
        );

        // Filtrar por modalidad compatible (Barrera 2)
        const availableSlots = modality
          ? availableSlotsRaw.filter((s) => isModalityCompatible(s.modality, modality))
          : availableSlotsRaw;

        const bookedSlots = dayAppointments.map((a) => ({
          id: a.id,
          time: a.time,
          date: dateStr,
          modality: a.modality,
          status: a.status,
          notes: a.notes || null,
          patientName: a.patient?.user?.name || "Paciente",
          patientEmail: a.patient?.user?.email || null,
          patientPhone: a.patient?.user?.phone || null,
        }));

        // === Agregar slots bloqueados por el profesional como "blocked" ===
        // Esto permite que el admin vea visualmente qué slots están bloqueados
        // (mostrarán "🔒 Ocupado" en la grilla) en vez de desaparecer sin más.
        const blockedSlotsRaw = computeBlockedSlots(
          prof.schedules as { startTime: string; endTime: string; slotDuration: number; modality: string; dayOfWeek: number }[],
          dayOverrides as { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null }[],
          bookedTimes,
          dayOfWeek
        );
        const blockedSlots = blockedSlotsRaw.map((s) => ({
          id: `blocked-${dateStr}-${s.time}`,
          time: s.time,
          date: dateStr,
          modality: s.modality,
          status: "blocked" as const,
          notes: "Bloqueado por el profesional",
          patientName: "🔒 Ocupado",
          patientEmail: null,
          patientPhone: null,
        }));

        // Combinar appointments reales + slots bloqueados (sin duplicar horarios)
        const allBookedSlots = [...bookedSlots, ...blockedSlots];

        weeklySlots[dayOfWeek] = {
          date: dateStr,
          availableSlots,
          bookedSlots: allBookedSlots,
        };

        totalFreeSlots += availableSlots.length;
        totalBookedSlots += allBookedSlots.length;
      }

      const modalityBadges: string[] = [];
      if (prof.onlineAttention) modalityBadges.push("Online");
      if (prof.presentialAttention) modalityBadges.push("Presencial");
      if (prof.homeAttention) modalityBadges.push("A Domicilio");

      return {
        id: prof.id,
        name: prof.user.name,
        email: prof.user.email,
        phone: prof.user.phone,
        specialty: prof.specialty,
        profession: prof.profession,
        modalityBadges,
        weeklySlots,
        totalFreeSlots,
        totalBookedSlots,
        hasAvailability: totalFreeSlots > 0,
      };
    });

    // === Barrera 2b: si se solicitó modalidad específica, remover profesionales con 0 slots ===
    const filteredProfessionals = modality
      ? enrichedProfessionals.filter((p) => p.totalFreeSlots > 0)
      : enrichedProfessionals;

    return NextResponse.json({
      criteria: {
        profession: profession || null,
        specialty: specialty || null,
        therapyTypes: therapyTypes.length > 0 ? therapyTypes : null,
        targetAudience: targetAudience.length > 0 ? targetAudience : null,
        therapyModalities: therapyModalities.length > 0 ? therapyModalities : null,
        modality: modality || null,
        weekStart: weekDates[0].date,
        weekEnd: weekDates[6].date,
      },
      summary: {
        totalProfessionalsMatched: filteredProfessionals.length,
        professionalsWithSlots: filteredProfessionals.filter((p) => p.hasAvailability).length,
        professionalsWithoutSlots: filteredProfessionals.filter((p) => !p.hasAvailability).length,
        totalSlotsAvailable: filteredProfessionals.reduce((sum, p) => sum + p.totalFreeSlots, 0),
        totalBookedSlots: filteredProfessionals.reduce((sum, p) => sum + p.totalBookedSlots, 0),
      },
      weekDates: weekDates.map((w) => w.date),
      professionals: filteredProfessionals,
    });
  } catch (error) {
    console.error("Error in search-professionals:", error);
    return NextResponse.json(
      { error: "Error al buscar profesionales" },
      { status: 500 }
    );
  }
}
