import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const specialty = searchParams.get("specialty");
    const available = searchParams.get("available");

    const where: { available?: boolean; specialty?: string } = {};
    if (specialty) {
      where.specialty = specialty;
    }
    if (available === "true") {
      where.available = true;
    } else if (available === "false") {
      where.available = false;
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

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, available, license, specialty, bio } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID del profesional es requerido" },
        { status: 400 }
      );
    }

    const existing = await db.professional.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    const data: { available?: boolean; license?: string; specialty?: string; bio?: string | null } = {};

    if (available !== undefined) {
      data.available = available;
    }
    if (license !== undefined) {
      data.license = license;
    }
    if (specialty !== undefined) {
      data.specialty = specialty;
    }
    if (bio !== undefined) {
      data.bio = bio;
    }

    const professional = await db.professional.update({
      where: { id },
      data,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    return NextResponse.json(professional);
  } catch (error) {
    console.error("Update professional error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el profesional" },
      { status: 500 }
    );
  }
}
