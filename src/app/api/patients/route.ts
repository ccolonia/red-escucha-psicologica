import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin" && role !== "professional") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const patients = await db.patient.findMany({
      include: {
        user: {
          select: { name: true, email: true, phone: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    return NextResponse.json(patients);
  } catch (error) {
    console.error("Get patients error:", error);
    return NextResponse.json(
      { error: "Error al obtener pacientes" },
      { status: 500 }
    );
  }
}
