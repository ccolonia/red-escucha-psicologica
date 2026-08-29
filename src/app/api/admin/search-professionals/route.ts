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
// NUEVO FLUJO: el profesional debe activar manualmente cada slot desde Mi Agenda.
// Los slots del schedule NO se incluyen automáticamente como disponibles.
// SOLO se incluyen los slots que el profesional activó (override type="extra").
// Los slots del schedule se muestran en la grilla del profesional como "schedule"
// (naranja) y en el admin como "outside" (no asignables) hasta que se activen.
function computeAvailableSlots(
  schedules: { startTime: string; endTime: string; slotDuration: number; modality: string; dayOfWeek: number; direccionId?: string | null }[],
  overrides: { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null; direccionId?: string | null }[],
  bookedTimes: Set<string>,
  dateStr: string,
  todayStr: string,
  targetDayOfWeek: number
): { time: string; endTime: string; modality: string; duration: number; direccionId: string | null }[] {
  // === SOLO procesar extraOverrides (slots activados por el profesional) ===
  const extraOverrides = overrides.filter((o) => o.type === "extra");

  const allSlots: { time: string; endTime: string; modality: string; duration: number; direccionId: string | null }[] = [];

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
          allSlots.push({
            time,
            endTime: minutesToTime(slotEndMin),
            modality: extra.modality || "ambas",
            duration,
            direccionId: extra.direccionId || null,
          });
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

// === Helper NUEVO: computar TODOS los slots del schedule (sin filtrar) ===
// Devuelve todos los slots que el profesional tiene configurados para ese día,
// SIN importar si están booked, si son pasados, o si están bloqueados.
// Esto permite al frontend mostrar la grilla completa con modalidades, igual
// que la agenda del profesional (que usa isSlotInSchedule).
//
// Cada slot incluye un flag 'past' para que el frontend sepa si es clickeable.
function computeAllScheduleSlots(
  schedules: { startTime: string; endTime: string; slotDuration: number; modality: string; dayOfWeek: number; direccionId?: string | null }[],
  overrides: { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null; direccionId?: string | null }[],
  dateStr: string,
  todayStr: string,
  targetDayOfWeek: number
): { time: string; endTime: string; modality: string; duration: number; past: boolean; direccionId: string | null }[] {
  const daySchedules = schedules.filter((s) => s.dayOfWeek === targetDayOfWeek);
  const blockOverrides = overrides.filter((o) => o.type === "block");
  const extraOverrides = overrides.filter((o) => o.type === "extra");

  const fullDayBlock = blockOverrides.some((o) => !o.startTime && !o.endTime);
  if (fullDayBlock) return [];

  const allSlots: { time: string; endTime: string; modality: string; duration: number; direccionId: string | null }[] = [];
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
        allSlots.push({
          time,
          endTime: minutesToTime(slotEndMin),
          modality: schedule.modality,
          duration: schedule.slotDuration,
          direccionId: schedule.direccionId || null,
        });
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
          allSlots.push({
            time,
            endTime: minutesToTime(slotEndMin),
            modality: extra.modality || "ambas",
            duration,
            direccionId: extra.direccionId || null,
          });
        }
      }
    }
  }

  // Determinar si el slot es pasado
  const isToday = dateStr === todayStr;
  const isPastDay = dateStr < todayStr;
  const nowArgTime = isToday
    ? new Date().toLocaleTimeString("en-GB", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit" })
    : null;

  return allSlots
    .map((slot) => ({
      ...slot,
      past: isPastDay || (isToday && nowArgTime !== null && slot.time <= nowArgTime),
    }))
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
// FIX CRÍTICO: NO usar new Date() ni getDay() porque en Vercel (UTC)
// una fecha como 2026-08-03T00:00:00Z corresponde al 2026-08-02 en
// Argentina (UTC-3), causando un desfase de 1 día.
function getMondayOfWeekISO(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Usar mediodía UTC para evitar cambios de día por timezone
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const argDateStr = date.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
  const [ay, am, ad] = argDateStr.split("-").map(Number);
  const argDate = new Date(Date.UTC(ay, am - 1, ad, 12, 0, 0));
  const dayOfWeekJs = argDate.getUTCDay();
  const offset = dayOfWeekJs === 0 ? -6 : -(dayOfWeekJs - 1);
  const monday = new Date(Date.UTC(ay, am - 1, ad + offset, 12, 0, 0));
  const mondayStr = monday.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
  console.log(`[getMondayOfWeekISO] dateStr=${dateStr} → argDate=${argDateStr} → dayOfWeek=${dayOfWeekJs} → monday=${mondayStr}`);
  return mondayStr;
}

// === Helper: generar 7 fechas ISO a partir del lunes ===
// CRÍTICO: todas las fechas se generan en timezone Argentina (UTC-3)
// para evitar desfasajes en el cambio de mes (ej: junio→julio) cuando
// el servidor Vercel está en UTC. Si no forzamos ARG_TZ, una fecha
// como 2026-07-01 podría generarse como 2026-06-30 a ciertas horas,
// causando que los overrides de bloqueo se apliquen al día equivocado.
function generateWeekDatesFromISO(mondayStr: string): { date: string; dayOfWeek: number }[] {
  const dates: { date: string; dayOfWeek: number }[] = [];
  const [y, m, d] = mondayStr.split("-").map(Number);
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
    const isoDate = date.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
    const dayOfWeek = i === 6 ? 0 : i + 1;
    dates.push({ date: isoDate, dayOfWeek });
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
    const mondayStr = getMondayOfWeekISO(referenceDate);
    const weekDates = generateWeekDatesFromISO(mondayStr); // [{date, dayOfWeek} x7]
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
        // === Datos clínicos para el Derivador Inteligente ===
        // El frontend los usa para mostrar micro-badges de especialidades y
        // público objetivo en las tarjetas de resultados, ayudando al admin
        // a entender por qué el sistema recomendó a ese profesional.
        therapyTypes: true,
        targetAudience: true,
        zones: true,
        // === Dirección del consultorio (tarea 2026-07-25) ===
        // officeAddress: campo legacy (string simple)
        // addresses: modelo nuevo (ProfessionalAddress) con múltiples direcciones
        // Se usan para mostrar el "Lugar de atención" en el modal de asignación
        // de turno presencial y en la ficha del turno.
        officeAddress: true,
        addresses: {
          select: { id: true, label: true, address: true, isActive: true },
          orderBy: { isActive: "desc" }, // activa primero
        },
        user: { select: { id: true, name: true, email: true, phone: true } },
        // Traer TODOS los schedules (sin filtro dayOfWeek) — necesitamos los 7 días
        schedules: true,
        // Overrides de las 7 fechas de la semana
        scheduleOverrides: { where: { date: { in: weekDateStrings } } },
        // Appointments de las 7 fechas de la semana (activos + cancelados visibles)
        // LÓGICA DE SLOTS (tarea 2026-07-24):
        // - cancelled_by_patient: NO se incluye → el slot queda LIBRE (verde) en
        //   la grilla, disponible para que el admin asigne otro paciente.
        //   El turno sigue en la DB con status cancelled_by_patient para
        //   histórico, pero no bloquea el slot.
        // - cancelled_by_professional: SÍ se incluye → el slot se muestra como
        //   "booked" con etiqueta roja "Cancelado por Profesional". El admin
        //   decide si reasigna (cambia a confirmed) o cancela definitivamente
        //   (cambia a cancelled, liberando el slot).
        // - cancelled (legacy): NO se incluye → slot libre (compat turnos viejos).
        // - pending, confirmed, rescheduled, completed, absent: SÍ se incluyen
        //   porque son turnos activos o ya atendidos que ocupan el slot.
        appointments: {
          where: {
            date: { in: weekDateStrings },
            status: { in: ["pending", "confirmed", "rescheduled", "cancelled_by_professional", "completed", "absent", "scheduled", "skipped_holiday"] },
          },
          select: {
            id: true,
            date: true,
            time: true,
            modality: true,
            status: true,
            notes: true,
            patientEmailStatus: true,
            patientEmailSentAt: true,
            professionalEmailStatus: true,
            professionalEmailSentAt: true,
            // === Recurrencia (tarea 2026-08-21) ===
            seriesId: true,
            isOverride: true,
            originalDate: true,
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

        // === TODOS los slots del schedule (sin filtrar por booked/past) ===
        // Esto permite al frontend mostrar la grilla completa con modalidades,
        // igual que la agenda del profesional. Cada slot tiene flag 'past'.
        const allScheduleSlots = computeAllScheduleSlots(
          prof.schedules as { startTime: string; endTime: string; slotDuration: number; modality: string; dayOfWeek: number }[],
          dayOverrides as { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null }[],
          dateStr,
          todayStr,
          dayOfWeek
        );

        // === Calcular endTime para cada appointment basado en el slotDuration
        // del schedule que lo contiene (mismo cálculo que quick-assign) ===
        // Esto permite que el frontend muestre "21:00–21:45" en la grilla
        // igual que la agenda del profesional.
        const daySchedulesForDuration = (prof.schedules as { startTime: string; endTime: string; slotDuration: number; modality: string; dayOfWeek: number }[])
          .filter((s) => s.dayOfWeek === dayOfWeek);

        const bookedSlots = dayAppointments.map((a) => {
          // Buscar el schedule que contiene la hora del appointment
          const matchingSchedule = daySchedulesForDuration.find(
            (s) => a.time >= s.startTime && a.time < s.endTime
          );
          const slotDuration = matchingSchedule?.slotDuration || 45;
          // Calcular endTime = a.time + slotDuration
          const [h, m] = a.time.split(":").map(Number);
          const totalMin = h * 60 + m + slotDuration;
          const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;

          return {
            id: a.id,
            time: a.time,
            endTime,
            date: dateStr,
            modality: a.modality,
            status: a.status,
            notes: a.notes || null,
            patientName: a.patient?.user?.name || "Paciente",
            patientEmail: a.patient?.user?.email || null,
            patientPhone: a.patient?.user?.phone || null,
            patientEmailStatus: a.patientEmailStatus || null,
            patientEmailSentAt: a.patientEmailSentAt || null,
            professionalEmailStatus: a.professionalEmailStatus || null,
            professionalEmailSentAt: a.professionalEmailSentAt || null,
            // === Recurrencia (tarea 2026-08-21) ===
            seriesId: a.seriesId || null,
            isOverride: a.isOverride || false,
            originalDate: a.originalDate || null,
          };
        });

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
          allScheduleSlots,
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
        // === Datos clínicos crudos (JSON array string) ===
        // El frontend los parsea con JSON.parse para armar los micro-badges.
        // Se mandan como string crudo (no parseado acá) para mantener la
        // consistencia con el resto del schema y dejar que el frontend decida
        // cómo mostrarlos.
        therapyTypes: prof.therapyTypes,
        targetAudience: prof.targetAudience,
        zones: prof.zones,
        // === Dirección del consultorio (tarea 2026-07-25) ===
        // officeAddress: campo legacy (string simple o null)
        // addresses: array de ProfessionalAddress (con label, address, isActive)
        // El frontend usa resolveAddressForSlot() para mostrar la dirección
        // correcta según el slot (presencial) en el modal de asignación.
        officeAddress: prof.officeAddress,
        addresses: prof.addresses.map((a) => ({
          id: a.id,
          label: a.label,
          address: a.address,
          isActive: a.isActive,
        })),
        weeklySlots,
        // === Schedules crudos para que el frontend use isSlotInSchedule ===
        // El frontend necesita los schedules originales (startTime, endTime,
        // slotDuration, modality, dayOfWeek) para determinar si una celda está
        // dentro del rango de atención del profesional, igual que hace la
        // agenda del profesional con isSlotInSchedule():
        //   daySchedules.some(s => time >= s.startTime && time < s.endTime)
        schedules: prof.schedules.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          slotDuration: s.slotDuration,
          modality: s.modality,
          dayOfWeek: s.dayOfWeek,
        })),
        // === Overrides crudos para que el frontend detecte slots bloqueados ===
        scheduleOverrides: prof.scheduleOverrides.map((o) => ({
          date: o.date,
          type: o.type,
          startTime: o.startTime,
          endTime: o.endTime,
          slotDuration: o.slotDuration,
          modality: o.modality,
        })),
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
