import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const items = await db.cmsSpecialtyTab.findMany({
      orderBy: { order: "asc" },
      include: { specialties: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching specialty tabs:", error);
    return NextResponse.json({ error: "Error fetching specialty tabs" }, { status: 500 });
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
    const { label, order, active } = body;
    if (!label) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    const item = await db.cmsSpecialtyTab.create({
      data: {
        label,
        order: order ?? 0,
        active: active !== false,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating specialty tab:", error);
    return NextResponse.json({ error: "Error creating specialty tab" }, { status: 500 });
  }
}
