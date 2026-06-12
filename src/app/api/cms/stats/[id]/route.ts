import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role: string }).role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const { id } = await params;

    // ID validation: CmsStat.id is String (@id @default(cuid())) — never parse as integer
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const data = await req.json();
    const item = await db.cmsStat.update({ where: { id }, data });
    revalidatePath("/");
    return NextResponse.json(item);
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: unknown; message?: string };
    console.error("Error en Prisma al actualizar estadística:", {
      code: prismaError.code,
      meta: prismaError.meta,
      message: prismaError.message,
    });
    return NextResponse.json(
      { error: "Error al actualizar", detail: prismaError.code || "unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role: string }).role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const { id } = await params;

    // ID validation: CmsStat.id is String (@id @default(cuid())) — never parse as integer
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Verify the record exists before attempting deletion
    const existing = await db.cmsStat.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Estadística no encontrada", detail: "P2025" },
        { status: 404 }
      );
    }

    await db.cmsStat.delete({ where: { id } });
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: unknown; message?: string };
    console.error("Error en Prisma al eliminar estadística:", {
      code: prismaError.code,
      meta: prismaError.meta,
      message: prismaError.message,
    });

    // Map known Prisma error codes to meaningful responses
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "Estadística no encontrada (P2025)", detail: "P2025" },
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
      { error: "Error al eliminar estadística", detail: prismaError.code || "unknown" },
      { status: 500 }
    );
  }
}
