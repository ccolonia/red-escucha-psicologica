import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/search-professionals
//
// Motor de asignación inteligente para la mesa de control admin.
// Cruza los filtros clínicos del paciente (profession, specialty,
// therapyTypes, targetAudience) con la disponibilidad real de los
// profesionales (ProfessionalSchedule + ScheduleOverride + appointments
// ya tomados) y devuelve los slots libres compatibles con la modalidad
// solicitada.
//
// Query params (todos opcionales, pero se recomienda pasar al menos
// dayOfWeek + date para tener resultados útiles):
//   profession     — string exacto o parcial (ej: "Psicólogo")
//   specialty      — string exacto (ej: "Psicología Clínica")
//   therapyTypes   — comma-separated (ej: "Psicoanálisis,EMDR")
//   targetAudience — comma-separated (ej: "Adultos,Adolescentes")
//   dayOfWeek      — int 0-6 (0=Dom, 1=Lun, ..., 6=Sab)
//   date           — ISO date "2026-06-23" (para validar disponibilidad real)
//   modality       — "presencial" | "online" | "híbrida" | "ambas"
//                    (si no se pasa, no se filtra por modalidad)
//
// Respuesta:
//   200 + { criteria, summary, professionals[] }
//   401/403 — no autenticado / no admin
//   500 — error
//
// Lógica de cruce:
//   1. Filtrar professionals por campos descriptivos (where clause)
//   2. Traer cada professional con sus schedules del dayOfWeek,
//      overrides de la fecha, y appointments ya tomados esa fecha
//   3. Para cada professional, computar slots disponibles reutilizan-
//      do la misma lógica del endpoint /slots (slotDuration, overrides
//      block/extra, booked times, past times si es hoy)
//   4. Filtrar slots por modalidad compatible con la solicitada:
//        presencial → solo slots con modality "P" o "ambas"
//        online     → solo slots con modality "OL" o "ambas"
//        híbrida    → solo slots con modality "P", "OL", "H" o "ambas"
//        ambas      → todos los slots
//   5. Devolver JSON estructurado para alimentar la UI del admin

const ARG_TZ = "America/Argentina/Buenos_Aires";

// === Helpers de tiempo (duplicados del endpoint /slots — refactor
// futuro: mover a lib/slots.ts para no duplicar) ===
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
// Dado el modality del schedule ("P", "OL", "H", "ambas") y el modality
// solicitado por el paciente, devuelve true si son compatibles.
function isModalityCompatible(scheduleModality: string, requestedModality: string): boolean {
  if (!requestedModality || requestedModality === "ambas") return true;
  const sm = scheduleModality.toUpperCase();
  if (requestedModality === "presencial") return sm === "P" || sm === "AMBI" || sm === "AMBAS" || sm === "H";
  if (requestedModality === "online") return sm === "OL" || sm === "AMBI" || sm === "AMBAS" || sm === "H";
  if (requestedModality === "híbrida" || requestedModality === "hibrida") return sm === "H" || sm === "AMBI" || sm === "AMBAS";
  return true;
}

