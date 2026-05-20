import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const items = await db.cmsPhilosophy.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching philosophy items:", error);
    return NextResponse.json({ error: "Error fetching philosophy items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role: string }).role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const data = await req.json();
    const item = await db.cmsPhilosophy.create({ data });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating philosophy item:", error);
    return NextResponse.json({ error: "Error creating philosophy item" }, { status: 500 });
  }
}
