"use client";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ============================================================================
// exportSettlementToExcel — Genera archivo .XLSX ejecutivo con estilos
// ============================================================================
//
// Estructura de la hoja:
//   Fila 1: Título institucional "RED ESCUCHA PSICOLÓGICA — LIQUIDACIÓN MENSUAL"
//   Fila 2: Subtítulo "Período: [Mes y Año]"
//   Fila 4-6: Bloque KPI con tarjetas de resumen (3 columnas)
//   Fila 8: Encabezado de tabla principal (verde esmeralda, blanco)
//   Fila 9+: Datos de cada profesional con colorimetría por columna
//   Última fila: Totales con fórmulas SUM() nativas de Excel
//
// Estilo: Glassmorphism contable tradicional, paleta REP (esmeralda + ámbar).
// Codificación UTF-8 nativa → acentos y caracteres especiales OK.
//
// ⚠️ CORRECCIÓN CRÍTICA (2026-09-30):
//   - Todos los colores ahora pasan por toARGB() para garantizar formato
//     ARGB de 8 dígitos sin numeral (ej: 'FF047857'). Esto evita que Excel
//     marque el archivo como corrupto.
//   - Las fórmulas SUM() ahora calculan el rango dinámicamente y solo se
//     insertan si hay filas de datos (si no hay, se escribe 0).
// ============================================================================

export interface SettlementRow {
  professionalId: string;
  professionalName: string;
  specialty: string;
  totalAppointments: number;
  attended: number;
  absent: number;
  rescheduled: number;
  cancelled: number;
  pending: number;
  confirmed: number;
  sessionFee: number;
  totalPatientFee: number;
  totalProfessionalFee: number;
  totalRepFee: number;
  hasSheet: boolean;
  repCommission: number;
}

export interface ExportSettlementParams {
  /** Filas de datos de liquidación (una por profesional) */
  data: SettlementRow[];
  /** Nombre del período para el subtítulo (ej: "Septiembre 2026") */
  periodName: string;
  /** Nombre del archivo a descargar (sin extensión, ej: "liquidacion_septiembre_2026") */
  fileName?: string;
}

// === Paleta institucional REP (HEX sin #) ===
const COLORS_HEX = {
  emeraldDark: "065F46",      // Título principal
  emeraldPrimary: "047857",    // Encabezados de tabla
  emeraldLight: "ECFDF5",     // Fondo KPI honorarios
  emeraldText: "047857",      // Texto verde honorarios
  amberLight: "FFFBEB",       // Fondo KPI comisión
  amberText: "B45309",        // Texto ámbar comisión
  amberBorder: "FDE68A",      // Borde ámbar
  slateHeader: "F1F5F9",      // Fondo subtítulo
  slateText: "475569",        // Texto subtítulo
  greenAttended: "10B981",    // Atendido
  yellowAbsent: "F59E0B",     // Ausente
  blueResched: "3B82F6",      // Reprogramado
  redCancelled: "EF4444",     // Cancelado
  white: "FFFFFF",
  grayBg: "F8FAFC",
  grayBorder: "E2E8F0",
  grayText: "64748B",
  black: "000000",
};

// === SANITIZADOR DE COLOR ARGB (OBLIGATORIO) ===
// ExcelJS NO acepta colores con '#' ni HEX de 6 dígitos sueltos.
// Siempre debe ser ARGB de 8 dígitos (Alpha+RGB) sin numeral.
// Ej: '047857' → 'FF047857', '#047857' → 'FF047857'
const toARGB = (hex: string): string => {
  const clean = hex.replace("#", "").toUpperCase();
  if (clean.length === 8) return clean;     // Ya es ARGB
  if (clean.length === 6) return `FF${clean}`; // Agregar alpha opaco
  if (clean.length === 3) {
    // Hex corto tipo #FFF → FFFFFF
    return `FF${clean.split("").map((c) => c + c).join("")}`;
  }
  // Fallback seguro: negro opaco
  return "FF000000";
};

