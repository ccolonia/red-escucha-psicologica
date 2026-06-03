import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/patient-requests — Create a new patient request (public or authenticated)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, modality, reason, notes } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Nombre y email son obligatorios" },
        { status: 400 }
      );
    }

    const patientRequest = await db.patientRequest.create({
      data: {
        name,
        email,
        phone: phone || null,
        modality: modality || "presencial",
        reason: reason || "consulta_general",
        notes: notes || null,
        status: "pending",
      },
    });

    return NextResponse.json(patientRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating patient request:", error);
    return NextResponse.json(
      { error: "Error al crear la solicitud" },
      { status: 500 }
    );
  }
}

// GET /api/patient-requests — List all patient requests (admin only, auth handled by proxy)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = status ? { status } : {};

    const requests = await db.patientRequest.findMany({
      where,
      include: {
        assignedTo: {
          include: {
            user: {
              select: { name: true, email: true, phone: true },
            },
          },
        },
        appointment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching patient requests:", error);
    return NextResponse.json(
      { error: "Error al obtener solicitudes" },
      { status: 500 }
    );
  }
}
