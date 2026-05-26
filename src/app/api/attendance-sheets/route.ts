import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

// GET /api/attendance-sheets — list sheets for the logged-in professional (or all for admin)
export async function GET(req: NextRequest) {
  const session = await getServerSession();
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

  // CSV export
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

  return NextResponse.json(sheets);
}

// POST /api/attendance-sheets — create or update a sheet with sessions
export async function POST(req: NextRequest) {
  const session = await getServerSession();
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
    return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
  }

  // Upsert the sheet
  const sheet = await db.attendanceSheet.upsert({
    where: {
      professionalId_month_year: {
        professionalId: targetProfessionalId,
        month: parseInt(month),
        year: parseInt(year),
      },
    },
    create: {
      professionalId: targetProfessionalId,
      month: parseInt(month),
      year: parseInt(year),
      repCommission: repCommission || 0.30,
    },
    update: {
      repCommission: repCommission || 0.30,
    },
  });

  // Delete existing sessions and recreate
  if (sessions && Array.isArray(sessions)) {
    await db.attendanceSession.deleteMany({ where: { sheetId: sheet.id } });

    const sessionsData = sessions.map((s: any) => {
      const patientFee = s.absentWithNotice || s.absentWithoutNotice ? 0 : (s.patientFee || 0);
      const commission = repCommission || 0.30;
      const professionalFee = Math.round(patientFee * (1 - commission));
      const repFee = patientFee - professionalFee;

      return {
        sheetId: sheet.id,
        date: s.date,
        patientName: s.patientName,
        mode: s.mode || "P",
        treatmentStartDate: s.treatmentStartDate || null,
        frequency: s.frequency || null,
        patientFee: s.absentWithNotice || s.absentWithoutNotice ? 0 : (s.patientFee || 0),
        professionalFee: s.absentWithNotice || s.absentWithoutNotice ? 0 : professionalFee,
        repFee: s.absentWithNotice || s.absentWithoutNotice ? 0 : repFee,
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
}