// === Helper: computar slots disponibles para un professional en una fecha ===
// Reutiliza la misma lógica del endpoint /slots pero inline (sin HTTP call).
function computeAvailableSlots(
  schedules: { startTime: string; endTime: string; slotDuration: number; modality: string }[],
  overrides: { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null }[],
  bookedTimes: Set<string>,
  dateStr: string,
  todayStr: string
): { time: string; endTime: string; modality: string; duration: number }[] {
  const blockOverrides = overrides.filter((o) => o.type === "block");
  const extraOverrides = overrides.filter((o) => o.type === "extra");

  // Full-day block → sin slots
  const fullDayBlock = blockOverrides.some((o) => !o.startTime && !o.endTime);
  if (fullDayBlock) return [];

  // Generar slots base desde schedules
  const allSlots: { time: string; endTime: string; modality: string; duration: number }[] = [];
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

  // Agregar extra overrides
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

  // Filtrar booked + past times si es hoy
  const isToday = dateStr === todayStr;
  const nowArgTime = isToday
    ? new Date().toLocaleTimeString("en-GB", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit" })
    : null;

  const availableSlots = allSlots
    .filter((slot) => {
      if (bookedTimes.has(slot.time)) return false;
      if (nowArgTime && slot.time <= nowArgTime) return false;
      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  return availableSlots;
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
    const dayOfWeekParam = searchParams.get("dayOfWeek");
    const date = searchParams.get("date")?.trim() || "";
    const modality = searchParams.get("modality")?.trim().toLowerCase() || "";

    const therapyTypes = therapyTypesParam ? therapyTypesParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const targetAudience = targetAudienceParam ? targetAudienceParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const therapyModalities = therapyModalitiesParam ? therapyModalitiesParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const dayOfWeek = dayOfWeekParam ? parseInt(dayOfWeekParam, 10) : null;

    // === Construir where clause para professionals ===
    // Lógica flexibilizada (commit de hoy) para evitar falsos negativos:
    //   - profession: contains insensitive (matchea "Psicólogo" con "Psicóloga",
    //     "Licenciado en Psicología", etc.)
    //   - specialty: contains insensitive (antes era match exacto, muy rigido)
    //   - therapyTypes, targetAudience, therapyModalities: contains insensitive
    //     con el string entre comillas dobles (porque son JSON arrays serializados)
    //     + normalización de espacios para tolerar variaciones
    // Filtros opcionales no restrictivos: si un param llega vacío, no se
    // agrega al where (cortocircuito con && { ... }).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      available: true,
      user: { active: true },
      licenseVerified: true,
    };

    // Profesión difusa: "Psicólogo" debe matchear "Licenciado en Psicología",
    // "Psicóloga", etc. Usamos contains insensitive.
    if (profession) {
      where.profession = { contains: profession, mode: "insensitive" };
    }

    // Especialidad: antes era match exacto (where.specialty = specialty),
    // ahora contains insensitive para tolerar variaciones de spacing.
    if (specialty) {
      where.specialty = { contains: specialty, mode: "insensitive" };
    }

    // === Búsqueda insensible en JSON/Arrays ===
    // Los campos therapyTypes, targetAudience y therapyModality son JSON
    // strings (ej: '["Psicoanálisis","EMDR"]'). Para buscar, usamos
    // contains con el string entre comillas dobles + mode insensitive.
    // El mode: insensitive cubre mayúsculas/minúsculas; el contains del
    // string entre comillas cubre el match exacto del item dentro del array.
    const andConditions: any[] = [];

    if (therapyTypes.length > 0) {
      for (const t of therapyTypes) {
        andConditions.push({
          therapyTypes: { contains: `"${t}"`, mode: "insensitive" },
        });
      }
    }

    if (targetAudience.length > 0) {
      for (const t of targetAudience) {
        andConditions.push({
          targetAudience: { contains: `"${t}"`, mode: "insensitive" },
        });
      }
    }

    // === NUEVO: Modalidad de Terapia (therapyModality) ===
    // Campo JSON string en Professional, valores: Individual, Vincular,
    // Evaluaciones, Terapia Grupal, Orientación a Padres, Asesoría a
    // Empresas, Pericias, Discapacidad, Orientación Vocacional.
    // No confundir con la modalidad de atención (Online/Presencial).
    if (therapyModalities.length > 0) {
      for (const t of therapyModalities) {
        andConditions.push({
          therapyModality: { contains: `"${t}"`, mode: "insensitive" },
        });
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // === Traer professionals con sus schedules, overrides y appointments ===
    const professionals = await db.professional.findMany({
      where,
      select: {
        id: true,
        specialty: true,
        profession: true,
        onlineAttention: true,
        presentialAttention: true,
        homeAttention: true,
        // Incluimos therapyModality para que la UI lo pueda mostrar si
        // hace falta, y para debuggear el cruce.
        therapyModality: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        schedules: dayOfWeek != null ? { where: { dayOfWeek } } : true,
        scheduleOverrides: date ? { where: { date } } : true,
        appointments: date ? {
          where: {
            date,
            status: { in: ["pending", "confirmed"] },
          },
          select: {
            id: true,
            time: true,
            modality: true,
            status: true,
            patient: { select: { user: { select: { name: true, email: true, phone: true } } } },
          },
        } : {
          where: { status: { in: ["pending", "confirmed"] } },
          select: { id: true, time: true, modality: true, status: true,
            patient: { select: { user: { select: { name: true, email: true, phone: true } } } } },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    // === Para cada professional, computar slots disponibles + filtrar por modalidad ===
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });

    const enrichedProfessionals = professionals.map((prof) => {
      const bookedTimes = new Set(prof.appointments.map((a) => a.time));

      const availableSlotsRaw = date && dayOfWeek != null
        ? computeAvailableSlots(
            prof.schedules as { startTime: string; endTime: string; slotDuration: number; modality: string }[],
            prof.scheduleOverrides as { type: string; startTime: string | null; endTime: string | null; slotDuration: number | null; modality: string | null }[],
            bookedTimes,
            date,
            todayStr
          )
        : [];

      // Filtrar por modalidad compatible
      const availableSlots = modality
        ? availableSlotsRaw.filter((s) => isModalityCompatible(s.modality, modality))
        : availableSlotsRaw;

      // Slots ocupados (para mostrar ficha al hacer click)
      const bookedSlots = prof.appointments.map((a) => ({
        id: a.id,
        time: a.time,
        modality: a.modality,
        status: a.status,
        patientName: a.patient?.user?.name || "Paciente",
        patientEmail: a.patient?.user?.email || null,
        patientPhone: a.patient?.user?.phone || null,
      }));

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
        availableSlots,
        bookedSlots,
        hasAvailability: availableSlots.length > 0,
      };
    });

    // === Summary ===
    const totalSlotsAvailable = enrichedProfessionals.reduce((sum, p) => sum + p.availableSlots.length, 0);
    const professionalsWithSlots = enrichedProfessionals.filter((p) => p.hasAvailability).length;

    return NextResponse.json({
      criteria: {
        profession: profession || null,
        specialty: specialty || null,
        therapyTypes: therapyTypes.length > 0 ? therapyTypes : null,
        targetAudience: targetAudience.length > 0 ? targetAudience : null,
        therapyModalities: therapyModalities.length > 0 ? therapyModalities : null,
        dayOfWeek: dayOfWeek,
        date: date || null,
        modality: modality || null,
      },
      summary: {
        totalProfessionalsMatched: enrichedProfessionals.length,
        professionalsWithSlots,
        professionalsWithoutSlots: enrichedProfessionals.length - professionalsWithSlots,
        totalSlotsAvailable,
        avgSlotsPerProfessional: enrichedProfessionals.length > 0
          ? Math.round((totalSlotsAvailable / enrichedProfessionals.length) * 10) / 10
          : 0,
      },
      professionals: enrichedProfessionals,
    });
  } catch (error) {
    console.error("Error in search-professionals:", error);
    return NextResponse.json(
      { error: "Error al buscar profesionales" },
      { status: 500 }
    );
  }
}
