import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session.user as { role: string }).role;
    if (!session?.user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const totalPatients = await db.patient.count();
    const totalProfessionals = await db.professional.count();
    const activeProfessionals = await db.professional.count({
      where: { available: true },
    });

    const today = new Date().toISOString().split("T")[0];
    const appointmentsToday = await db.appointment.count({
      where: { date: today },
    });

    const pendingAppointments = await db.appointment.count({
      where: { status: "pending" },
    });

    const confirmedAppointments = await db.appointment.count({
      where: { status: "confirmed" },
    });

    const completedAppointments = await db.appointment.count({
      where: { status: "completed" },
    });

    const cancelledAppointments = await db.appointment.count({
      where: { status: "cancelled" },
    });

    const absentAppointments = await db.appointment.count({
      where: { status: "absent" },
    });

    const rescheduledAppointments = await db.appointment.count({
      where: { status: "rescheduled" },
    });

    // Last 7 days stats
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = await db.appointment.count({
        where: { date: dateStr },
      });
      last7Days.push({
        date: dateStr,
        count,
      });
    }

    const totalContactRequests = await db.contactRequest.count();

    return NextResponse.json({
      totalPatients,
      totalProfessionals,
      activeProfessionals,
      appointmentsToday,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      absentAppointments,
      rescheduledAppointments,
      last7Days,
      totalContactRequests,
    });
  } catch (error) {
    console.error("Get admin stats error:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas" },
      { status: 500 }
    );
  }
}
