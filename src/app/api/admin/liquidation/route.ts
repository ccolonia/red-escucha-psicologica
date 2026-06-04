import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/admin/liquidation — Monthly liquidation data for all professionals
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role: string })?.role;
    if (!session?.user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

    // Get all active professionals
    const professionals = await db.professional.findMany({
      where: { user: { active: true } },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // For each professional, get their appointments for the given month
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const liquidationData = await Promise.all(
      professionals.map(async (prof) => {
        const appointments = await db.appointment.findMany({
          where: {
            professionalId: prof.id,
            date: { gte: startDate, lt: endDate },
          },
          include: {
            patient: { include: { user: { select: { name: true } } } },
          },
        });

        const attended = appointments.filter((a) => a.status === "completed");
        const absent = appointments.filter((a) => a.status === "absent");
        const rescheduled = appointments.filter((a) => a.status === "rescheduled");
        const cancelled = appointments.filter((a) => a.status === "cancelled");
        const pending = appointments.filter((a) => a.status === "pending");
        const confirmed = appointments.filter((a) => a.status === "confirmed");

        // Check if there's an attendance sheet for this professional/month
        const sheet = await db.attendanceSheet.findUnique({
          where: {
            professionalId_month_year: {
              professionalId: prof.id,
              month,
              year,
            },
          },
          include: { sessions: true },
        });

        // Calculate fees from attendance sheet if available, otherwise estimate
        let totalPatientFee = 0;
        let totalProfessionalFee = 0;
        let totalRepFee = 0;
        let sessionFee = 0;

        if (sheet && sheet.sessions.length > 0) {
          const attendedSessions = sheet.sessions.filter(
            (s) => !s.absentWithNotice && !s.absentWithoutNotice
          );
          totalPatientFee = attendedSessions.reduce((sum, s) => sum + s.patientFee, 0);
          totalProfessionalFee = attendedSessions.reduce((sum, s) => sum + s.professionalFee, 0);
          totalRepFee = attendedSessions.reduce((sum, s) => sum + s.repFee, 0);
          if (attendedSessions.length > 0) {
            sessionFee = Math.round(
              attendedSessions.reduce((sum, s) => sum + s.patientFee, 0) /
                attendedSessions.length
            );
          }
        } else {
          // Default session fee estimate
          sessionFee = 15000;
          totalPatientFee = attended.length * sessionFee;
          totalProfessionalFee = Math.round(totalPatientFee * 0.7);
          totalRepFee = Math.round(totalPatientFee * 0.3);
        }

        return {
          professionalId: prof.id,
          professionalName: prof.user.name,
          specialty: prof.specialty,
          totalAppointments: appointments.length,
          attended: attended.length,
          absent: absent.length,
          rescheduled: rescheduled.length,
          cancelled: cancelled.length,
          pending: pending.length,
          confirmed: confirmed.length,
          sessionFee,
          totalPatientFee,
          totalProfessionalFee,
          totalRepFee,
          hasSheet: !!sheet,
          repCommission: sheet?.repCommission || 0.3,
        };
      })
    );

    return NextResponse.json(liquidationData);
  } catch (error) {
    console.error("Get liquidation error:", error);
    return NextResponse.json(
      { error: "Error al obtener liquidación" },
      { status: 500 }
    );
  }
}
