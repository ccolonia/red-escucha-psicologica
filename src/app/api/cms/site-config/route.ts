import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function GET() {
  try {
    const items = await db.cmsSiteConfig.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching site config:", error);
    return NextResponse.json({ error: "Error fetching site config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role: string }).role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const data = await req.json();

    if (Array.isArray(data)) {
      // Batch update
      const results = [];
      for (const item of data) {
        const result = await db.cmsSiteConfig.upsert({
          where: { key: item.key },
          update: { value: item.value, group: item.group },
          create: { key: item.key, value: item.value, group: item.group },
        });
        results.push(result);
      }
      revalidatePath("/");
      return NextResponse.json(results);
    }

    // Single update
    const result = await db.cmsSiteConfig.upsert({
      where: { key: data.key },
      update: { value: data.value, group: data.group },
      create: { key: data.key, value: data.value, group: data.group },
    });
    revalidatePath("/");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating site config:", error);
    return NextResponse.json({ error: "Error updating site config" }, { status: 500 });
  }
}
