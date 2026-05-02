import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as { role: string }).role !== "admin") {
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
