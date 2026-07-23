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
    const debug = searchParams.get("debug") === "true";

    if (!professionalId) {
      return NextResponse.json({ error: "ID de profesional requerido" }, { status: 400 });
    }

    const professional = await db.professional.findUnique({
      where: { id: professionalId },
      select: {
        cvData: true,
        cvFileName: true,
        cvMimeType: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!professional) {
      return NextResponse.json(
        { error: `Profesional con id ${professionalId} no encontrado` },
        { status: 404 }
      );
    }

    // === Modo debug: devuelve info del CV sin intentar decodificar ===
    // Útil para diagnosticar por qué falla la descarga.
    if (debug) {
      return NextResponse.json({
        professionalId,
        userName: professional.user?.name,
        userEmail: professional.user?.email,
        cvFileName: professional.cvFileName,
        cvMimeType: professional.cvMimeType,
        cvDataLength: professional.cvData?.length || 0,
        cvDataIsNull: professional.cvData === null,
        cvDataIsEmpty: professional.cvData === "",
        cvDataFirst50: professional.cvData?.substring(0, 50) || null,
        // Verificar si parece base64 válido (solo chars base64 + =)
        cvDataLooksValidBase64:
          professional.cvData && /^[A-Za-z0-9+/=\s]+$/.test(professional.cvData),
      });
    }

    if (!professional.cvData) {
      return NextResponse.json(
        {
          error: "CV no encontrado",
          detail: `El profesional ${professional.user?.name || ""} no tiene cvData cargado en la DB. Probablemente subió un CV pero no se guardó correctamente.`,
          cvFileName: professional.cvFileName,
        },
        { status: 404 }
      );
    }

    // Decodificar base64 con manejo de errores explícito
    let buffer: Buffer;
    try {
      buffer = Buffer.from(professional.cvData, "base64");
    } catch (decodeErr) {
      console.error("CV decode error:", decodeErr);
      return NextResponse.json(
        {
          error: "Error al decodificar el CV",
          detail: "El cvData guardado no es base64 válido",
          cvFileName: professional.cvFileName,
          cvDataLength: professional.cvData.length,
        },
        { status: 500 }
      );
    }

    // Validar que el buffer no esté vacío
    if (buffer.length === 0) {
      return NextResponse.json(
        {
          error: "El CV está vacío",
          detail: "El cvData decodificado resultó en un buffer de 0 bytes",
          cvFileName: professional.cvFileName,
        },
        { status: 500 }
      );
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": professional.cvMimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${professional.cvFileName || "cv.pdf"}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("CV download error:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        error: "Error al obtener el CV",
        detail: errorMessage,
      },
      { status: 500 }
    );
  }
}
