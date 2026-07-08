import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// === GET: listar direcciones de un profesional ===
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: professionalId } = await params;

  const addresses = await db.professionalAddress.findMany({
    where: { professionalId },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(addresses);
}

// === POST: crear nueva dirección ===
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: professionalId } = await params;
  const body = await req.json();
  const { label, address, isActive } = body as {
    label?: string;
    address?: string;
    isActive?: boolean;
  };

  if (!label || !address) {
    return NextResponse.json(
      { error: "Label y address son requeridos" },
      { status: 400 }
    );
  }

  // Verificar que el profesional pertenece al usuario actual (o es admin)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any;
  const professional = await db.professional.findUnique({
    where: { id: professionalId },
    select: { userId: true },
  });

  if (!professional) {
    return NextResponse.json(
      { error: "Profesional no encontrado" },
      { status: 404 }
    );
  }

  const isOwner = professional.userId === user.id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "No tenés permisos para modificar este profesional" },
      { status: 403 }
    );
  }

  // Si isActive es true, desactivar las demás direcciones primero
  // (solo una puede estar activa a la vez)
  if (isActive) {
    await db.professionalAddress.updateMany({
      where: { professionalId, isActive: true },
      data: { isActive: false },
    });
  }

  const newAddress = await db.professionalAddress.create({
    data: {
      professionalId,
      label: label.trim(),
      address: address.trim(),
      isActive: Boolean(isActive),
    },
  });

  return NextResponse.json(newAddress, { status: 201 });
}
