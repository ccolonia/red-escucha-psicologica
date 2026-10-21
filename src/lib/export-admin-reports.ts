"use client";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ============================================================================
// REPORTE 1: HONORARIOS PACIENTES (Estructura Matricial por Meses)
// ============================================================================
// Replica la planilla histórica de honorarios con columnas mensuales evolutivas:
//   - Título: "HONORARIOS PACIENTES"
//   - Encabezados: Paciente | Inicio | Frecuencia | Mes Aprox | % | Anterior
//     | Ene | Feb | Mar | Abr | May | Jun | Jul | Ago | Sep | Oct | Nov | Dic
//   - Fila de totales al pie con sumatoria por mes

const toARGB = (hex: string): string => {
  const clean = hex.replace("#", "").toUpperCase();
  if (clean.length === 8) return clean;
  if (clean.length === 6) return `FF${clean}`;
  return "FF000000";
};

const MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

interface PatientFeeRow {
  patientName: string;
  startDate: string;
  frequency: string;
  approxMonth: string;
  percentage: number;
  previousAmount: number;
  previousMonthLabel: string;
  monthlyFees: (number | null)[]; // 12 valores, uno por mes (null si no hubo cobro)
}

export async function exportPatientFeesToExcel(data: PatientFeeRow[], year: number) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Red Escucha Psicológica";
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet("Honorarios Pacientes", {
    properties: { defaultRowHeight: 18, tabColor: { argb: toARGB("047857") } },
    views: [{ showGridLines: false }],
  });

  // === Título ===
  ws.mergeCells("A1:R1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "HONORARIOS PACIENTES";
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: toARGB("065F46") } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:R2");
  const subtitleCell = ws.getCell("A2");
  subtitleCell.value = `Año ${year}`;
  subtitleCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: toARGB("475569") } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 18;

  // === Encabezados ===
  const headers = [
    "PACIENTES PARTICULARES", "INICIO", "FRECUENCIA", "MES APROX", "%", "ANTERIOR",
    ...MONTHS,
  ];
  headers.forEach((header, idx) => {
    const cell = ws.getCell(4, idx + 1);
    cell.value = header;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: toARGB("FFFFFF") } };
    cell.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB("047857") }, fgColor: { argb: toARGB("047857") } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: toARGB("047857") } },
      left: { style: "thin", color: { argb: toARGB("047857") } },
      bottom: { style: "thin", color: { argb: toARGB("047857") } },
      right: { style: "thin", color: { argb: toARGB("047857") } },
    };
  });
  ws.getRow(4).height = 28;

  // === Datos ===
  const startRow = 5;
  data.forEach((row, idx) => {
    const rowNum = startRow + idx;
    const isAlt = idx % 2 === 1;
    const bg = isAlt ? "F8FAFC" : "FFFFFF";

    // Paciente
    const c1 = ws.getCell(rowNum, 1);
    c1.value = row.patientName;
    c1.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB("065F46") } };
    c1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c1.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB(bg) }, fgColor: { argb: toARGB(bg) } };

    // Inicio
    const c2 = ws.getCell(rowNum, 2);
    c2.value = row.startDate;
    c2.font = { name: "Calibri", size: 10, color: { argb: toARGB("475569") } };
    c2.alignment = { vertical: "middle", horizontal: "center" };
    c2.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB(bg) }, fgColor: { argb: toARGB(bg) } };

    // Frecuencia
    const c3 = ws.getCell(rowNum, 3);
    c3.value = row.frequency;
    c3.font = { name: "Calibri", size: 10, color: { argb: toARGB("475569") } };
    c3.alignment = { vertical: "middle", horizontal: "center" };
    c3.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB(bg) }, fgColor: { argb: toARGB(bg) } };

    // Mes Aprox
    const c4 = ws.getCell(rowNum, 4);
    c4.value = row.approxMonth;
    c4.font = { name: "Calibri", size: 10, color: { argb: toARGB("475569") } };
    c4.alignment = { vertical: "middle", horizontal: "center" };
    c4.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB(bg) }, fgColor: { argb: toARGB(bg) } };

    // %
    const c5 = ws.getCell(rowNum, 5);
    c5.value = row.percentage;
    c5.numFmt = "0%";
    c5.font = { name: "Calibri", size: 10, color: { argb: toARGB("475569") } };
    c5.alignment = { vertical: "middle", horizontal: "center" };
    c5.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB(bg) }, fgColor: { argb: toARGB(bg) } };

    // Anterior
    const c6 = ws.getCell(rowNum, 6);
    c6.value = row.previousAmount > 0 ? `${row.previousMonthLabel} ${row.previousAmount}` : "";
    c6.font = { name: "Calibri", size: 10, color: { argb: toARGB("475569") } };
    c6.alignment = { vertical: "middle", horizontal: "right" };
    c6.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB(bg) }, fgColor: { argb: toARGB(bg) } };

    // Mensual (12 columnas)
    for (let m = 0; m < 12; m++) {
      const cell = ws.getCell(rowNum, 7 + m);
      const fee = row.monthlyFees[m];
      if (fee !== null && fee !== undefined) {
        cell.value = fee;
        cell.numFmt = '"$" #,##0';
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB("065F46") } };
      } else {
        cell.value = "";
      }
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB(bg) }, fgColor: { argb: toARGB(bg) } };
    }

    ws.getRow(rowNum).height = 18;
  });

  // === Fila de Totales ===
  const totalRowNum = startRow + data.length;
  const totalLabelCell = ws.getCell(totalRowNum, 1);
  totalLabelCell.value = "TOTALES";
  totalLabelCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: toARGB("FFFFFF") } };
  totalLabelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  totalLabelCell.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB("047857") }, fgColor: { argb: toARGB("047857") } };

  // Fórmulas SUM para cada mes
  for (let m = 0; m < 12; m++) {
    const colLetter = String.fromCharCode(71 + m); // G=7, H=8, ...
    const cell = ws.getCell(totalRowNum, 7 + m);
    if (data.length > 0) {
      cell.value = { formula: `SUM(${colLetter}${startRow}:${colLetter}${startRow + data.length - 1})` };
    } else {
      cell.value = 0;
    }
    cell.numFmt = '"$" #,##0';
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: toARGB("FFFFFF") } };
    cell.alignment = { vertical: "middle", horizontal: "right" };
    cell.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB("047857") }, fgColor: { argb: toARGB("047857") } };
  }
  ws.getRow(totalRowNum).height = 26;

  // === Auto-fit ===
  const colWidths = [30, 12, 14, 12, 6, 18, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Freeze panes
  ws.views = [{ showGridLines: false, topLeftCell: "A5", xSplit: 0, ySplit: 4, activeCell: "A5", state: "frozen" }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `honorarios_pacientes_${year}.xlsx`);
}

