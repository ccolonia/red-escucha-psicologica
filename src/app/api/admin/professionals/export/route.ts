import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

// === GET /api/admin/professionals/export ===
// Exporta TODOS los profesionales en formato .xlsx (Excel nativo) con 4 pestañas:
// 1. Todos — lista completa
// 2. Aprobados — user.active=true
// 3. Pendientes — user.active=false (pendiente de aprobación)
// 4. Sin Verificar — licenseVerified=false
//
// Cada pestaña tiene las mismas columnas con formato limpio y ancho dinámico.

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

    // === Traer TODOS los profesionales con sus datos completos ===
    const professionals = await db.professional.findMany({
      select: {
        id: true,
        license: true,
        licenseVerified: true,
        specialty: true,
        profession: true,
        therapyTypes: true,
        targetAudience: true,
        therapyModality: true,
        onlineAttention: true,
        presentialAttention: true,
        homeAttention: true,
        zones: true,
        officeAddress: true,
        createdAt: true,
        user: {
          select: { name: true, email: true, phone: true, active: true, isApproved: true },
        },
        addresses: { select: { label: true, address: true, isActive: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    // === Helpers ===
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

    const getModality = (p: (typeof professionals)[0]): string => {
      const modalities: string[] = [];
      if (p.onlineAttention) modalities.push("Online");
      if (p.presentialAttention) modalities.push("Presencial");
      if (p.homeAttention) modalities.push("Domicilio");
      return modalities.length > 0 ? modalities.join(", ") : "No especificada";
    };

    const getAccountStatus = (p: (typeof professionals)[0]): string => {
      if (!p.user.active) return "Pendiente";
      if (p.user.isApproved) return "Aprobado";
      return "Activo";
    };

    const getVerification = (p: (typeof professionals)[0]): string => {
      return p.licenseVerified ? "Verificada" : "Sin verificar";
    };

    const getConsultorioAddress = (p: (typeof professionals)[0]): string => {
      // Priorizar ProfessionalAddress activa, luego officeAddress legacy
      const activeAddr = p.addresses?.find((a) => a.isActive);
      if (activeAddr) return `${activeAddr.label}: ${activeAddr.address}`;
      if (p.addresses && p.addresses.length > 0) return `${p.addresses[0].label}: ${p.addresses[0].address}`;
      if (p.officeAddress) return p.officeAddress;
      return "Sin dirección cargada";
    };

    const getRegistrationDate = (p: (typeof professionals)[0]): string => {
      if (!p.createdAt) return "";
      const d = new Date(p.createdAt);
      return d.toLocaleDateString("es-AR", { year: "numeric", month: "2-digit", day: "2-digit" });
    };

    // === Mapear profesional → fila de Excel ===
    const mapToRow = (p: (typeof professionals)[0]) => ({
      "Nombre y Apellido": p.user.name || "",
      "Estado de Cuenta": getAccountStatus(p),
      "Verificación": getVerification(p),
      "Matrícula / Licencia": p.license || "",
      "Email": p.user.email || "",
      "Teléfono": p.user.phone || "",
      "Profesión": p.profession || "",
      "Especialidad": p.specialty || "",
      "Modalidad de Atención": getModality(p),
      "Población Atendida": parseJsonField(p.targetAudience),
      "Zonas de Atención": parseJsonField(p.zones),
      "Dirección de Consultorio": getConsultorioAddress(p),
      "Fecha de Registro": getRegistrationDate(p),
    });

    // === Filtrar por estado para las 4 pestañas ===
    const allData = professionals.map(mapToRow);
    const approvedData = professionals.filter((p) => p.user.active && p.user.isApproved).map(mapToRow);
    const pendingData = professionals.filter((p) => !p.user.active).map(mapToRow);
    const unverifiedData = professionals.filter((p) => !p.licenseVerified).map(mapToRow);

    // === Crear Workbook con 4 hojas ===
    const wb = XLSX.utils.book_new();

    // Helper: crear hoja con ancho de columnas dinámico
    const createSheet = (data: ReturnType<typeof mapToRow>[], sheetName: string) => {
      const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{ "Nombre y Apellido": "Sin datos", "Estado de Cuenta": "" }]);

      // Calcular ancho dinámico de cada columna basado en el contenido más largo
      const colWidths: { wch: number }[] = [];
      if (data.length > 0) {
        const keys = Object.keys(data[0]);
        for (const key of keys) {
          // Ancho = max(header length, max cell content length) + 2 de padding
          const maxCellLen = Math.max(
            key.length,
            ...data.map((row) => String((row as Record<string, unknown>)[key] || "").length)
          );
          colWidths.push({ wch: Math.min(Math.max(maxCellLen + 2, 12), 50) }); // entre 12 y 50
        }
      } else {
        colWidths.push({ wch: 20 });
      }
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    createSheet(allData, "Todos");
    createSheet(approvedData, "Aprobados");
    createSheet(pendingData, "Pendientes");
    createSheet(unverifiedData, "Sin Verificar");

    // === Generar buffer .xlsx ===
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // === Nombre de archivo dinámico ===
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const filename = `profesionales_REP_${today}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buf.length.toString(),
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
