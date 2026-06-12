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
    const body = await req.json();
    // Only accept expected fields — prevent Prisma errors from extra fields
    const { label, order, active } = body;
    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = label;
    if (order !== undefined) data.order = order;
    if (active !== undefined) data.active = active;

    const item = await db.cmsSpecialtyTab.update({ where: { id }, data });
    revalidatePath("/");
    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating specialty tab:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role: string }).role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const { id } = await params;
    await db.cmsSpecialtyTab.delete({ where: { id } });
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting specialty tab:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
