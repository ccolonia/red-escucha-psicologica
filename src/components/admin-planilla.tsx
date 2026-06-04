"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  Circle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  DollarSign,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

interface SessionRow {
  id: string;
  date: string;
  patientName: string;
  mode: string;
  treatmentStartDate: string | null;
  frequency: string | null;
  patientFee: number;
  professionalFee: number;
  repFee: number;
  absentWithNotice: boolean;
  absentWithoutNotice: boolean;
  absentReason: string | null;
  supervised: boolean;
  suspendedTreatment: boolean;
  weekNumber: number;
}

interface SheetData {
  id: string;
  professionalId: string;
  month: number;
  year: number;
  repCommission: number;
  sessions: SessionRow[];
  professional: { user: { name: string } };
}

interface Professional {
  id: string;
  specialty: string;
  user: { name: string; email: string; active: boolean };
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function AdminPlanilla() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>("");
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSheets, setLoadingSheets] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Load professionals
  useEffect(() => {
    fetch("/api/professionals")
      .then((res) => res.json())
      .then((data) => {
        const profs = Array.isArray(data) ? data.filter((p: Professional) => p.user.active) : [];
        setProfessionals(profs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load sheets when professional changes
  useEffect(() => {
    if (!selectedProfId) {
      setSheets([]);
      return;
    }
    setLoadingSheets(true);
    fetch(`/api/attendance-sheets?professionalId=${selectedProfId}`)
      .then((res) => res.json())
      .then((data) => {
        setSheets(Array.isArray(data) ? data : []);
        setLoadingSheets(false);
      })
      .catch(() => {
        setSheets([]);
        setLoadingSheets(false);
      });
  }, [selectedProfId]);

  // Current sheet
  const currentSheet = useMemo(() => {
    return sheets.find((s) => s.month === selectedMonth && s.year === selectedYear) || null;
  }, [sheets, selectedMonth, selectedYear]);

  const currentSessions = currentSheet?.sessions || [];

  // Weeks
  const weeks = useMemo(() => {
    const result: { weekNum: number; start: Date; end: Date }[] = [];
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
    const lastDay = new Date(selectedYear, selectedMonth, 0);
    let weekNum = 1;
    let current = new Date(firstDay);
    while (current <= lastDay) {
      const weekStart = new Date(current);
      const dayOfWeek = weekStart.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + mondayOffset);
      if (weekStart < firstDay) weekStart.setTime(firstDay.getTime());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime());
      result.push({ weekNum, start: new Date(weekStart), end: new Date(weekEnd) });
      current = new Date(weekEnd);
      current.setDate(current.getDate() + 1);
      weekNum++;
    }
    return result;
  }, [selectedYear, selectedMonth]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (selectedWeek === null) return currentSessions;
    return currentSessions.filter((s) => s.weekNumber === selectedWeek);
  }, [currentSessions, selectedWeek]);

  // Summary
  const summary = useMemo(() => {
    const attended = currentSessions.filter((s) => !s.absentWithNotice && !s.absentWithoutNotice);
    const absences = currentSessions.filter((s) => s.absentWithNotice || s.absentWithoutNotice);
    return {
      totalSessions: attended.length,
      totalAbsences: absences.length,
      totalPatientFee: attended.reduce((sum, s) => sum + s.patientFee, 0),
      totalProfFee: attended.reduce((sum, s) => sum + s.professionalFee, 0),
      totalRepFee: attended.reduce((sum, s) => sum + s.repFee, 0),
      totalSupervised: currentSessions.filter((s) => s.supervised).length,
      totalSuspended: currentSessions.filter((s) => s.suspendedTreatment).length,
    };
  }, [currentSessions]);

  // Week indicators
  const weekIndicators = useMemo(() => {
    const map: Record<number, boolean> = {};
    for (const w of weeks) {
      map[w.weekNum] = currentSessions.some((s) => s.weekNumber === w.weekNum);
    }
    return map;
  }, [weeks, currentSessions]);

  // Export CSV
  const exportCSV = () => {
    if (!selectedProfId) return;
    window.open(
      `/api/attendance-sheets?professionalId=${selectedProfId}&month=${selectedMonth}&year=${selectedYear}&csv=1`,
      "_blank"
    );
  };

  // Export all months
  const exportAllCSV = () => {
    if (!selectedProfId || sheets.length === 0) return;
    // Download each sheet as CSV
    for (const sheet of sheets) {
      window.open(
        `/api/attendance-sheets?professionalId=${selectedProfId}&month=${sheet.month}&year=${sheet.year}&csv=1`,
        "_blank"
      );
    }
  };

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const profName = professionals.find((p) => p.id === selectedProfId)?.user.name || "";

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 bg-teal-50 animate-pulse rounded-lg" />
        <div className="h-40 bg-teal-50 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-teal-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6" />
            Planilla de Atención
          </h2>
          <p className="text-teal-600 text-sm mt-1">
            Vista administrador — seleccioná un profesional para ver/descargar sus planillas
          </p>
        </div>
        <div className="flex gap-2">
          {currentSheet && (
            <Button
              variant="outline"
              className="border-teal-200 text-teal-600"
              onClick={exportCSV}
            >
              <Download className="mr-2 w-4 h-4" />
              Exportar CSV
            </Button>
          )}
          {sheets.length > 0 && (
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-600"
              onClick={exportAllCSV}
            >
              <Download className="mr-2 w-4 h-4" />
              Descargar Todo
            </Button>
          )}
        </div>
      </div>

      {/* Professional Selector */}
      <Card className="border-teal-100">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-teal-700 mb-1 block">Profesional</label>
              <Select value={selectedProfId} onValueChange={(v) => { setSelectedProfId(v); setSelectedWeek(null); }}>
                <SelectTrigger className="border-teal-200">
                  <SelectValue placeholder="Seleccionar profesional..." />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.user.name} — {p.specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedProfId ? (
        <Card className="border-teal-100">
          <CardContent className="py-16 text-center">
            <Stethoscope className="w-16 h-16 text-teal-200 mx-auto" />
            <p className="text-teal-600 mt-3 text-lg">Seleccioná un profesional</p>
            <p className="text-teal-400 text-sm mt-1">Para ver sus planillas de atención mensuales</p>
          </CardContent>
        </Card>
      ) : loadingSheets ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Month/Year Navigator */}
          <Card className="border-teal-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={prevMonth} className="text-teal-600">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-teal-900">
                    {MONTHS[selectedMonth - 1]} {selectedYear}
                  </h3>
                  <p className="text-xs text-teal-500 mt-1">
                    {currentSheet ? `Planilla con ${currentSessions.length} sesiones` : "Sin planilla cargada"} • {profName}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={nextMonth} className="text-teal-600">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Available sheets for quick navigation */}
              {sheets.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 justify-center">
                  <span className="text-xs text-teal-500">Planillas disponibles:</span>
                  {sheets.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedMonth(s.month); setSelectedYear(s.year); setSelectedWeek(null); }}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        s.month === selectedMonth && s.year === selectedYear
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-teal-600 border-teal-200 hover:bg-teal-50"
                      }`}
                    >
                      {MONTHS[s.month - 1].slice(0, 3)} {s.year} ({s.sessions.length})
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Week Navigation */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedWeek === null ? "default" : "outline"}
              size="sm"
              className={selectedWeek === null ? "bg-teal-600 text-white" : "border-teal-200 text-teal-600"}
              onClick={() => setSelectedWeek(null)}
            >
              Todo el mes
            </Button>
            {weeks.map((w) => (
              <Button
                key={w.weekNum}
                variant={selectedWeek === w.weekNum ? "default" : "outline"}
                size="sm"
                className={`relative ${selectedWeek === w.weekNum ? "bg-teal-600 text-white" : "border-teal-200 text-teal-600"}`}
                onClick={() => setSelectedWeek(w.weekNum)}
              >
                Sem {w.weekNum}
                {weekIndicators[w.weekNum] && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
                )}
              </Button>
            ))}
          </div>

          {/* Sessions Table (read-only) */}
          <Card className="border-teal-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-teal-900 text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {selectedWeek ? `Semana ${selectedWeek}` : "Todas las semanas"} — {MONTHS[selectedMonth - 1]} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSessions.length === 0 ? (
                <div className="text-center py-12">
                  <FileSpreadsheet className="w-12 h-12 text-teal-200 mx-auto" />
                  <p className="text-teal-600 mt-2">No hay sesiones cargadas para este mes</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-teal-100 bg-teal-50/50">
                        <th className="px-2 py-2 text-left text-teal-700 font-medium">Fecha</th>
                        <th className="px-2 py-2 text-left text-teal-700 font-medium">Nombre y Apellido</th>
                        <th className="px-2 py-2 text-center text-teal-700 font-medium">Modo</th>
                        <th className="px-2 py-2 text-left text-teal-700 font-medium">Inicio Trat.</th>
                        <th className="px-2 py-2 text-left text-teal-700 font-medium">Frecuencia</th>
                        <th className="px-2 py-2 text-right text-teal-700 font-medium">Honor. Pac.</th>
                        <th className="px-2 py-2 text-right text-teal-700 font-medium">Honor. Prof.</th>
                        <th className="px-2 py-2 text-right text-teal-700 font-medium">REP</th>
                        <th className="px-2 py-2 text-center text-teal-700 font-medium">CA</th>
                        <th className="px-2 py-2 text-center text-teal-700 font-medium">SA</th>
                        <th className="px-2 py-2 text-center text-teal-700 font-medium">Sup.</th>
                        <th className="px-2 py-2 text-center text-teal-700 font-medium">Susp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.map((s) => {
                        const isAbsent = s.absentWithNotice || s.absentWithoutNotice;
                        return (
                          <tr
                            key={s.id}
                            className={`border-b border-teal-50 ${
                              isAbsent ? "bg-red-50/30" : ""
                            } ${s.suspendedTreatment ? "bg-amber-50/30" : ""}`}
                          >
                            <td className="px-2 py-1.5 text-sm text-teal-800">{formatDisplayDate(s.date)}</td>
                            <td className="px-2 py-1.5 text-sm font-medium text-teal-900">{s.patientName}</td>
                            <td className="px-2 py-1.5 text-center">
                              <Badge variant="outline" className="text-xs">
                                {s.mode === "P" ? "Presencial" : "Online"}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5 text-sm text-teal-600">{s.treatmentStartDate ? formatDisplayDate(s.treatmentStartDate) : "—"}</td>
                            <td className="px-2 py-1.5 text-sm text-teal-600">{s.frequency || "—"}</td>
                            <td className="px-2 py-1.5 text-sm text-right font-medium text-teal-800">${s.patientFee.toLocaleString("es-AR")}</td>
                            <td className="px-2 py-1.5 text-sm text-right font-medium text-emerald-700">${s.professionalFee.toLocaleString("es-AR")}</td>
                            <td className="px-2 py-1.5 text-sm text-right font-medium text-amber-700">${s.repFee.toLocaleString("es-AR")}</td>
                            <td className="px-2 py-1.5 text-center">
                              {s.absentWithNotice && <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded">CA</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {s.absentWithoutNotice && <span className="inline-block bg-red-200 text-red-800 text-xs font-bold px-1.5 py-0.5 rounded">SA</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {s.supervised ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <Circle className="w-4 h-4 text-gray-300 mx-auto" />}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {s.suspendedTreatment && <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Absence reasons */}
          {currentSessions.some((s) => s.absentWithNotice || s.absentWithoutNotice) && (
            <Card className="border-amber-100 bg-amber-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-800 text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Motivos de Inasistencia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentSessions
                    .filter((s) => s.absentWithNotice || s.absentWithoutNotice)
                    .map((s) => (
                      <div key={s.id} className="flex items-center gap-3 text-sm">
                        <Badge variant={s.absentWithoutNotice ? "destructive" : "outline"} className="text-xs shrink-0">
                          {s.absentWithNotice ? "CA" : "SA"}
                        </Badge>
                        <span className="text-teal-700 shrink-0">{formatDisplayDate(s.date)}</span>
                        <span className="text-teal-900 font-medium shrink-0">{s.patientName}</span>
                        <span className="text-teal-500">{s.absentReason || "Sin motivo"}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {currentSessions.length > 0 && (
            <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-teal-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Resumen — {profName} — {MONTHS[selectedMonth - 1]} {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-teal-100">
                    <p className="text-xs text-teal-500">Sesiones</p>
                    <p className="text-2xl font-bold text-teal-900">{summary.totalSessions}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-red-100">
                    <p className="text-xs text-red-500">Inasistencias</p>
                    <p className="text-2xl font-bold text-red-600">{summary.totalAbsences}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-emerald-100">
                    <p className="text-xs text-emerald-500">Honorario Profesional</p>
                    <p className="text-xl font-bold text-emerald-700">${summary.totalProfFee.toLocaleString("es-AR")}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-amber-100">
                    <p className="text-xs text-amber-500">Comisión REP ({currentSheet ? Math.round(currentSheet.repCommission * 100) : 30}%)</p>
                    <p className="text-xl font-bold text-amber-700">${summary.totalRepFee.toLocaleString("es-AR")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                  <div className="bg-white rounded-lg p-3 border border-teal-100">
                    <p className="text-xs text-teal-500">Total Cobrado</p>
                    <p className="text-xl font-bold text-teal-900">${summary.totalPatientFee.toLocaleString("es-AR")}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-emerald-100">
                    <p className="text-xs text-emerald-500">Supervisiones</p>
                    <p className="text-2xl font-bold text-emerald-700">{summary.totalSupervised}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-amber-100">
                    <p className="text-xs text-amber-500">Suspendieron Tratamiento</p>
                    <p className="text-2xl font-bold text-amber-700">{summary.totalSuspended}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