// === Helpers de borde con colores sanitizados ===
const BORDER_THIN = (colorHex: string = COLORS_HEX.grayBorder) => ({
  top: { style: "thin" as const, color: { argb: toARGB(colorHex) } },
  left: { style: "thin" as const, color: { argb: toARGB(colorHex) } },
  bottom: { style: "thin" as const, color: { argb: toARGB(colorHex) } },
  right: { style: "thin" as const, color: { argb: toARGB(colorHex) } },
});

const BORDER_DOUBLE_TOP_BOTTOM = {
  top: { style: "double" as const, color: { argb: toARGB(COLORS_HEX.emeraldPrimary) } },
  bottom: { style: "double" as const, color: { argb: toARGB(COLORS_HEX.emeraldPrimary) } },
  left: { style: "thin" as const, color: { argb: toARGB(COLORS_HEX.emeraldPrimary) } },
  right: { style: "thin" as const, color: { argb: toARGB(COLORS_HEX.emeraldPrimary) } },
};

// Helper para crear un fill sólido con color sanitizado
const solidFill = (colorHex: string) => ({
  type: "pattern" as const,
  pattern: "solid" as const,
  bgColor: { argb: toARGB(colorHex) },
  fgColor: { argb: toARGB(colorHex) },
});

export async function exportSettlementToExcel({
  data,
  periodName,
  fileName,
}: ExportSettlementParams): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Red Escucha Psicológica";
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet("Liquidación", {
    properties: {
      defaultRowHeight: 18,
      tabColor: { argb: toARGB(COLORS_HEX.emeraldPrimary) },
    },
    views: [{ showGridLines: false }],
  });

  // ========================================================================
  // A. Encabezado Institucional (Filas 1-2)
  // ========================================================================
  ws.mergeCells("A1:K1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "RED ESCUCHA PSICOLÓGICA — LIQUIDACIÓN MENSUAL";
  titleCell.font = {
    name: "Calibri",
    size: 16,
    bold: true,
    color: { argb: toARGB(COLORS_HEX.emeraldDark) },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:K2");
  const subtitleCell = ws.getCell("A2");
  subtitleCell.value = `Período: ${periodName}`;
  subtitleCell.font = {
    name: "Calibri",
    size: 11,
    italic: true,
    color: { argb: toARGB(COLORS_HEX.slateText) },
  };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(2).height = 18;

  // ========================================================================
  // B. Bloque Resumen Ejecutivo / Tarjetas KPI (Filas 4-6)
  // ========================================================================
  // Calculamos totales primero (desde data, los mismos que la UI)
  const totals = data.reduce(
    (acc, row) => ({
      totalAppointments: acc.totalAppointments + (row.totalAppointments || 0),
      attended: acc.attended + (row.attended || 0),
      absent: acc.absent + (row.absent || 0),
      rescheduled: acc.rescheduled + (row.rescheduled || 0),
      cancelled: acc.cancelled + (row.cancelled || 0),
      totalPatientFee: acc.totalPatientFee + (row.totalPatientFee || 0),
      totalProfessionalFee: acc.totalProfessionalFee + (row.totalProfessionalFee || 0),
      totalRepFee: acc.totalRepFee + (row.totalRepFee || 0),
    }),
    {
      totalAppointments: 0,
      attended: 0,
      absent: 0,
      rescheduled: 0,
      cancelled: 0,
      totalPatientFee: 0,
      totalProfessionalFee: 0,
      totalRepFee: 0,
    }
  );

  // === Fila 4: etiquetas de los KPI ===
  const kpiLabels = [
    { cell: "A4", value: "TOTAL COBRADO", bg: COLORS_HEX.slateHeader, fg: COLORS_HEX.slateText },
    { cell: "D4", value: "HONORARIOS PROFESIONALES", bg: COLORS_HEX.emeraldLight, fg: COLORS_HEX.emeraldText },
    { cell: "G4", value: "COMISIÓN REP", bg: COLORS_HEX.amberLight, fg: COLORS_HEX.amberText },
  ];
  kpiLabels.forEach((kpi) => {
    const startCol = kpi.cell.charCodeAt(0) - 64; // A=1, D=4, G=7
    const endCol = startCol + 2;
    const startRow = parseInt(kpi.cell.slice(1));
    const endColLetter = String.fromCharCode(64 + endCol);
    ws.mergeCells(`${kpi.cell}:${endColLetter}${startRow}`);
    const c = ws.getCell(kpi.cell);
    c.value = kpi.value;
    c.font = { name: "Calibri", size: 9, bold: true, color: { argb: toARGB(kpi.fg) } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.fill = solidFill(kpi.bg);
    c.border = BORDER_THIN(kpi.bg);
  });
  ws.getRow(4).height = 16;

  // === Fila 5: valores monetarios con formato ===
  const kpiValues = [
    { cell: "A5", value: totals.totalPatientFee, bg: COLORS_HEX.slateHeader, fg: COLORS_HEX.black },
    { cell: "D5", value: totals.totalProfessionalFee, bg: COLORS_HEX.emeraldLight, fg: COLORS_HEX.emeraldText },
    { cell: "G5", value: totals.totalRepFee, bg: COLORS_HEX.amberLight, fg: COLORS_HEX.amberText },
  ];
  kpiValues.forEach((kpi) => {
    const startCol = kpi.cell.charCodeAt(0) - 64;
    const endCol = startCol + 2;
    const startRow = parseInt(kpi.cell.slice(1));
    const endColLetter = String.fromCharCode(64 + endCol);
    ws.mergeCells(`${kpi.cell}:${endColLetter}${startRow}`);
    const c = ws.getCell(kpi.cell);
    c.value = kpi.value;
    c.numFmt = '"$" #,##0';
    c.font = { name: "Calibri", size: 14, bold: true, color: { argb: toARGB(kpi.fg) } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.fill = solidFill(kpi.bg);
    c.border = BORDER_THIN(kpi.bg);
  });
  ws.getRow(5).height = 28;

  // === Fila 6: KPIs de turnos (chips de color) ===
  const turnosKPI = [
    { cell: "A6", label: "Atendidos", value: totals.attended, color: COLORS_HEX.greenAttended },
    { cell: "B6", label: "Ausentes", value: totals.absent, color: COLORS_HEX.yellowAbsent },
    { cell: "C6", label: "Reprog.", value: totals.rescheduled, color: COLORS_HEX.blueResched },
    { cell: "D6", label: "Cancelados", value: totals.cancelled, color: COLORS_HEX.redCancelled },
    { cell: "E6", label: "Total Turnos", value: totals.totalAppointments, color: COLORS_HEX.emeraldPrimary },
  ];
  turnosKPI.forEach((kpi) => {
    const c = ws.getCell(kpi.cell);
    c.value = `${kpi.label}: ${kpi.value}`;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(kpi.color) } };
    c.alignment = { vertical: "middle", horizontal: "center" };
    c.fill = solidFill(COLORS_HEX.white);
    c.border = BORDER_THIN(COLORS_HEX.grayBorder);
  });
  ws.mergeCells("F6:K6");
  ws.getRow(6).height = 22;

  // ========================================================================
  // C. Tabla Principal — Encabezados (Fila 8)
  // ========================================================================
  const headers = [
    "Profesional",
    "Especialidad",
    "Total Turnos",
    "Atendido",
    "Ausente",
    "Reprog.",
    "Cancelado",
    "$/Sesión",
    "Honor. Prof.",
    "Comisión REP",
    "Total Cobrado",
  ];
  headers.forEach((header, idx) => {
    const col = idx + 1;
    const cell = ws.getCell(8, col);
    cell.value = header;
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: toARGB(COLORS_HEX.white) },
    };
    cell.fill = solidFill(COLORS_HEX.emeraldPrimary);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BORDER_THIN(COLORS_HEX.emeraldPrimary);
  });
  ws.getRow(8).height = 28;

  // ========================================================================
  // D. Filas de Datos (Fila 9 en adelante) — mapeo dinámico
  // ========================================================================
  const startRow = 9;
  data.forEach((row, idx) => {
    const rowNum = startRow + idx;
    const isAltRow = idx % 2 === 1;
    const rowBg = isAltRow ? COLORS_HEX.grayBg : COLORS_HEX.white;

    // Profesional
    const c1 = ws.getCell(rowNum, 1);
    c1.value = row.professionalName || "—";
    c1.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(COLORS_HEX.emeraldDark) } };
    c1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c1.fill = solidFill(rowBg);
    c1.border = BORDER_THIN();

    // Especialidad
    const c2 = ws.getCell(rowNum, 2);
    c2.value = row.specialty || "—";
    c2.font = { name: "Calibri", size: 10, italic: true, color: { argb: toARGB(COLORS_HEX.grayText) } };
    c2.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c2.fill = solidFill(rowBg);
    c2.border = BORDER_THIN();

    // Total Turnos (centro, negrita)
    const c3 = ws.getCell(rowNum, 3);
    c3.value = row.totalAppointments || 0;
    c3.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(COLORS_HEX.emeraldPrimary) } };
    c3.alignment = { vertical: "middle", horizontal: "center" };
    c3.fill = solidFill(rowBg);
    c3.border = BORDER_THIN();

    // Atendido (verde)
    const c4 = ws.getCell(rowNum, 4);
    c4.value = row.attended || 0;
    c4.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(COLORS_HEX.greenAttended) } };
    c4.alignment = { vertical: "middle", horizontal: "center" };
    c4.fill = solidFill(rowBg);
    c4.border = BORDER_THIN();

    // Ausente (amarillo/naranja)
    const c5 = ws.getCell(rowNum, 5);
    c5.value = row.absent || 0;
    c5.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(COLORS_HEX.yellowAbsent) } };
    c5.alignment = { vertical: "middle", horizontal: "center" };
    c5.fill = solidFill(rowBg);
    c5.border = BORDER_THIN();

    // Reprog. (azul)
    const c6 = ws.getCell(rowNum, 6);
    c6.value = row.rescheduled || 0;
    c6.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(COLORS_HEX.blueResched) } };
    c6.alignment = { vertical: "middle", horizontal: "center" };
    c6.fill = solidFill(rowBg);
    c6.border = BORDER_THIN();

    // Cancelado (rojo)
    const c7 = ws.getCell(rowNum, 7);
    c7.value = row.cancelled || 0;
    c7.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(COLORS_HEX.redCancelled) } };
    c7.alignment = { vertical: "middle", horizontal: "center" };
    c7.fill = solidFill(rowBg);
    c7.border = BORDER_THIN();

    // $/Sesión (formato moneda, derecha)
    const c8 = ws.getCell(rowNum, 8);
    c8.value = row.sessionFee || 0;
    c8.numFmt = '"$" #,##0';
    c8.font = { name: "Calibri", size: 10, color: { argb: toARGB(COLORS_HEX.black) } };
    c8.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    c8.fill = solidFill(rowBg);
    c8.border = BORDER_THIN();

    // Honor. Prof. (formato moneda, derecha)
    const c9 = ws.getCell(rowNum, 9);
    c9.value = row.totalProfessionalFee || 0;
    c9.numFmt = '"$" #,##0';
    c9.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(COLORS_HEX.emeraldText) } };
    c9.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    c9.fill = solidFill(rowBg);
    c9.border = BORDER_THIN();

    // Comisión REP (formato moneda, derecha)
    const c10 = ws.getCell(rowNum, 10);
    c10.value = row.totalRepFee || 0;
    c10.numFmt = '"$" #,##0';
    c10.font = { name: "Calibri", size: 10, bold: true, color: { argb: toARGB(COLORS_HEX.amberText) } };
    c10.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    c10.fill = solidFill(rowBg);
    c10.border = BORDER_THIN();

    // Total Cobrado (formato moneda, derecha)
    const c11 = ws.getCell(rowNum, 11);
    c11.value = row.totalPatientFee || 0;
    c11.numFmt = '"$" #,##0';
    c11.font = { name: "Calibri", size: 10, color: { argb: toARGB(COLORS_HEX.black) } };
    c11.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    c11.fill = solidFill(rowBg);
    c11.border = BORDER_THIN();

    ws.getRow(rowNum).height = 18;
  });

  // ========================================================================
  // E. Fila de Totales con fórmulas SUM() nativas (seguras)
  // ========================================================================
  const totalRowNum = startRow + data.length;
  const endRow = startRow + Math.max(data.length - 1, 0); // última fila de datos

  const totalLabelCell = ws.getCell(totalRowNum, 1);
  totalLabelCell.value = "TOTALES";
  totalLabelCell.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: toARGB(COLORS_HEX.white) },
  };
  totalLabelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  totalLabelCell.fill = solidFill(COLORS_HEX.emeraldPrimary);
  totalLabelCell.border = BORDER_DOUBLE_TOP_BOTTOM;

  // Especialidad (vacía, solo estilo)
  const c2Total = ws.getCell(totalRowNum, 2);
  c2Total.value = "";
  c2Total.fill = solidFill(COLORS_HEX.emeraldPrimary);
  c2Total.border = BORDER_DOUBLE_TOP_BOTTOM;

  // Columnas 3 a 7: fórmulas SUM para totales de turnos (o 0 si no hay filas)
  const sumColumnsTurnos = [3, 4, 5, 6, 7]; // C, D, E, F, G
  sumColumnsTurnos.forEach((col) => {
    const cell = ws.getCell(totalRowNum, col);
    const colLetter = String.fromCharCode(64 + col);
    if (data.length > 0) {
      cell.value = {
        formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
      };
    } else {
      cell.value = 0;
    }
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: toARGB(COLORS_HEX.white) },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = solidFill(COLORS_HEX.emeraldPrimary);
    cell.border = BORDER_DOUBLE_TOP_BOTTOM;
  });

  // Columnas 8 a 11: fórmulas SUM para montos (o 0 si no hay filas)
  const sumColumnsMontos = [8, 9, 10, 11]; // H, I, J, K
  sumColumnsMontos.forEach((col) => {
    const cell = ws.getCell(totalRowNum, col);
    const colLetter = String.fromCharCode(64 + col);
    if (data.length > 0) {
      cell.value = {
        formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
      };
    } else {
      cell.value = 0;
    }
    cell.numFmt = '"$" #,##0';
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: toARGB(COLORS_HEX.white) },
    };
    cell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    cell.fill = solidFill(COLORS_HEX.emeraldPrimary);
    cell.border = BORDER_DOUBLE_TOP_BOTTOM;
  });

  ws.getRow(totalRowNum).height = 26;

  // ========================================================================
  // F. Auto-fit de columnas (anchos pre-calibrados)
  // ========================================================================
  const columnWidths = [
    { col: 1, width: 32 }, // Profesional
    { col: 2, width: 28 }, // Especialidad
    { col: 3, width: 12 }, // Total Turnos
    { col: 4, width: 11 }, // Atendido
    { col: 5, width: 11 }, // Ausente
    { col: 6, width: 11 }, // Reprog.
    { col: 7, width: 12 }, // Cancelado
    { col: 8, width: 13 }, // $/Sesión
    { col: 9, width: 15 }, // Honor. Prof.
    { col: 10, width: 16 }, // Comisión REP
    { col: 11, width: 15 }, // Total Cobrado
  ];
  columnWidths.forEach(({ col, width }) => {
    ws.getColumn(col).width = width;
  });

  // === Freeze panes: congelar filas 1-8 (headers) ===
  ws.views = [
    {
      showGridLines: false,
      topLeftCell: "A1",
      xSplit: 0,
      ySplit: 8,
      activeCell: "A9",
      state: "frozen",
    },
  ];

  // ========================================================================
  // G. Generar archivo y descargar (UTF-8 nativo)
  // ========================================================================
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const safeFileName = (fileName || `liquidacion_${periodName.toLowerCase().replace(/\s+/g, "_")}`)
    .replace(/[^\w\-_]/g, "_");
  saveAs(blob, `${safeFileName}.xlsx`);
}
