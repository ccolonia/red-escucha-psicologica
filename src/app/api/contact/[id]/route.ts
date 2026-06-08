import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const VALID_STATUSES = ["nuevo", "leido", "respondido", "resuelto"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session.user as { role: string }).role;
    if (!session?.user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, action } = body;

    // Action: habilitar_turno — create PatientRequest from ContactRequest data
    if (action === "habilitar_turno") {
      const existing = await db.contactRequest.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: "Consulta no encontrada" },
          { status: 404 }
        );
      }

      if (existing.turnoHabilitado) {
        return NextResponse.json(
          { error: "El turno ya fue habilitado para esta consulta" },
          { status: 409 }
        );
      }

      // Map contact reason to patient request reason
      const reasonMap: Record<string, string> = {
        solicitar_turno: "consulta_general",
        consulta_general: "consulta_general",
        informacion: "consulta_general",
      };
      const mappedReason = reasonMap[existing.reason || ""] || "consulta_general";

      // Create PatientRequest and mark contact as turnoHabilitado atomically
      const result = await db.$transaction(async (tx) => {
        const patientRequest = await tx.patientRequest.create({
          data: {
            name: existing.name,
            email: existing.email,
            phone: existing.phone || null,
            modality: "presencial",
            reason: mappedReason,
            notes: existing.message
              ? `Consulta de contacto: ${existing.message}`
              : null,
            status: "pending",
          },
        });

        const updatedContact = await tx.contactRequest.update({
          where: { id },
          data: { turnoHabilitado: true, status: existing.status === "nuevo" ? "leido" : existing.status },
        });

        return { patientRequest, updatedContact };
      });

      return NextResponse.json({
        message: "Turno habilitado exitosamente",
        patientRequest: result.patientRequest,
        contact: result.updatedContact,
      });
    }

    // Default: status update
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Estado inválido. Debe ser: nuevo, leido, respondido o resuelto" },
        { status: 400 }
      );
    }

    const existing = await db.contactRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Consulta no encontrada" },
        { status: 404 }
      );
    }

    const updated = await db.contactRequest.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update contact request error:", error);
    return NextResponse.json(
      { error: "Error al actualizar la consulta" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session.user as { role: string }).role;
    if (!session?.user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.contactRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Consulta no encontrada" },
        { status: 404 }
      );
    }

    await db.contactRequest.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Consulta eliminada exitosamente" });
  } catch (error) {
    console.error("Delete contact request error:", error);
    return NextResponse.json(
      { error: "Error al eliminar la consulta" },
      { status: 500 }
    );
  }
}
