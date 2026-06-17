import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/attendance-sheets — list sheets for the logged-in professional (or all for admin)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as { id: string; role: string };
  const url = new URL(req.url);
  const professionalId = url.searchParams.get("professionalId");
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");
  const csv = url.searchParams.get("csv");

  // Determine which professional's sheets to fetch
  let targetProfessionalId = professionalId;

  if (user.role !== "admin" && user.role !== "super_admin") {
    // Professional can only see their own sheets
    const prof = await db.professional.findUnique({ where: { userId: user.id } });
    if (!prof) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    targetProfessionalId = prof.id;
  }

  const where: any = {};
  if (targetProfessionalId) where.professionalId = targetProfessionalId;
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);

  const sheets = await db.attendanceSheet.findMany({
    where,
    include: {
      professional: { include: { user: { select: { name: true } } } },
      sessions: { orderBy: [{ weekNumber: "asc" }, { date: "asc" }] },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  // Best-effort match: para cada sesión, intentar resolver el contacto
  // (email + phone) del paciente a partir del nombre. Como AttendanceSession
  // guarda patientName como string libre (sin FK a Patient), hacemos match
  // por nombre exacto (case-insensitive) contra pacientes que tengan al
  // menos un appointment con el profesional de la planilla.
  //
  // Reglas:
  //   - 0 matches  → patientEmail=null, patientPhone=null
  //   - 1 match    → patientEmail/phone del User del Patient
  //   - 2+ matches (mismo nombre para el mismo profesional) → ambiguous → null
  //   - El CSV export NO se toca (mantener formato original)
  const allProfessionalIds = [...new Set(sheets.map(s => s.professionalId))];
  // Map<professionalId, Map<normalizedName, {email, phone} | null>>
  // null dentro del inner map = ambiguo
  const contactMap = new Map<string, Map<string, { email: string; phone: string | null } | null>>();

  if (allProfessionalIds.length > 0) {
    const patients = await db.patient.findMany({
      where: {
        appointments: { some: { professionalId: { in: allProfessionalIds } } },
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        appointments: {
          where: { professionalId: { in: allProfessionalIds } },
          select: { professionalId: true },
        },
      },
    });

    for (const p of patients) {
      const normalizedName = p.user.name.trim().toLowerCase();
      const profIds = new Set(p.appointments.map(a => a.professionalId));
      for (const profId of profIds) {
        if (!contactMap.has(profId)) contactMap.set(profId, new Map());
        const inner = contactMap.get(profId)!;
        if (inner.has(normalizedName)) {
          // Ya hay otro paciente con el mismo nombre para este profesional → ambiguo
          inner.set(normalizedName, null);
        } else {
          inner.set(normalizedName, { email: p.user.email, phone: p.user.phone });
        }
      }
    }
  }

  // Función helper para enriquecer una sesión con contacto del paciente
  const enrichSession = (s: any, professionalId: string) => {
    const inner = contactMap.get(professionalId);
    const normalizedName = (s.patientName || "").trim().toLowerCase();
    const match = inner?.get(normalizedName);
    return {
      ...s,
      patientEmail: match?.email ?? null,
      patientPhone: match?.phone ?? null,
    };
  };

  // CSV export (no se enriquece con contacto — mantener formato original)
  if (csv === "1" && targetProfessionalId && month && year) {
    const sheet = sheets[0];
    if (!sheet) return NextResponse.json({ error: "Planilla no encontrada" }, { status: 404 });

    const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const profName = sheet.professional.user.name;

    let csvContent = `PROFESIONAL:;${profName}\n`;
    csvContent += `MES:;${MONTHS[sheet.month - 1]} ${sheet.year}\n`;
    csvContent += `COMISIÓN REP:;${Math.round(sheet.repCommission * 100)}%\n\n`;
    csvContent += `Fecha;Paciente;Modo;Fecha Inicio Trat;Frecuencia;Honorario Paciente;Honorario Profesional;Comisión REP;CA;SA;Motivo Inasistencia;Supervisión;Suspendió Tratamiento;Semana\n`;

    for (const s of sheet.sessions) {
      const dateFormatted = s.date;
      const mode = s.mode === "P" ? "Presencial" : "Online";
      const ca = s.absentWithNotice ? "X" : "";
      const sa = s.absentWithoutNotice ? "X" : "";
      const sup = s.supervised ? "Sí" : "No";
      const suspended = s.suspendedTreatment ? "Sí" : "No";

      csvContent += `${dateFormatted};${s.patientName};${mode};${s.treatmentStartDate || ""};${s.frequency || ""};${s.patientFee};${s.professionalFee};${s.repFee};${ca};${sa};${s.absentReason || ""};${sup};${suspended};Semana ${s.weekNumber}\n`;
    }

    // Summary
    const totalSessions = sheet.sessions.filter(s => !s.absentWithNotice && !s.absentWithoutNotice).length;
    const totalAbsent = sheet.sessions.filter(s => s.absentWithNotice || s.absentWithoutNotice).length;
    const totalProfFee = sheet.sessions.reduce((sum, s) => sum + s.professionalFee, 0);
    const totalRepFee = sheet.sessions.reduce((sum, s) => sum + s.repFee, 0);
    const totalSupervised = sheet.sessions.filter(s => s.supervised).length;

    csvContent += `\nRESUMEN\n`;
    csvContent += `Sesiones:;${totalSessions}\n`;
    csvContent += `Inasistencias:;${totalAbsent}\n`;
    csvContent += `Honorario Profesional:;$${totalProfFee.toLocaleString("es-AR")}\n`;
    csvContent += `Total Cobrado:;$${(totalProfFee + totalRepFee).toLocaleString("es-AR")}\n`;
    csvContent += `Comisión REP:;$${totalRepFee.toLocaleString("es-AR")}\n`;
    csvContent += `Supervisiones:;${totalSupervised}\n`;

    const filename = `Planilla_${profName.replace(/\s+/g, "_")}_${MONTHS[sheet.month - 1]}_${sheet.year}.csv`;
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  }

  // JSON response: enriquecer cada sesión con patientEmail y patientPhone
  const enrichedSheets = sheets.map(sheet => ({
    ...sheet,
    sessions: sheet.sessions.map(s => enrichSession(s, sheet.professionalId)),
  }));

  return NextResponse.json(enrichedSheets);
}

// POST /api/attendance-sheets — create or update a sheet with sessions
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { id: string; role: string };
    const body = await req.json();
    const { professionalId, month, year, repCommission, sessions } = body;

    // Determine the professional
    let targetProfessionalId = professionalId;
    if (user.role !== "admin" && user.role !== "super_admin") {
      const prof = await db.professional.findUnique({ where: { userId: user.id } });
      if (!prof) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
      targetProfessionalId = prof.id;
    }

    if (!targetProfessionalId || !month || !year) {
      return NextResponse.json({ error: "Faltan datos obligatorios (professionalId, month, year)" }, { status: 400 });
    }

    const monthInt = parseInt(String(month));
    const yearInt = parseInt(String(year));
    const commission = repCommission || 0.30;

    // Upsert the sheet
    const sheet = await db.attendanceSheet.upsert({
      where: {
        professionalId_month_year: {
          professionalId: targetProfessionalId,
          month: monthInt,
          year: yearInt,
        },
      },
      create: {
        professionalId: targetProfessionalId,
        month: monthInt,
        year: yearInt,
        repCommission: commission,
      },
      update: {
        repCommission: commission,
      },
    });

    // Delete existing sessions and recreate
    if (sessions && Array.isArray(sessions)) {
      await db.attendanceSession.deleteMany({ where: { sheetId: sheet.id } });

      const sessionsData = sessions.map((s: any) => {
        const isAbsent = s.absentWithNotice || s.absentWithoutNotice;
        const patientFee = isAbsent ? 0 : (parseInt(s.patientFee) || 0);
        const professionalFee = isAbsent ? 0 : Math.round(patientFee * (1 - commission));
        const repFee = isAbsent ? 0 : (patientFee - professionalFee);

        return {
          sheetId: sheet.id,
          date: s.date || "",
          patientName: s.patientName || "",
          mode: s.mode || "P",
          treatmentStartDate: s.treatmentStartDate || null,
          frequency: s.frequency || null,
          patientFee,
          professionalFee,
          repFee,
          absentWithNotice: s.absentWithNotice || false,
          absentWithoutNotice: s.absentWithoutNotice || false,
          absentReason: s.absentReason || null,
          supervised: s.supervised || false,
          suspendedTreatment: s.suspendedTreatment || false,
          weekNumber: s.weekNumber || 1,
        };
      });

      await db.attendanceSession.createMany({ data: sessionsData });
    }

    // Return the updated sheet with sessions
    const updatedSheet = await db.attendanceSheet.findUnique({
      where: { id: sheet.id },
      include: {
        professional: { include: { user: { select: { name: true } } } },
        sessions: { orderBy: [{ weekNumber: "asc" }, { date: "asc" }] },
      },
    });

    return NextResponse.json(updatedSheet);
  } catch (error: any) {
    console.error("Attendance sheet save error:", error);
    return NextResponse.json(
      { error: "Error al guardar planilla: " + (error.message || "Error desconocido") },
      { status: 500 }
    );
  }
}
