import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PUT /api/admin/patients/[id] — Edit patient data
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    // ID validation: Patient.id is String @id @default(cuid()) — never parseInt
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const { name, email, phone, dateOfBirth, emergencyContact, notes, active } = body;

    // Verify patient exists
    const existing = await db.patient.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Paciente no encontrado", detail: "P2025" },
        { status: 404 }
      );
    }

    // Check email uniqueness if email is being changed
    if (email && email.trim().toLowerCase() !== existing.user.email) {
      const duplicate = await db.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (duplicate && duplicate.id !== existing.userId) {
        return NextResponse.json(
          { error: "Ya existe otro usuario con ese email" },
          { status: 409 }
        );
      }
    }

    // Update both User and Patient in a transaction
    const updated = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(email !== undefined && { email: email.trim().toLowerCase() }),
          ...(phone !== undefined && { phone: phone?.trim() || null }),
          ...(active !== undefined && { active }),
        },
      });

      const updatedPatient = await tx.patient.update({
        where: { id },
        data: {
          ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth?.trim() || null }),
          ...(emergencyContact !== undefined && { emergencyContact: emergencyContact?.trim() || null }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
        },
        include: {
          user: { select: { name: true, email: true, phone: true, active: true, createdAt: true } },
        },
      });

      return updatedPatient;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: unknown; message?: string };
    console.error("Error en Prisma al actualizar paciente:", {
      code: prismaError.code,
      meta: prismaError.meta,
      message: prismaError.message,
    });
    return NextResponse.json(
      { error: "Error al actualizar paciente", detail: prismaError.code || "unknown" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/patients/[id] — Safe delete with relationship check
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    // ID validation: Patient.id is String @id @default(cuid()) — never parseInt
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Verify patient exists
    const existing = await db.patient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Paciente no encontrado", detail: "P2025" },
        { status: 404 }
      );
    }

    // ── CRITICAL BUSINESS RULE: Prevent cascade deletion ──
    // Check for active relationships before allowing deletion
    const appointmentCount = await db.appointment.count({
      where: { patientId: id },
    });

    if (appointmentCount > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el paciente porque posee ${appointmentCount} turno(s) asociado(s). Debe desvincularlo primero.`,
          detail: "HAS_APPOINTMENTS",
          appointmentCount,
        },
        { status: 400 }
      );
    }

    // Safe to delete: Patient has no appointments
    // onDelete: Cascade on Patient → User will also be deleted
    await db.patient.delete({ where: { id } });

    return NextResponse.json({ message: "Paciente eliminado exitosamente" });
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: unknown; message?: string };
    console.error("Error en Prisma al eliminar paciente:", {
      code: prismaError.code,
      meta: prismaError.meta,
      message: prismaError.message,
    });

    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "Paciente no encontrado (P2025)", detail: "P2025" },
        { status: 404 }
      );
    }
    if (prismaError.code === "P2003") {
      return NextResponse.json(
        { error: "No se puede eliminar: existen datos vinculados (P2003)", detail: "P2003" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error al eliminar paciente", detail: prismaError.code || "unknown" },
      { status: 500 }
    );
  }
}
