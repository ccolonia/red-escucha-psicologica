import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// === Helper: verificar permisos ===
async function checkPermissions(
  session: Awaited<ReturnType<typeof getServerSession>>,
  professionalId: string
) {
  if (!session) return { error: "No autorizado", status: 401 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any;

  const professional = await db.professional.findUnique({
    where: { id: professionalId },
    select: { userId: true },
  });

  if (!professional) {
    return { error: "Profesional no encontrado", status: 404 };
  }

  const isOwner = professional.userId === user.id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";
  if (!isOwner && !isAdmin) {
    return {
      error: "No tenés permisos para modificar este profesional",
      status: 403,
    };
  }

  return { user, professional };
}

// === PATCH: actualizar dirección (incluyendo toggle isActive) ===
// Cuando se activa una dirección, se desactivan todas las demás automáticamente
// (transaccional, instantáneo).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { id: professionalId, addressId } = await params;

  const permCheck = await checkPermissions(session, professionalId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ("error" in permCheck) {
    return NextResponse.json(
      { error: permCheck.error },
      { status: permCheck.status }
    );
  }

  const body = await req.json();
  const { label, address, isActive } = body as {
    label?: string;
    address?: string;
    isActive?: boolean;
  };

  // Verificar que la dirección exista y pertenezca a este profesional
  const existing = await db.professionalAddress.findFirst({
    where: { id: addressId, professionalId },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Dirección no encontrada" },
      { status: 404 }
    );
  }

  // Si se está activando, desactivar las demás en una transacción
  if (isActive === true) {
    await db.$transaction([
      db.professionalAddress.updateMany({
        where: { professionalId, isActive: true },
        data: { isActive: false },
      }),
      db.professionalAddress.update({
        where: { id: addressId },
        data: {
          label: label?.trim() ?? existing.label,
          address: address?.trim() ?? existing.address,
          isActive: true,
        },
      }),
    ]);
  } else {
    // Update simple (puede incluir isActive: false o no tocar isActive)
    await db.professionalAddress.update({
      where: { id: addressId },
      data: {
        ...(label !== undefined ? { label: label.trim() } : {}),
        ...(address !== undefined ? { address: address.trim() } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });
  }

  const updated = await db.professionalAddress.findUnique({
    where: { id: addressId },
  });

  return NextResponse.json(updated);
}

// === DELETE: eliminar una dirección ===
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { id: professionalId, addressId } = await params;

  const permCheck = await checkPermissions(session, professionalId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ("error" in permCheck) {
    return NextResponse.json(
      { error: permCheck.error },
      { status: permCheck.status }
    );
  }

  const existing = await db.professionalAddress.findFirst({
    where: { id: addressId, professionalId },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Dirección no encontrada" },
      { status: 404 }
    );
  }

  await db.professionalAddress.delete({
    where: { id: addressId },
  });

  return NextResponse.json({ success: true });
}
