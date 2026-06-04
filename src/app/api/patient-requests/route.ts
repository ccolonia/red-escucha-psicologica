import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/patient-requests — Create a new patient request (public or authenticated)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { name, email, phone, modality, reason, notes } = body;

    // If authenticated patient, auto-fill from session
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const role = (session.user as { role: string }).role;
      if (role === "patient") {
        // Auto-fill from session if not provided
        if (!name) name = session.user.name || "";
        if (!email) email = session.user.email || "";
        // Get phone from user record if available
        if (!phone) {
          const user = await db.user.findUnique({
            where: { id: (session.user as { id: string }).id },
            select: { phone: true },
          });
          if (user?.phone) phone = user.phone;
        }
      }
    }

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
