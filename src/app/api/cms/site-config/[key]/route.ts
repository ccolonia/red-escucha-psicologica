import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "../../_lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    const config = await db.cmsSiteConfig.findUnique({ where: { key } });
    if (!config) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { key } = await params;
    const body = await request.json();
    const config = await db.cmsSiteConfig.upsert({
      where: { key },
      update: { value: body.value, ...(body.group && { group: body.group }) },
      create: { key, value: body.value || "", group: body.group || "general" },
    });
    revalidatePath("/");
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