// ============================================================================
// REPORTE 2: DIRECTORIO DE PROFESIONALES (Zonas y Direcciones)
// ============================================================================

interface ProfessionalDirectoryRow {
  id: string;
  name: string;
  title: string;
  license: string;
  specialty: string;
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  zones: string[];
  officeAddress: string;
  phone: string;
  email: string;
  active: boolean;
}

export async function exportProfessionalDirectoryToExcel(data: ProfessionalDirectoryRow[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Red Escucha Psicológica";
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet("Directorio Profesionales", {
    properties: { defaultRowHeight: 18, tabColor: { argb: toARGB("047857") } },
    views: [{ showGridLines: false }],
  });

  // === Título ===
  ws.mergeCells("A1:I1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "DIRECTORIO DE PROFESIONALES — RED ESCUCHA PSICOLÓGICA";
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: toARGB("065F46") } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 28;

  // === Encabezados ===
  const headers = [
    "ID", "Profesional", "Matrícula", "Especialidad", "Modalidad",
    "Zona / Barrio / Localidad", "Dirección Consultorio", "Teléfono", "Email",
  ];
  headers.forEach((header, idx) => {
    const cell = ws.getCell(3, idx + 1);
    cell.value = header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB("FFFFFF") } };
    cell.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB("047857") }, fgColor: { argb: toARGB("047857") } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: toARGB("047857") } },
      left: { style: "thin", color: { argb: toARGB("047857") } },
      bottom: { style: "thin", color: { argb: toARGB("047857") } },
      right: { style: "thin", color: { argb: toARGB("047857") } },
    };
  });
  ws.getRow(3).height = 28;

  // === Datos ===
  const startRow = 4;
  data.forEach((row, idx) => {
    const rowNum = startRow + idx;
    const isAlt = idx % 2 === 1;
    const bg = isAlt ? "F8FAFC" : "FFFFFF";
    const isActive = row.active;

    const modalities: string[] = [];
    if (row.onlineAttention) modalities.push("Online");
    if (row.presentialAttention) modalities.push("Presencial");
    if (row.homeAttention) modalities.push("Domicilio");

    const zonesStr = row.zones.join(", ");
    const titleName = row.title ? `${row.title} ${row.name}` : row.name;

    const values = [
      row.id.substring(0, 8),
      titleName,
      row.license,
      row.specialty,
      modalities.join(" / ") || "—",
      zonesStr || "—",
      row.officeAddress || "—",
      row.phone || "—",
      row.email || "—",
    ];

    values.forEach((val, colIdx) => {
      const cell = ws.getCell(rowNum, colIdx + 1);
      cell.value = val;
      cell.font = {
        name: "Calibri", size: 10,
        color: { argb: isActive ? toARGB("000000") : toARGB("9CA3AF") },
      };
      cell.alignment = { vertical: "middle", horizontal: colIdx === 1 ? "left" : "center", indent: colIdx === 1 ? 1 : 0 };
      cell.fill = { type: "pattern", pattern: "solid", bgColor: { argb: toARGB(bg) }, fgColor: { argb: toARGB(bg) } };
      cell.border = {
        top: { style: "thin", color: { argb: toARGB("E2E8F0") } },
        left: { style: "thin", color: { argb: toARGB("E2E8F0") } },
        bottom: { style: "thin", color: { argb: toARGB("E2E8F0") } },
        right: { style: "thin", color: { argb: toARGB("E2E8F0") } },
      };
    });

    ws.getRow(rowNum).height = 18;
  });

  // === Auto-fit ===
  const colWidths = [12, 30, 16, 22, 18, 28, 35, 18, 28];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Freeze panes
  ws.views = [{ showGridLines: false, topLeftCell: "A4", xSplit: 0, ySplit: 3, activeCell: "A4", state: "frozen" }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `directorio_profesionales_${new Date().toLocaleDateString("sv-SE")}.xlsx`);
}
