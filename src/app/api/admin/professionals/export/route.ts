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

    const professionals = await db.professional.findMany({
      select: {
        id: true,
        license: true,
        licenseVerified: true,
        specialty: true,
        title: true,
        profession: true,
        therapyTypes: true,
        targetAudience: true,
        therapyModality: true,
        onlineAttention: true,
        presentialAttention: true,
        homeAttention: true,
        zones: true,
        cvFileName: true,
        internalNotes: true,
        evaluationStatus: true,
        createdAt: true,
        user: {
          select: { name: true, email: true, phone: true, active: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    // Helper to safely parse JSON fields
    const parseJsonField = (field: string | null): string => {
      if (!field) return "";
      try {
        const parsed = JSON.parse(field);
        if (Array.isArray(parsed)) return parsed.join(", ");
        return String(parsed);
      } catch {
        return field;
      }
    };

    // Build modality description
    const getModality = (p: typeof professionals[0]): string => {
      const modalities: string[] = [];
      if (p.onlineAttention) modalities.push("Online");
      if (p.presentialAttention) modalities.push("Presencial");
      if (p.homeAttention) modalities.push("Domicilio");
      return modalities.length > 0 ? modalities.join(", ") : "No especificada";
    };

    // Build evaluation status display
    const getEvaluationDisplay = (p: typeof professionals[0]): string => {
      const parts: string[] = [];
      if (p.licenseVerified) parts.push("✓");
      if (p.cvFileName) parts.push("CV");
      if (p.evaluationStatus) parts.push(p.evaluationStatus);
      return parts.length > 0 ? parts.join(" | ") : "Sin evaluar";
    };

    // Escape CSV fields (handle quotes, commas, newlines)
    const escapeCsv = (value: string): string => {
      if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // CSV Headers
    const headers = [
      "Nombre y Apellido",
      "Matrícula",
      "Teléfono",
      "Especialidad",
      "Orientación Teórica",
      "Población Atendida",
      "Modalidad de Atención",
      "Observaciones Internas",
      "Ciudad / Zona Geográfica",
      "Estado de Evaluación",
    ];

    // Build CSV rows
    const rows = professionals.map((p) => [
      escapeCsv(p.user.name || ""),
      escapeCsv(p.license || ""),
      escapeCsv(p.user.phone || ""),
      escapeCsv(p.specialty || ""),
      escapeCsv(parseJsonField(p.therapyTypes)),
      escapeCsv(parseJsonField(p.targetAudience)),
      escapeCsv(getModality(p)),
      escapeCsv(p.internalNotes || ""),
      escapeCsv(parseJsonField(p.zones)),
      escapeCsv(getEvaluationDisplay(p)),
    ]);

    // Assemble CSV with BOM UTF-8
    const csvContent = "\ufeff" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=profesionales-rep.csv",
      },
    });
  } catch (error) {
    console.error("Export professionals error:", error);
    return NextResponse.json(
      { error: "Error al exportar profesionales" },
      { status: 500 }
    );
  }
}
