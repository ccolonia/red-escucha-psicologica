import { db } from "@/lib/db";

// ============================================================================
// SERVICIO DE RECURRENCIA — Motor de proyección de series de turnos
// Tarea 2026-08-21
// ============================================================================
//
// Este servicio centraliza TODA la lógica de:
//   1. Proyectar fechas futuras a partir de una RecurringSeries
//   2. Cruzar cada fecha contra la tabla Holiday (feriados)
//   3. Cruzar cada fecha contra ProfessionalAbsence (ausencias del profesional)
//   4. Generar Appointments individuales con el status correcto según el cruce
//   5. Cancelar series completas (setear active=false + cancelar futuros)
//
// Estados de los Appointments generados:
//   - "scheduled"             → fecha libre, turno generado normalmente
//   - "skipped_holiday"       → la fecha cae en un feriado → no se atiende
//   - "cancelled_by_professional" → la fecha cae en una ausencia del profesional
//
// IMPORTANTE: los turnos ya generados NO se sobreescriben si se vuelve a
// ejecutar la proyección (se salta si ya existe un appointment con mismo
// seriesId + date + time).
// ============================================================================

const ARG_TZ = "America/Argentina/Buenos_Aires";

// === Helpers de fecha (timezone-safe para Argentina) ===

/**
 * Convierte un Date a string ISO "YYYY-MM-DD" en timezone Argentina.
 * Evita el bug de UTC que desplaza un día cuando la hora es cerca de medianoche.
 */
function toISODateArg(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
}

/**
 * Obtiene el dayOfWeek de una fecha en timezone Argentina.
 * Retorna 1=Lunes ... 7=Domingo (igual que ProfessionalSchedule.dayOfWeek).
 */
