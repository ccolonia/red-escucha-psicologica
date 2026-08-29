import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelRecurringSeries } from "@/lib/services/recurring";

// ============================================================================
// PATCH /api/appointments/recurring/[id]/cancel
// Cancela una serie recurrente completa:
//   1. Setea active=false en RecurringSeries
//   2. Cancela los appointments futuros en status "scheduled"
//   3. Mantiene los appointments ya atendidos/completados para auditoría
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin" && role !== "professional") {
      return NextResponse.json(
        { error: "Solo administradores o profesionales pueden cancelar series" },
        { status: 403 }
      );
    }

    const { id: seriesId } = await params;

    // === Verificar que la serie existe ===
    const series = await db.recurringSeries.findUnique({
      where: { id: seriesId },
    });
    if (!series) {
      return NextResponse.json(
        { error: "Serie recurrente no encontrada" },
        { status: 404 }
      );
    }

    // === Si es profesional, verificar que sea el dueño ===
    if (role === "professional") {
      const userId = (session.user as { id: string }).id;
      const prof = await db.professional.findUnique({ where: { userId } });
      if (!prof || prof.id !== series.professionalId) {
        return NextResponse.json(
          { error: "Solo podés cancelar tus propias series" },
          { status: 403 }
        );
      }
    }

    // === Ejecutar cancelación ===
    const result = await cancelRecurringSeries(seriesId);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Serie cancelada. ${result.cancelledAppointments} turnos futuros cancelados, ${result.keptAppointments} turnos históricos mantenidos para auditoría.`,
    });
  } catch (error) {
    console.error("[PATCH /api/appointments/recurring/[id]/cancel] Error:", error);
    return NextResponse.json(
      { error: "Error al cancelar la serie recurrente" },
      { status: 500 }
    );
  }
}
