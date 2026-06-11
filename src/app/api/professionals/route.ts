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
      // Exclude cvData (base64) from the list — use /api/professionals/cv?id= to download
      select: {
        id: true,
        userId: true,
        license: true,
        licenseVerified: true,
        specialty: true,
        bio: true,
        available: true,
        title: true,
        profession: true,
        cuil: true,
        gender: true,
        therapyTypes: true,
        targetAudience: true,
        therapyModality: true,
        onlineAttention: true,
        presentialAttention: true,
        homeAttention: true,
        zones: true,
        cvFileName: true,
        cvMimeType: true,
        internalNotes: true,
        evaluationStatus: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true, phone: true, active: true, createdAt: true },
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
    const { id, available, license, licenseVerified, specialty, bio, internalNotes, evaluationStatus } = body;

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

    const data: { available?: boolean; license?: string; licenseVerified?: boolean; specialty?: string; bio?: string | null; internalNotes?: string | null; evaluationStatus?: string | null } = {};

    if (available !== undefined) {
      data.available = available;
    }
    if (license !== undefined) {
      // Validar formato de matrícula: MN o MP + 4-6 dígitos
      const licenseClean = license.replace(/[\s.-]/g, "");
      const licenseRegex = /^(MN|MP)(\d{4,6})$/;
      if (!licenseRegex.test(licenseClean)) {
        return NextResponse.json(
          { error: "La matrícula debe ser MN o MP seguido de 4 a 6 dígitos (ej: MN-12345 o MP-5432)" },
          { status: 400 }
        );
      }
      data.license = license;
    }
    if (specialty !== undefined) {
      data.specialty = specialty;
    }
    if (bio !== undefined) {
      data.bio = bio;
    }
    if (licenseVerified !== undefined) {
      data.licenseVerified = licenseVerified;
    }
    if (internalNotes !== undefined) {
      data.internalNotes = internalNotes;
    }
    if (evaluationStatus !== undefined) {
      data.evaluationStatus = evaluationStatus;
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session.user as { role: string }).role;
    if (!session?.user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID del profesional es requerido" },
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

    // Delete appointments first (to avoid FK constraint issues)
    await db.appointment.deleteMany({
      where: { professionalId: id },
    });

    // Delete the professional
    await db.professional.delete({
      where: { id },
    });

    // Delete the associated user
    if (professional.userId) {
      await db.user.delete({
        where: { id: professional.userId },
      }).catch(() => {});
    }

    return NextResponse.json({ message: "Profesional eliminado exitosamente" });
  } catch (error) {
    console.error("Delete professional error:", error);
    return NextResponse.json(
      { error: "Error al eliminar el profesional" },
      { status: 500 }
    );
  }
}