function getDayOfWeekArg(date: Date): number {
  // getDay() retorna 0=Domingo, 1=Lunes, ..., 6=Sábado
  // Convertimos a 1=Lunes ... 7=Domingo
  const jsDay = parseInt(
    date.toLocaleDateString("en-US", { weekday: "short", timeZone: ARG_TZ }) === "Sun" ? "0" :
    date.toLocaleDateString("en-US", { weekday: "short", timeZone: ARG_TZ }) === "Mon" ? "1" :
    date.toLocaleDateString("en-US", { weekday: "short", timeZone: ARG_TZ }) === "Tue" ? "2" :
    date.toLocaleDateString("en-US", { weekday: "short", timeZone: ARG_TZ }) === "Wed" ? "3" :
    date.toLocaleDateString("en-US", { weekday: "short", timeZone: ARG_TZ }) === "Thu" ? "4" :
    date.toLocaleDateString("en-US", { weekday: "short", timeZone: ARG_TZ }) === "Fri" ? "5" :
    date.toLocaleDateString("en-US", { weekday: "short", timeZone: ARG_TZ }) === "Sat" ? "6" : "0"
  );
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Suma días a un Date sin modificar el original.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// PROYECCIÓN DE FECHAS
// ============================================================================

export interface ProjectedDate {
  date: string;           // ISO "YYYY-MM-DD"
  dayOfWeek: number;      // 1-7
  status: "scheduled" | "skipped_holiday" | "cancelled_by_professional";
  reason?: string;        // descripción del feriado o motivo de ausencia
}

/**
 * Genera la lista de fechas proyectadas para una serie recurrente,
 * cruzando contra feriados y ausencias del profesional.
 *
 * @param params Configuración de la serie
 * @param params.professionalId ID del profesional
 * @param params.dayOfWeek Día de la semana (1=Lunes ... 7=Domingo)
 * @param params.frequency WEEKLY | BIWEEKLY | MONTHLY
 * @param params.startDate Fecha de inicio (primer turno)
 * @param params.endDate Fecha de fin (opcional, null = 30 días vista)
 * @param params.projectionDays Días a proyectar (default 30)
 * @returns Array de fechas proyectadas con su status
 */
export async function projectRecurringDates(params: {
  professionalId: string;
  dayOfWeek: number;
  frequency: string;
  startDate: Date;
  endDate?: Date | null;
  projectionDays?: number;
}): Promise<ProjectedDate[]> {
  const {
    professionalId,
    dayOfWeek,
    frequency,
    startDate,
    endDate,
    projectionDays = 30,
  } = params;

  // === 1. Determinar el rango de proyección ===
  const projectionEnd = endDate || addDays(startDate, projectionDays);

  // === 2. Cargar feriados en el rango (1 sola query) ===
  const holidays = await db.holiday.findMany({
    where: {
      // Feriados en el rango [startDate, projectionEnd]
      // Usamos date >= startDate (medianoche) y date <= projectionEnd (medianoche del último día)
      date: {
        gte: new Date(toISODateArg(startDate) + "T00:00:00"),
        lte: new Date(toISODateArg(projectionEnd) + "T23:59:59"),
      },
    },
    select: { date: true, description: true },
  });
  // Set de fechas de feriados para lookup rápido
  const holidaySet = new Map<string, string>();
  for (const h of holidays) {
    const holidayDateStr = toISODateArg(h.date);
    holidaySet.set(holidayDateStr, h.description);
  }

  // === 3. Cargar ausencias del profesional en el rango (1 sola query) ===
  const absences = await db.professionalAbsence.findMany({
    where: {
      professionalId,
      // Ausencias que se solapan con el rango de proyección
      // startDate <= projectionEnd AND endDate >= startDate
      startDate: { lte: projectionEnd },
      endDate: { gte: startDate },
    },
    select: { startDate: true, endDate: true, reason: true },
  });

  // === 4. Iterar fechas y generar proyección ===
  const result: ProjectedDate[] = [];
  let currentDate = new Date(startDate);

  // Ajustar al primer día que coincida con dayOfWeek
  // (si startDate no cae en dayOfWeek, avanzamos hasta el primer match)
  while (getDayOfWeekArg(currentDate) !== dayOfWeek && currentDate <= projectionEnd) {
    currentDate = addDays(currentDate, 1);
  }

  // Iterar generando fechas según la frecuencia
  while (currentDate <= projectionEnd) {
    const dateStr = toISODateArg(currentDate);
    const dow = getDayOfWeekArg(currentDate);

    // Solo generar si el día de la semana coincide
    if (dow === dayOfWeek) {
      // === Cruzar contra feriados ===
      const holidayDesc = holidaySet.get(dateStr);
      if (holidayDesc) {
        result.push({
          date: dateStr,
          dayOfWeek: dow,
          status: "skipped_holiday",
          reason: holidayDesc,
        });
      } else {
        // === Cruzar contra ausencias del profesional ===
        const absenceMatch = absences.find((a) => {
          const absenceStart = toISODateArg(a.startDate);
          const absenceEnd = toISODateArg(a.endDate);
          return dateStr >= absenceStart && dateStr <= absenceEnd;
        });
        if (absenceMatch) {
          result.push({
            date: dateStr,
            dayOfWeek: dow,
            status: "cancelled_by_professional",
            reason: absenceMatch.reason || "Ausencia programada",
          });
        } else {
          // === Fecha libre → turno programado ===
          result.push({
            date: dateStr,
            dayOfWeek: dow,
            status: "scheduled",
          });
        }
      }

      // === Avanzar según frecuencia ===
      if (frequency === "BIWEEKLY") {
        currentDate = addDays(currentDate, 14);
      } else if (frequency === "MONTHLY") {
        // Monthly: sumar ~4 semanas (28 días) para mantener el mismo día de la semana
        currentDate = addDays(currentDate, 28);
      } else {
        // WEEKLY (default)
        currentDate = addDays(currentDate, 7);
      }
    } else {
      // Si no coincide el día, avanzar 1 día (caso del ajuste inicial)
      currentDate = addDays(currentDate, 1);
    }
  }

  return result;
}

// ============================================================================
// GENERACIÓN DE APPOINTMENTS
// ============================================================================

export interface GenerateResult {
  seriesId: string;
  totalProjected: number;
  scheduled: number;
  skippedHoliday: number;
  cancelledByAbsence: number;
  alreadyExisted: number;
}

/**
 * Genera los Appointments individuales a partir de una RecurringSeries.
 *
 * Para cada fecha proyectada:
 *   - "scheduled"             → crea Appointment con status="scheduled"
 *   - "skipped_holiday"       → crea Appointment con status="skipped_holiday"
 *   - "cancelled_by_professional" → crea Appointment con status="cancelled_by_professional"
 *
 * Si ya existe un Appointment con el mismo seriesId + date + time, lo salta
 * (no lo sobreescribe) para soportar re-ejecuciones idempotentes.
 *
 * @returns Resumen con contadores de cada tipo
 */
export async function generateAppointmentsFromSeries(params: {
  seriesId: string;
  patientId: string;
  professionalId: string;
  timeSlot: string;
  modality: string;
  slotDuration: number;
  dayOfWeek: number;
  frequency: string;
  startDate: Date;
  endDate?: Date | null;
  projectionDays?: number;
}): Promise<GenerateResult> {
  const {
    seriesId,
    patientId,
    professionalId,
    timeSlot,
    modality,
    dayOfWeek,
    frequency,
    startDate,
    endDate,
    projectionDays,
  } = params;

  // === 1. Proyectar fechas ===
  const projectedDates = await projectRecurringDates({
    professionalId,
    dayOfWeek,
    frequency,
    startDate,
    endDate,
    projectionDays,
  });

  // === 2. Verificar appointments ya existentes (idempotencia) ===
  const existingAppointments = await db.appointment.findMany({
    where: {
      seriesId,
      date: { in: projectedDates.map((p) => p.date) },
      time: timeSlot,
    },
    select: { date: true },
  });
  const existingDates = new Set(existingAppointments.map((a) => a.date));

  // === 3. Crear appointments en batch ===
  const appointmentsToCreate = projectedDates
    .filter((p) => !existingDates.has(p.date))
    .map((p) => ({
      patientId,
      professionalId,
      date: p.date,
      time: timeSlot,
      modality,
      status: p.status,
      reason: p.reason || null,
      seriesId,
      isOverride: false,
      // Emails: los turnos de serie no disparan emails automáticamente
      // (se disparan cuando el admin/profesional los confirma manualmente)
      patientEmailStatus: "SKIPPED" as const,
      professionalEmailStatus: "SKIPPED" as const,
    }));

  if (appointmentsToCreate.length > 0) {
    await db.appointment.createMany({
      data: appointmentsToCreate,
    });
  }

  // === 4. Calcular resumen ===
  const result: GenerateResult = {
    seriesId,
    totalProjected: projectedDates.length,
    scheduled: projectedDates.filter((p) => p.status === "scheduled").length,
    skippedHoliday: projectedDates.filter((p) => p.status === "skipped_holiday").length,
    cancelledByAbsence: projectedDates.filter((p) => p.status === "cancelled_by_professional").length,
    alreadyExisted: existingDates.size,
  };

  return result;
}

// ============================================================================
// CANCELACIÓN DE SERIE
// ============================================================================

export interface CancelSeriesResult {
  seriesId: string;
  cancelledAppointments: number;
  keptAppointments: number;
}

/**
 * Cancela una serie recurrente completa:
 *   1. Setea active=false en RecurringSeries
 *   2. Cancela los appointments futuros que estén en status "scheduled"
 *      (los que ya fueron atendidos/completados se mantienen para auditoría)
 *
 * @param seriesId ID de la serie a cancelar
 * @returns Resumen con cantidad de appointments cancelados vs mantenidos
 */
export async function cancelRecurringSeries(seriesId: string): Promise<CancelSeriesResult> {
  // === 1. Desactivar la serie ===
  await db.recurringSeries.update({
    where: { id: seriesId },
    data: { active: false },
  });

  // === 2. Cancelar appointments futuros en status "scheduled" ===
  // Solo cancelamos los que están en "scheduled" (no atendidos todavía).
  // Los que ya están en "completed", "cancelled", "skipped_holiday", etc.
  // se mantienen para histórico/auditoría.
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });

  const cancelledAppointments = await db.appointment.updateMany({
    where: {
      seriesId,
      status: "scheduled",
      date: { gte: todayStr },
    },
    data: {
      status: "cancelled",
      cancellationSource: "professional",
      cancellationReason: "Serie recurrente cancelada",
    },
  });

  // === 3. Contar appointments que se mantienen (para auditoría) ===
  const keptAppointments = await db.appointment.count({
    where: {
      seriesId,
      status: { not: "scheduled" },
    },
  });

  return {
    seriesId,
    cancelledAppointments: cancelledAppointments.count,
    keptAppointments,
  };
}
