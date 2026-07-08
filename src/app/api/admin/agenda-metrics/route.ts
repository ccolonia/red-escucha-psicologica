import { NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/agenda-metrics
//
// Devuelve métricas agregadas para el dashboard superior de la vista
// "Agenda Centralizada" del admin. Calcula totales de la semana actual
// (lunes a sábado) usando aggregates de Prisma sobre Appointment y
// ProfessionalSchedule.
//
// Respuesta:
//   200 + {
//     occupancyRate,           // 0.0 - 1.0 (% ocupación)
//     activeProfessionals,     // count de professionals disponibles
//     totalSlotsThisWeek,      // capacidad total de la semana
//     bookedSlotsThisWeek,     // turnos confirmados/pendientes
//     freeSlotsThisWeek,       // totalSlots - booked
//     topSpecialties,          // [{ specialty, count }] top 5
//     appointmentsByStatus,    // { pending, confirmed, completed, ... }
//     weekRange: { start, end } // ISO dates
//   }
//   401/403 — no autenticado / no admin
//   500 — error
//
// Lógica:
//   1. Calcular rango de la semana actual (lunes a sábado, sin domingo)
//   2. totalSlotsThisWeek: sumar slots generados por cada ProfessionalSchedule
//      de la semana (startTime, endTime, slotDuration) → (endMin - startMin) / slotDuration
//   3. bookedSlotsThisWeek: count de appointments en el rango con status
//      pending/confirmed/rescheduled (activos)
//   4. occupancyRate: booked / total (con guard de división por cero)
//   5. topSpecialties: groupBy sobre appointments de la semana join professional
//   6. appointmentsByStatus: groupBy sobre appointments de la semana

const ARG_TZ = "America/Argentina/Buenos_Aires";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Calcular cuántos slots genera un schedule (endMin - startMin) / slotDuration
function slotsInSchedule(startTime: string, endTime: string, slotDuration: number): number {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  if (startMin >= endMin || slotDuration <= 0) return 0;
  return Math.floor((endMin - startMin) / slotDuration);
}

export async function GET() {
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

    // === Calcular rango de la semana actual (lunes a sábado) ===
    // Usar timezone Argentina para que el "hoy" sea consistente.
    const now = new Date();
    const todayStr = now.toLocaleDateString("sv-SE", { timeZone: ARG_TZ });

    // Calcular lunes de esta semana (weekStartsOn: 1 = lunes)
    const today = new Date(todayStr + "T12:00:00");
    const dayOfWeekJs = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeekJs === 0 ? 6 : dayOfWeekJs - 1));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5); // lun + 5 = sábado

    // Generar array de fechas ISO de la semana (lun a sáb)
    const weekDates: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d.toLocaleDateString("sv-SE"));
    }

    // === 1. activeProfessionals: count de professionals disponibles ===
    const activeProfessionals = await db.professional.count({
      where: {
        available: true,
        user: { active: true },
        licenseVerified: true,
      },
    });

    // === 2. totalSlotsThisWeek: sumar slots de todos los schedules ===
    // Los schedules son semanales (dayOfWeek 1-6), así que cada schedule
    // representa 1 día por semana. Sumamos los slots de cada schedule.
    const schedules = await db.professionalSchedule.findMany({
      where: { dayOfWeek: { in: [1, 2, 3, 4, 5, 6] } },
      select: { startTime: true, endTime: true, slotDuration: true, professionalId: true },
    });

    let totalSlotsThisWeek = 0;
    for (const s of schedules) {
      totalSlotsThisWeek += slotsInSchedule(s.startTime, s.endTime, s.slotDuration);
    }

    // === 3. bookedSlotsThisWeek: appointments activos en el rango ===
    const bookedAppointments = await db.appointment.findMany({
      where: {
        date: { in: weekDates },
        status: { in: ["pending", "confirmed", "rescheduled"] },
      },
      select: {
        id: true,
        status: true,
        professional: { select: { specialty: true } },
      },
    });

    const bookedSlotsThisWeek = bookedAppointments.length;
    const freeSlotsThisWeek = Math.max(0, totalSlotsThisWeek - bookedSlotsThisWeek);
    const occupancyRate = totalSlotsThisWeek > 0
      ? Math.round((bookedSlotsThisWeek / totalSlotsThisWeek) * 100) / 100
      : 0;

    // === 4. topSpecialties: groupBy manual sobre bookedAppointments ===
    const specialtyCounts: Record<string, number> = {};
    for (const apt of bookedAppointments) {
      const sp = apt.professional.specialty;
      specialtyCounts[sp] = (specialtyCounts[sp] || 0) + 1;
    }
    const topSpecialties = Object.entries(specialtyCounts)
      .map(([specialty, count]) => ({ specialty, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // === 5. appointmentsByStatus: groupBy manual sobre TODOS los
    // appointments de la semana (no solo activos) ===
    const allWeekAppointments = await db.appointment.findMany({
      where: { date: { in: weekDates } },
      select: { status: true },
    });
    const appointmentsByStatus: Record<string, number> = {};
    for (const apt of allWeekAppointments) {
      appointmentsByStatus[apt.status] = (appointmentsByStatus[apt.status] || 0) + 1;
    }

    return NextResponse.json({
      occupancyRate,
      activeProfessionals,
      totalSlotsThisWeek,
      bookedSlotsThisWeek,
      freeSlotsThisWeek,
      topSpecialties,
      appointmentsByStatus,
      weekRange: {
        start: weekDates[0],
        end: weekDates[5],
      },
    });
  } catch (error) {
    console.error("Error in agenda-metrics:", error);
    return NextResponse.json(
      { error: "Error al obtener métricas de agenda" },
      { status: 500 }
    );
  }
}
