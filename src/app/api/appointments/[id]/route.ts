import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Estado es requerido" },
        { status: 400 }
      );
    }

    const appointment = await db.appointment.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
      },
      include: {
        patient: { include: { user: { select: { name: true } } } },
        professional: { include: { user: { select: { name: true } } } },
      },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Update appointment error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el turno" },
      { status: 500 }
    );
  }
}
