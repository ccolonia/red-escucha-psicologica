import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function GET() {
  try {
    const items = await db.cmsSpecialty.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching specialties:", error);
    return NextResponse.json({ error: "Error fetching specialties" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role: string }).role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const body = await req.json();
    // Only accept expected fields — prevent Prisma errors from extra fields
    const { icon, label, description, tabId, order, active } = body;
    if (!label || !tabId) {
      return NextResponse.json({ error: "Nombre y pestaña son obligatorios" }, { status: 400 });
    }
    const item = await db.cmsSpecialty.create({
      data: {
        icon: icon || "Brain",
        label,
        description: description || "",
        tabId,
        order: order ?? 0,
        active: active !== false,
      },
    });
    revalidatePath("/");
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating specialty:", error);
    return NextResponse.json({ error: "Error creating specialty" }, { status: 500 });
  }
}
