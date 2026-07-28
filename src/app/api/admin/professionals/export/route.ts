import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";

// === GET /api/admin/professionals/export ===
// Exporta TODOS los profesionales en formato .xlsx (Excel nativo) con 4 pestañas,
// tablas nativas con estilos REP (verde esmeralda), zebra striping, auto-filtro,
// bordes y auto-fit de columnas.

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

    // === Traer TODOS los profesionales ===
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
      const m: string[] = [];
      if (p.onlineAttention) m.push("Online");
      if (p.presentialAttention) m.push("Presencial");
      if (p.homeAttention) m.push("Domicilio");
      return m.length > 0 ? m.join(", ") : "No especificada";
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

    // === Definición de columnas ===
    // alignment: 'left' para textos largos, 'center' para cortos/estados
    type ColumnDef = {
      header: string;
      key: string;
      width: number;
      alignment: "left" | "center";
    };

    const columnDefs: ColumnDef[] = [
      { header: "Nombre y Apellido", key: "name", width: 30, alignment: "left" },
      { header: "Estado de Cuenta", key: "status", width: 15, alignment: "center" },
      { header: "Verificación", key: "verification", width: 15, alignment: "center" },
      { header: "Matrícula / Licencia", key: "license", width: 18, alignment: "center" },
      { header: "Email", key: "email", width: 35, alignment: "left" },
      { header: "Teléfono", key: "phone", width: 18, alignment: "center" },
      { header: "Profesión", key: "profession", width: 15, alignment: "left" },
      { header: "Especialidad", key: "specialty", width: 25, alignment: "left" },
      { header: "Modalidad de Atención", key: "modality", width: 22, alignment: "left" },
      { header: "Población Atendida", key: "audience", width: 30, alignment: "left" },
      { header: "Zonas de Atención", key: "zones", width: 30, alignment: "left" },
      { header: "Dirección de Consultorio", key: "address", width: 40, alignment: "left" },
      { header: "Fecha de Registro", key: "registered", width: 16, alignment: "center" },
    ];

    // === Mapear profesional → objeto plano ===
    const mapToRow = (p: (typeof professionals)[0]) => ({
      name: p.user.name || "",
      status: getAccountStatus(p),
      verification: getVerification(p),
      license: p.license || "",
      email: p.user.email || "",
      phone: p.user.phone || "",
      profession: p.profession || "",
      specialty: p.specialty || "",
      modality: getModality(p),
      audience: parseJsonField(p.targetAudience),
      zones: parseJsonField(p.zones),
      address: getConsultorioAddress(p),
      registered: getRegistrationDate(p),
    });

    // === Filtrar por estado ===
    const allData = professionals.map(mapToRow);
    const approvedData = professionals.filter((p) => p.user.active && p.user.isApproved).map(mapToRow);
    const pendingData = professionals.filter((p) => !p.user.active).map(mapToRow);
    const unverifiedData = professionals.filter((p) => !p.licenseVerified).map(mapToRow);

    // === Crear Workbook ===
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Red Escucha Psicológica";
    workbook.created = new Date();

    // === Helper: crear hoja con tabla nativa y estilos REP ===
    const createStyledSheet = (
      data: ReturnType<typeof mapToRow>[],
      sheetName: string
    ) => {
      const ws = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
      });

      // Definir columnas
      ws.columns = columnDefs.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width,
      }));

      // === Header row styling ===
      const headerRow = ws.getRow(1);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F766E" }, // Teal esmeralda REP
        };
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" }, // Blanco
          size: 11,
          name: "Calibri",
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });

      // === Data rows ===
      if (data.length === 0) {
        // Si no hay datos, agregar una fila vacía con mensaje
        const emptyRow = ws.addRow({});
        emptyRow.getCell(1).value = "Sin datos en esta categoría";
        emptyRow.getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
        emptyRow.getCell(1).alignment = { horizontal: "center" };
        // Merge cells across all columns
        ws.mergeCells(1, 1, 1, columnDefs.length);
      } else {
        for (let i = 0; i < data.length; i++) {
          const row = ws.addRow(data[i]);
          const rowNum = row.number;

          // Zebra striping: filas pares = blanco, impares = verde muy suave
          const bgColor = i % 2 === 0 ? "FFFFFFFF" : "FFF0FDF4"; // blanco / verde-50

          row.eachCell((cell, colNumber) => {
            const colDef = columnDefs[colNumber - 1];
            cell.alignment = {
              horizontal: colDef?.alignment || "left",
              vertical: "middle",
              wrapText: false,
            };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: bgColor },
            };
            cell.font = {
              size: 10,
              name: "Calibri",
              color: { argb: "FF1F2937" }, // slate-800
            };
            cell.border = {
              top: { style: "thin", color: { argb: "FFE5E7EB" } },
              bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
              left: { style: "thin", color: { argb: "FFE5E7EB" } },
              right: { style: "thin", color: { argb: "FFE5E7EB" } },
            };
          });

          // Auto-fit: recalcular ancho de columna basado en contenido
          row.eachCell((cell, colNumber) => {
            const colDef = columnDefs[colNumber - 1];
            const cellText = String(cell.value || "");
            const currentWidth = colDef?.width || 15;
            const neededWidth = Math.min(Math.max(cellText.length + 4, 12), 50);
            if (neededWidth > currentWidth) {
              ws.getColumn(colNumber).width = neededWidth;
            }
          });
        }
      }

      // === Auto-filtro en la fila de cabecera ===
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columnDefs.length },
      };

      // === Freeze panes: congelar la primera fila ===
      ws.views = [{ showGridLines: true, state: "frozen", ySplit: 1 }];
    };

    // === Crear las 4 hojas ===
    createStyledSheet(allData, "Todos");
    createStyledSheet(approvedData, "Aprobados");
    createStyledSheet(pendingData, "Pendientes");
    createStyledSheet(unverifiedData, "Sin Verificar");

    // === Generar buffer .xlsx ===
    const buffer = await workbook.xlsx.writeBuffer();

    // === Nombre de archivo dinámico ===
    const today = new Date().toISOString().split("T")[0];
    const filename = `profesionales_REP_${today}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
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
