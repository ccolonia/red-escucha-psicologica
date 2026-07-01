import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// === PUT /api/patients/[id]/notes ===
// Guarda (o actualiza) las notas privadas del profesional sobre un paciente.
//
// Reglas de acceso:
//   - Solo rol "professional" puede llamar este endpoint.
//   - El profesional solo puede guardar notas sobre pacientes que tengan (o
//     hayan tenido) turnos con él. Si intentan guardarlo sobre un paciente que
//     no es "suyo", se rechaza con 403.
//   - El campo `content` es texto libre. Se persiste con upsert sobre la
//     combinación única (professionalId, patientId), así que no hay duplicados.
//
// Cuerpo de la request:
//   { "content": "texto libre..." }
//
// Respuesta:
//   200 OK → { ok: true, content, updatedAt }
//   400    → { error: "..." } (content ausente o no es string)
//   401    → { error: "No autenticado" }
//   403    → { error: "No autorizado / paciente no asignado a este profesional" }
//   500    → { error: "Error al guardar la nota" }

const MAX_CONTENT_LENGTH = 10000; // 10k caracteres es razonable para notas clínicas

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = (session.user as { role: string }).role;
    if (role !== "professional") {
      return NextResponse.json(
        { error: "Solo los profesionales pueden guardar notas privadas" },
        { status: 403 }
      );
    }

    const { id: patientId } = await params;

    // Parsear body de forma segura
    let body: { content?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo de la request inválido" },
        { status: 400 }
      );
    }

    const content =
      typeof body.content === "string" ? body.content : String(body.content ?? "");

    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `El contenido excede el máximo de ${MAX_CONTENT_LENGTH} caracteres` },
        { status: 400 }
      );
    }

    // Obtener el profesional asociado al usuario autenticado
    const professional = await db.professional.findUnique({
      where: { userId: session.user.id },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 403 }
      );
    }

    // Validar que el paciente tenga (o haya tenido) turnos con este profesional.
    // Esto evita que un profesional escriba notas sobre un paciente que no es "suyo".
    const hasAppointments = await db.appointment.findFirst({
      where: { patientId, professionalId: professional.id },
      select: { id: true },
    });

    if (!hasAppointments) {
      return NextResponse.json(
        {
          error:
            "No tenés turnos registrados con este paciente. No se pueden guardar notas privadas sobre un paciente que no es tuyo.",
        },
        { status: 403 }
      );
    }

    // Upsert: si existe la nota, la actualiza; si no, la crea.
    const note = await db.professionalPatientNote.upsert({
      where: {
        professionalId_patientId: {
          professionalId: professional.id,
          patientId,
        },
      },
      update: { content },
      create: {
        professionalId: professional.id,
        patientId,
        content,
      },
      select: { content: true, updatedAt: true },
    });

    return NextResponse.json({
      ok: true,
      content: note.content,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error("Save patient note error:", error);
    return NextResponse.json(
      { error: "Error al guardar la nota" },
      { status: 500 }
    );
  }
}

// === GET /api/patients/[id]/notes ===
// Devuelve la nota privada del profesional autenticado sobre el paciente [id].
// Útil si en el futuro se quiere cargar bajo demanda en vez de junto con /api/patients.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = (session.user as { role: string }).role;
    if (role !== "professional") {
      return NextResponse.json(
        { error: "Solo los profesionales pueden leer notas privadas" },
        { status: 403 }
      );
    }

    const { id: patientId } = await params;

    const professional = await db.professional.findUnique({
      where: { userId: session.user.id },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 403 }
      );
    }

    const note = await db.professionalPatientNote.findUnique({
      where: {
        professionalId_patientId: {
          professionalId: professional.id,
          patientId,
        },
      },
      select: { content: true, updatedAt: true },
    });

    return NextResponse.json({
      content: note?.content ?? "",
      updatedAt: note?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Get patient note error:", error);
    return NextResponse.json(
      { error: "Error al obtener la nota" },
      { status: 500 }
    );
  }
}
