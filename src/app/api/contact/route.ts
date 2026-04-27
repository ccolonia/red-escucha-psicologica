import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message, reason } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Nombre, email y mensaje son obligatorios" },
        { status: 400 }
      );
    }

    await db.contactRequest.create({
      data: {
        name,
        email,
        phone: phone || null,
        message,
        reason: reason || null,
      },
    });

    return NextResponse.json(
      { message: "Consulta enviada exitosamente" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Error al enviar la consulta" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as { role: string }).role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const contacts = await db.contactRequest.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Get contact requests error:", error);
    return NextResponse.json(
      { error: "Error al obtener consultas" },
      { status: 500 }
    );
  }
}
