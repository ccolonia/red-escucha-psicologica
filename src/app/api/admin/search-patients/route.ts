import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/search-patients?q=...
//
// Búsqueda cruzada para el combobox de la Agenda Central:
// 1. Busca en Patient (pacientes formales con ficha)
// 2. Busca en PatientRequest con status "pending" (solicitudes de triage
//    que están esperando asignación — son los "leads" del form público)
// 3. Busca en ContactRequest con reason "solicitar_turno" y status no resuelto
//    (cuando el usuario manda el form /contacto con motivo "solicitar_turno",
//    se crea una ContactRequest — también es un lead para asignación)
//
// Devuelve top 10 resultados unificados con discriminador isLead:
//   - Pacientes formales: { id, name, email, phone, isLead: false }
//   - Solicitudes pendientes: { id, name, email, phone, isLead: true,
//     leadReason, leadModality, leadPatientAge, leadGuardianName, leadSource }
//
// El frontend usa isLead para mostrar "(Solicitud Online)" después del
// nombre y para que el backend de quick-assign sepa que debe hacer
// upsert de Patient + marcar el registro como "assigned"/"resuelto".

export async function GET(request: NextRequest) {
  unstable_noStore();

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
    const q = searchParams.get("q")?.trim() || "";

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    // === Consulta paralela: Patient + PatientRequest pending + ContactRequest solicitar_turno ===
    const [patients, leadRequests, contactTurnoRequests] = await Promise.all([
      // 1. Pacientes formales (ficha existente)
      db.patient.findMany({
        where: {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        take: 10,
        orderBy: { user: { name: "asc" } },
      }),
      // 2. Solicitudes de triage pendientes (leads del form público /api/patient-requests)
      db.patientRequest.findMany({
        where: {
          status: "pending",
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      // 3. Consultas de contacto con reason "solicitar_turno" (leads del form /api/contact)
      // Solo las que no están resueltas (status "nuevo" o "leido").
      // Si ya están "respondido" o "resuelto", no las mostramos como leads
      // porque ya fueron atendidas.
      db.contactRequest.findMany({
        where: {
          reason: "solicitar_turno",
          status: { in: ["nuevo", "leido"] },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // === Unificar resultados ===
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];

    // Pacientes formales (isLead: false)
    for (const p of patients) {
      results.push({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        phone: p.user.phone || "",
        isLead: false,
      });
    }

    // Solicitudes pendientes de PatientRequest (isLead: true, source: "patient_request")
    for (const r of leadRequests) {
      results.push({
        id: r.id,
        name: `${r.name} (Solicitud Online)`,
        email: r.email,
        phone: r.phone || "",
        isLead: true,
        leadReason: r.reason,
        leadModality: r.modality,
        leadPatientAge: r.patientAge,
        leadGuardianName: r.guardianName,
        leadSource: "patient_request",
      });
    }

    // Solicitudes de turno desde ContactRequest (isLead: true, source: "contact_request")
    // Estas vienen del form /contacto con reason "solicitar_turno".
    // Se muestran igual que las PatientRequest para que el admin pueda
    // asignarlas desde la Agenda Central.
    for (const c of contactTurnoRequests) {
      results.push({
        id: c.id,
        name: `${c.name} (Solicitud Online)`,
        email: c.email,
        phone: c.phone || "",
        isLead: true,
        leadReason: c.reason, // "solicitar_turno"
        leadModality: null, // ContactRequest no tiene campo modality
        leadPatientAge: null,
        leadGuardianName: null,
        leadNotes: c.message, // El mensaje del form de contacto
        leadSource: "contact_request",
      });
    }

    // Limitar a 10 resultados totales
    return NextResponse.json(results.slice(0, 10));
  } catch (error) {
    console.error("Error in search-patients:", error);
    return NextResponse.json(
      { error: "Error al buscar pacientes" },
      { status: 500 }
    );
  }
}
