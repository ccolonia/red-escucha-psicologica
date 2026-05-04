import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Only allow users to fetch their own data (or admin can fetch anyone)
    const currentUserId = (session.user as { id: string }).id;
    const currentRole = (session.user as { role: string }).role;
    if (id !== currentUserId && currentRole !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, role: true, active: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Error al obtener usuario" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, phone } = body;

    const existing = await db.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // If email is being changed, check for duplicates
    if (email && email !== existing.email) {
      const duplicate = await db.user.findUnique({
        where: { email },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con este email" },
          { status: 409 }
        );
      }
    }

    const data: { name?: string; email?: string; phone?: string | null } = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;

    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el usuario" },
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
    if (!session?.user || (session.user as { role: string }).role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Cascade deletes will handle Professional/Patient and their Appointments
    await db.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Usuario eliminado exitosamente" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Error al eliminar el usuario" },
      { status: 500 }
    );
  }
}
