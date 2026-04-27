import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const specialty = searchParams.get("specialty");

    const where: { available?: boolean; specialty?: string } = {};
    if (specialty) {
      where.specialty = specialty;
    }

    const professionals = await db.professional.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    return NextResponse.json(professionals);
  } catch (error) {
    console.error("Get professionals error:", error);
    return NextResponse.json(
      { error: "Error al obtener profesionales" },
      { status: 500 }
    );
  }
}
