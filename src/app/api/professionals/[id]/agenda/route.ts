import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30",
  "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate"); // ISO date string

    if (!startDate) {
      return NextResponse.json(
        { error: "startDate es requerida (YYYY-MM-DD)" },
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

    // Calculate the week dates starting from Monday
    const weekStart = new Date(startDate + "T00:00:00");
    const dayOfWeek = weekStart.getDay();
    // Adjust to Monday (0=Sun -> Mon is -6 or +1, 1=Mon -> 0, etc.)
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(weekStart);
    monday.setDate(monday.getDate() + mondayOffset);

    // Generate 6 days: Mon-Sat
    const weekDates: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d.toISOString().split("T")[0]);
    }

    // Get all appointments for this week
    const appointments = await db.appointment.findMany({
      where: {
        professionalId: id,
        date: { in: weekDates },
        status: { in: ["pending", "confirmed", "completed"] },
      },
      include: {
        patient: { include: { user: { select: { name: true, email: true, phone: true } } } },
      },
    });

    // Build the agenda grid
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const agenda = weekDates.map((date, dayIndex) => {
      // Sunday (dayIndex 6) - skip, but we only generate Mon-Sat
      const dateObj = new Date(date + "T00:00:00");
      const isPast = dateObj < today;
      const isToday = date === today.toISOString().split("T")[0];
      const isSaturday = dayIndex === 5;

      // Get slots for this day
      const daySlots = TIME_SLOTS.map((time) => {
        // For Saturday, only morning slots (before 13:00)
        if (isSaturday) {
          const hour = parseInt(time.split(":")[0]);
          if (hour >= 13) return null;
        }

        // Find existing appointment for this slot
        const appointment = appointments.find((a) => a.date === date && a.time === time);

        // Check if slot is in the past
        let isPastSlot = false;
        if (isPast) {
          isPastSlot = true;
        } else if (isToday) {
          const [hours, minutes] = time.split(":").map(Number);
          const slotDate = new Date();
          slotDate.setHours(hours, minutes, 0, 0);
          if (slotDate <= now) {
            isPastSlot = true;
          }
        }

        return {
          time,
          date,
          status: appointment
            ? appointment.status
            : isPastSlot
            ? "past"
            : "available",
          appointment: appointment
            ? {
                id: appointment.id,
                status: appointment.status,
                reason: appointment.reason,
                notes: appointment.notes,
                patient: {
                  id: appointment.patient.id,
                  name: appointment.patient.user.name,
                  email: appointment.patient.user.email,
                  phone: appointment.patient.user.phone,
                },
              }
            : null,
        };
      }).filter(Boolean);

      return {
        date,
        dayName: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][dayIndex],
        isToday,
        isPast,
        slots: daySlots,
      };
    });

    return NextResponse.json({
      weekDates,
      weekStart: weekDates[0],
      weekEnd: weekDates[weekDates.length - 1],
      agenda,
    });
  } catch (error) {
    console.error("Get agenda error:", error);
    return NextResponse.json(
      { error: "Error al obtener la agenda" },
      { status: 500 }
    );
  }
}
