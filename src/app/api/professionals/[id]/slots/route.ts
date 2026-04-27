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

    // Get existing appointments for this professional on this date
    const existingAppointments = await db.appointment.findMany({
      where: {
        professionalId: id,
        date,
        status: { in: ["pending", "confirmed"] },
      },
      select: { time: true },
    });

    const bookedTimes = new Set(existingAppointments.map((a) => a.time));

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(date + "T00:00:00");

    if (requestedDate < today) {
      return NextResponse.json([]);
    }

    // Check if date is a weekend
    const dayOfWeek = requestedDate.getDay();
    if (dayOfWeek === 0) {
      // Sunday - no slots
      return NextResponse.json([]);
    }

    // Filter available slots
    const availableSlots = TIME_SLOTS.filter((slot) => {
      if (bookedTimes.has(slot)) return false;

      // If the date is today, filter out past times
      if (requestedDate.getTime() === today.getTime()) {
        const now = new Date();
        const [hours, minutes] = slot.split(":").map(Number);
        const slotDate = new Date();
        slotDate.setHours(hours, minutes, 0, 0);
        if (slotDate <= now) return false;
      }

      // Saturday: only morning slots
      if (dayOfWeek === 6) {
        const hour = parseInt(slot.split(":")[0]);
        return hour < 13;
      }

      return true;
    });

    return NextResponse.json(availableSlots);
  } catch (error) {
    console.error("Get slots error:", error);
    return NextResponse.json(
      { error: "Error al obtener turnos disponibles" },
      { status: 500 }
    );
  }
}
