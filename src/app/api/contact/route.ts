import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendContactNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message, reason, modality } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Nombre, email y mensaje son obligatorios" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "El formato del email no es válido" },
        { status: 400 }
      );
    }

    // Sanitize inputs (trim whitespace)
    const sanitizedData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      message: message.trim(),
      reason: reason || null,
      // Guardar modality cuando viene (solo para solicitar_turno)
      modality: modality || null,
    };

    const contact = await db.contactRequest.create({
      data: sanitizedData,
    });

    // Send email notification to contacto@redescuchapsicologica.com
    // This runs in the background - if it fails, the contact is still saved in DB
    try {
      await sendContactNotification(sanitizedData);
      console.log(`📧 Notificación de contacto enviada para: ${sanitizedData.name}`);
    } catch (emailError) {
      console.error("⚠️ Error enviando notificación de contacto (no bloqueante):", emailError);
    }

    // Log notification for server monitoring
    console.log(`📧 Nueva consulta de contacto: ${sanitizedData.name} (${sanitizedData.email}) - Motivo: ${sanitizedData.reason || "No especificado"}`);

    return NextResponse.json(
      { message: "Consulta enviada exitosamente", id: contact.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : "Error al enviar la consulta";
    return NextResponse.json(
      { error: "Error al enviar la consulta", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session.user as { role: string }).role;
    if (!session?.user || (role !== "admin" && role !== "super_admin")) {
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

