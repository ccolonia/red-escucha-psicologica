import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get("id");

    if (!professionalId) {
      return NextResponse.json({ error: "ID de profesional requerido" }, { status: 400 });
    }

    const professional = await db.professional.findUnique({
      where: { id: professionalId },
      select: { cvData: true, cvFileName: true, cvMimeType: true },
    });

    if (!professional || !professional.cvData) {
      return NextResponse.json({ error: "CV no encontrado" }, { status: 404 });
    }

    // Decode base64 and return as file
    const buffer = Buffer.from(professional.cvData, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": professional.cvMimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${professional.cvFileName || "cv.pdf"}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("CV download error:", error);
    return NextResponse.json({ error: "Error al obtener el CV" }, { status: 500 });
  }
}
