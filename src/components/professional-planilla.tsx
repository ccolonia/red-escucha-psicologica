"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Circle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  Calendar,
  DollarSign,
  CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { toast } from "sonner";

// Inline date picker component with calendar popup
function DatePickerInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 h-8 px-2 text-xs border border-teal-200 rounded-md bg-white hover:bg-teal-50 transition-colors ${className || ""}`}
          type="button"
        >
          <CalendarIcon className="w-3.5 h-3.5 text-teal-500 shrink-0" />
          <span className={value ? "text-teal-900" : "text-teal-400"}>
            {value ? formatDisplayDate(value) : "dd/mm/aaaa"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarPicker
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) {
              onChange(formatDate(date));
            }
            setOpen(false);
          }}
          locale={es}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const FREQUENCIES = [
  "1 vez x sem",
  "2 veces x sem",
  "c/15 dias",
  "1 vez x mes",
  "Quincenal",
];

interface SessionRow {
  id: string; // temporary client-side id
  date: string;
  patientName: string;
  mode: string;
  treatmentStartDate: string;
  frequency: string;
  patientFee: number;
  professionalFee: number;
  repFee: number;
  absentWithNotice: boolean;
  absentWithoutNotice: boolean;
  absentReason: string;
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
}

let tempIdCounter = 0;
function newTempId(): string {
  return `temp_${++tempIdCounter}_${Date.now()}`;
}

function getWeeksInMonth(year: number, month: number): { weekNum: number; start: Date; end: Date }[] {
  const weeks: { weekNum: number; start: Date; end: Date }[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  let weekNum = 1;
  let current = new Date(firstDay);

  while (current <= lastDay) {
    const weekStart = new Date(current);
    const dayOfWeek = weekStart.getDay();
    // Adjust to Monday start
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    if (weekStart < firstDay) weekStart.setTime(firstDay.getTime());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime());

    weeks.push({ weekNum, start: new Date(weekStart), end: new Date(weekEnd) });

    // Move to next week
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 1);
    weekNum++;
  }

  return weeks;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Calculate REP commission based on the year the professional joined
function getRepCommission(yearJoined: number, currentYear: number): number {
  const yearsInRep = currentYear - yearJoined;
  if (yearsInRep <= 0) return 0.30;
  if (yearsInRep === 1) return 0.30;
  if (yearsInRep === 2) return 0.20;
  return 0.10;
}

export function ProfessionalPlanilla() {
  const { data: session } = useSession();
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [professionalJoinedYear, setProfessionalJoinedYear] = useState<number>(new Date().getFullYear());
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Current selection
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null); // null = all weeks

  // Current sheet data
  const [currentSessions, setCurrentSessions] = useState<SessionRow[]>([]);
  const [currentSheetId, setCurrentSheetId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load professional profile
  useEffect(() => {
    if (session?.user) {
      const userId = (session.user as { id: string }).id;
      fetch("/api/professionals?all=true")
        .then((res) => res.json())
        .then((data) => {
          const profs = Array.isArray(data) ? data : [];
          const prof = profs.find((p: { userId: string }) => p.userId === userId);
          if (prof) {
            setProfessionalId(prof.id);
            setProfessionalJoinedYear(prof.createdAt ? new Date(prof.createdAt).getFullYear() : new Date().getFullYear());
          }
        })
        .catch(console.error);
    }
  }, [session]);

  // Load sheets
  const loadSheets = useCallback(() => {
    if (!professionalId) return;
    setLoading(true);
    fetch(`/api/attendance-sheets?professionalId=${professionalId}`)
      .then((res) => res.json())
      .then((data) => {
        setSheets(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [professionalId]);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  // Load current month's sheet
  useEffect(() => {
    const existingSheet = sheets.find(
      (s) => s.month === selectedMonth && s.year === selectedYear
    );
    if (existingSheet) {
      setCurrentSheetId(existingSheet.id);
      setCurrentSessions(
        existingSheet.sessions.map((s) => ({ ...s, id: s.id || newTempId() }))
      );
    } else {
      setCurrentSheetId(null);
      setCurrentSessions([]);
    }
    setHasUnsavedChanges(false);
    setSelectedWeek(null);
  }, [selectedMonth, selectedYear, sheets]);

  // Computed values
  const weeks = useMemo(
    () => getWeeksInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  const repCommission = useMemo(
    () => getRepCommission(professionalJoinedYear, selectedYear),
    [professionalJoinedYear, selectedYear]
  );

  const filteredSessions = useMemo(() => {
    if (selectedWeek === null) return currentSessions;
    return currentSessions.filter((s) => s.weekNumber === selectedWeek);
  }, [currentSessions, selectedWeek]);

  // Summary calculations
  const summary = useMemo(() => {
    const allSessions = currentSessions;
    // === Sesiones facturables ===
    // - Turnos normales (no ausentes): se facturan
    // - SA (sin aviso): se facturan (el paciente debe pagar)
    // - CA (con aviso): NO se facturan (el paciente avisó, no paga)
    const billable = allSessions.filter(
      (s) => !s.absentWithNotice
    );
    const absences = allSessions.filter(
      (s) => s.absentWithNotice || s.absentWithoutNotice
    );
    const totalPatientFee = billable.reduce((sum, s) => sum + s.patientFee, 0);
    const totalProfFee = billable.reduce((sum, s) => sum + s.professionalFee, 0);
    const totalRepFee = billable.reduce((sum, s) => sum + s.repFee, 0);
    const totalSuspended = allSessions.filter((s) => s.suspendedTreatment).length;

    return {
      totalSessions: billable.length,
      totalAbsences: absences.length,
      totalPatientFee,
      totalProfFee,
      totalRepFee,
      totalSuspended,
    };
  }, [currentSessions]);

  // Week indicators (green dot if has sessions)
  const weekIndicators = useMemo(() => {
    const map: Record<number, boolean> = {};
    for (const w of weeks) {
      map[w.weekNum] = currentSessions.some((s) => s.weekNumber === w.weekNum);
    }
    return map;
  }, [weeks, currentSessions]);

  // Add a new session row
  const addSession = () => {
    const weekToUse = selectedWeek || 1;
    const weekData = weeks.find((w) => w.weekNum === weekToUse);
    const defaultDate = weekData ? formatDate(weekData.start) : formatDate(new Date(selectedYear, selectedMonth - 1, 1));

    const patientFee = 0;
    const profFee = 0;
    const repFee = 0;

    const newSession: SessionRow = {
      id: newTempId(),
      date: defaultDate,
      patientName: "",
      mode: "P",
      treatmentStartDate: "",
      frequency: "1 vez x sem",
      patientFee,
      professionalFee: profFee,
      repFee: repFee,
      absentWithNotice: false,
      absentWithoutNotice: false,
      absentReason: "",
      supervised: false,
      suspendedTreatment: false,
      weekNumber: weekToUse,
    };

    setCurrentSessions((prev) => [...prev, newSession]);
    setHasUnsavedChanges(true);
  };

  // Update a session field
  const updateSession = (id: string, field: string, value: any) => {
    setCurrentSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };

        // Auto-calculate fees when patientFee changes
        if (field === "patientFee") {
          const fee = typeof value === "number" ? value : 0;
          if (updated.absentWithNotice) {
            updated.patientFee = 0;
            updated.professionalFee = 0;
            updated.repFee = 0;
          } else {
            updated.patientFee = fee;
            updated.professionalFee = Math.round(fee * (1 - repCommission));
            updated.repFee = fee - updated.professionalFee;
          }
        }

        // When marking absent, zero out fees
        if (field === "absentWithNotice" && value) {
          updated.absentWithoutNotice = false;
          updated.patientFee = 0;
          updated.professionalFee = 0;
          updated.repFee = 0;
        }
        if (field === "absentWithoutNotice" && value) {
          updated.absentWithNotice = false;
        }

        // When unmarking absent, recalculate if patientFee was set
        if ((field === "absentWithNotice" && !value) || (field === "absentWithoutNotice" && !value)) {
          // Restore patient fee from the input (user needs to re-enter)
        }

        return updated;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Remove a session
  const removeSession = (id: string) => {
    setCurrentSessions((prev) => prev.filter((s) => s.id !== id));
    setHasUnsavedChanges(true);
  };

  // Save the sheet
  const saveSheet = async () => {
    if (!professionalId) {
      toast.error("No se encontró el perfil profesional");
      return;
    }

    // Validate: check for empty patient names
    const emptyNames = currentSessions.filter((s) => !s.patientName.trim());
    if (emptyNames.length > 0) {
      toast.error("Completá el nombre del paciente en todas las filas");
      return;
    }

    setSaving(true);
    try {
      const sessionsToSave = currentSessions.map((s) => ({
        date: s.date,
        patientName: s.patientName,
        mode: s.mode,
        treatmentStartDate: s.treatmentStartDate || null,
        frequency: s.frequency,
        patientFee: s.patientFee,
        professionalFee: s.professionalFee,
        repFee: s.repFee,
        absentWithNotice: s.absentWithNotice,
        absentWithoutNotice: s.absentWithoutNotice,
        absentReason: s.absentReason || null,
        supervised: s.supervised,
        suspendedTreatment: s.suspendedTreatment,
        weekNumber: s.weekNumber,
      }));

      const res = await fetch("/api/attendance-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId,
          month: selectedMonth,
          year: selectedYear,
          repCommission,
          sessions: sessionsToSave,
        }),
      });

      if (res.ok) {
        toast.success("Planilla guardada exitosamente");
        setHasUnsavedChanges(false);
        loadSheets();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar planilla");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  // Export CSV
  const exportCSV = () => {
    if (!professionalId) return;
    window.open(
      `/api/attendance-sheets?professionalId=${professionalId}&month=${selectedMonth}&year=${selectedYear}&csv=1`,
      "_blank"
    );
  };

  // Navigate month
  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const profName = session?.user?.name || "Profesional";

  if (loading && !professionalId) {
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
            {profName} • Comisión REP: {Math.round(repCommission * 100)}%
            ({selectedYear - professionalJoinedYear <= 0 ? "1er" : selectedYear - professionalJoinedYear === 1 ? "2do" : selectedYear - professionalJoinedYear === 2 ? "3er" : `${selectedYear - professionalJoinedYear + 1}°`} año)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-teal-200 text-teal-600"
            onClick={exportCSV}
            disabled={currentSessions.length === 0}
          >
            <Download className="mr-2 w-4 h-4" />
            Exportar CSV
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={saveSheet}
            disabled={saving || currentSessions.length === 0}
          >
            <Save className="mr-2 w-4 h-4" />
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

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
                {currentSheetId ? "Planilla guardada" : "Planilla nueva"} • {currentSessions.length} sesiones
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="text-teal-600">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Year selector for commission */}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-teal-500">
            <span>Año en REP:</span>
            <Select
              value={String(professionalJoinedYear)}
              onValueChange={(v) => setProfessionalJoinedYear(parseInt(v))}
            >
              <SelectTrigger className="w-24 h-7 text-xs border-teal-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>→ Comisión: {Math.round(repCommission * 100)}%</span>
          </div>
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

      {/* Sessions Table */}
      <Card className="border-teal-100">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-teal-900 text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {selectedWeek ? `Semana ${selectedWeek}` : "Todas las semanas"} — {MONTHS[selectedMonth - 1]} {selectedYear}
            </CardTitle>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={addSession}
            >
              <Plus className="mr-1 w-4 h-4" />
              Agregar Sesión
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-12 h-12 text-teal-200 mx-auto" />
              <p className="text-teal-600 mt-2">No hay sesiones cargadas</p>
              <p className="text-teal-400 text-sm mt-1">
                Hacé clic en &quot;Agregar Sesión&quot; para comenzar
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-teal-100 bg-teal-50/50">
                    <th className="px-2 py-2 text-left text-teal-700 font-medium w-[110px]">Fecha</th>
                    <th className="px-2 py-2 text-left text-teal-700 font-medium w-[200px]">Nombre y Apellido</th>
                    <th className="px-2 py-2 text-center text-teal-700 font-medium w-[60px]">Modo</th>
                    <th className="px-2 py-2 text-left text-teal-700 font-medium w-[110px]">Inicio Trat.</th>
                    <th className="px-2 py-2 text-left text-teal-700 font-medium w-[100px]">Frecuencia</th>
                    <th className="px-2 py-2 text-right text-teal-700 font-medium w-[90px]">Honor. Pac.</th>
                    <th className="px-2 py-2 text-right text-teal-700 font-medium w-[90px]">Honor. Prof.</th>
                    <th className="px-2 py-2 text-right text-teal-700 font-medium w-[70px]">REP</th>
                    <th className="px-2 py-2 text-center text-teal-700 font-medium w-[40px]">CA</th>
                    <th className="px-2 py-2 text-center text-teal-700 font-medium w-[40px]">SA</th>
                    <th className="px-2 py-2 text-center text-teal-700 font-medium w-[50px]">Susp.</th>
                    <th className="px-2 py-2 text-center text-teal-700 font-medium w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((s) => {
                    const isAbsent = s.absentWithNotice || s.absentWithoutNotice;
                    return (
                      <tr
                        key={s.id}
                        className={`border-b border-teal-50 hover:bg-teal-50/30 ${
                          isAbsent ? "bg-red-50/30" : ""
                        } ${s.suspendedTreatment ? "bg-amber-50/30" : ""}`}
                      >
                        {/* Date */}
                        <td className="px-2 py-1.5">
                          <DatePickerInput
                            value={s.date}
                            onChange={(val) => updateSession(s.id, "date", val)}
                            className="w-[130px]"
                          />
                        </td>
                        {/* Patient Name */}
                        <td className="px-2 py-1.5">
                          <Input
                            value={s.patientName}
                            onChange={(e) => updateSession(s.id, "patientName", e.target.value)}
                            placeholder="Nombre y Apellido"
                            className="h-8 text-xs border-teal-200 w-full min-w-[180px]"
                          />
                        </td>
                        {/* Mode */}
                        <td className="px-2 py-1.5 text-center">
                          <Select
                            value={s.mode}
                            onValueChange={(v) => updateSession(s.id, "mode", v)}
                          >
                            <SelectTrigger className="h-8 text-xs border-teal-200 w-[65px] mx-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="P">P</SelectItem>
                              <SelectItem value="OL">OL</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Treatment Start Date */}
                        <td className="px-2 py-1.5">
                          <DatePickerInput
                            value={s.treatmentStartDate}
                            onChange={(val) => updateSession(s.id, "treatmentStartDate", val)}
                            className="w-[130px]"
                          />
                        </td>
                        {/* Frequency */}
                        <td className="px-2 py-1.5">
                          <Select
                            value={s.frequency}
                            onValueChange={(v) => updateSession(s.id, "frequency", v)}
                          >
                            <SelectTrigger className="h-8 text-xs border-teal-200 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCIES.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {f}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Patient Fee */}
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            value={s.patientFee || ""}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              updateSession(s.id, "patientFee", val);
                            }}
                            placeholder="$0"
                            className="h-8 text-xs border-teal-200 text-right w-[90px]"
                            disabled={s.absentWithNotice}
                          />
                        </td>
                        {/* Professional Fee (auto-calculated) */}
                        <td className="px-2 py-1.5">
                          <div className="h-8 flex items-center justify-end px-2 bg-teal-50 rounded text-xs font-medium text-teal-800">
                            ${s.professionalFee.toLocaleString("es-AR")}
                          </div>
                        </td>
                        {/* REP Fee (auto-calculated) */}
                        <td className="px-2 py-1.5">
                          <div className="h-8 flex items-center justify-end px-2 bg-amber-50 rounded text-xs font-medium text-amber-800">
                            ${s.repFee.toLocaleString("es-AR")}
                          </div>
                        </td>
                        {/* CA - Con Aviso (paciente avisó, NO debe pagar) */}
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => updateSession(s.id, "absentWithNotice", !s.absentWithNotice)}
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                              s.absentWithNotice
                                ? "bg-red-500 text-white"
                                : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500"
                            }`}
                            title="Ausente con Aviso"
                          >
                            CA
                          </button>
                        </td>
                        {/* SA - Sin Aviso (paciente NO avisó, DEBE pagar honorarios) */}
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => updateSession(s.id, "absentWithoutNotice", !s.absentWithoutNotice)}
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                              s.absentWithoutNotice
                                ? "bg-red-600 text-white"
                                : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"
                            }`}
                            title="Ausente sin Aviso"
                          >
                            SA
                          </button>
                        </td>
                        {/* Suspended Treatment */}
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => updateSession(s.id, "suspendedTreatment", !s.suspendedTreatment)}
                            className={`w-7 h-7 rounded text-xs transition-colors ${
                              s.suspendedTreatment
                                ? "bg-amber-500 text-white"
                                : "bg-gray-100 text-gray-400 hover:bg-amber-100 hover:text-amber-600"
                            }`}
                            title={s.suspendedTreatment ? "Suspendió tratamiento" : "Tratamiento activo"}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </td>
                        {/* Delete */}
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => removeSession(s.id)}
                            className="w-7 h-7 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto" />
                          </button>
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

      {/* === Ausencia con aviso (CA) === */}
      {currentSessions.some((s) => s.absentWithNotice) && (
        <Card className="border-orange-100 bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-800 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Ausencia con aviso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentSessions
                .filter((s) => s.absentWithNotice)
                .map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs shrink-0 bg-red-50 border-red-200 text-red-600">
                      CA
                    </Badge>
                    <span className="text-sm text-teal-700 shrink-0 w-[100px]">
                      {formatDisplayDate(s.date)}
                    </span>
                    <span className="text-sm text-teal-900 font-medium shrink-0">
                      {s.patientName}
                    </span>
                    <Input
                      value={s.absentReason}
                      onChange={(e) => updateSession(s.id, "absentReason", e.target.value)}
                      placeholder="Motivo de ausencia con aviso..."
                      className="h-7 text-xs border-orange-200 flex-1"
                    />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Ausencia sin aviso (SA) === */}
      {currentSessions.some((s) => s.absentWithoutNotice) && (
        <Card className="border-red-100 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-800 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Ausencia sin aviso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentSessions
                .filter((s) => s.absentWithoutNotice)
                .map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <Badge variant="destructive" className="text-xs shrink-0">
                      SA
                    </Badge>
                    <span className="text-sm text-teal-700 shrink-0 w-[100px]">
                      {formatDisplayDate(s.date)}
                    </span>
                    <span className="text-sm text-teal-900 font-medium shrink-0">
                      {s.patientName}
                    </span>
                    <Input
                      value={s.absentReason}
                      onChange={(e) => updateSession(s.id, "absentReason", e.target.value)}
                      placeholder="Motivo de ausencia sin aviso..."
                      className="h-7 text-xs border-red-200 flex-1"
                    />
                    <span className="text-xs text-red-600 font-medium shrink-0 whitespace-nowrap">
                      Debe abonar: ${s.patientFee.toLocaleString("es-AR")}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-teal-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Resumen del Mes — {MONTHS[selectedMonth - 1]} {selectedYear}
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
              <p className="text-xs text-amber-500">Comisión REP ({Math.round(repCommission * 100)}%)</p>
              <p className="text-xl font-bold text-amber-700">${summary.totalRepFee.toLocaleString("es-AR")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-lg p-3 border border-teal-100">
              <p className="text-xs text-teal-500">Total Cobrado</p>
              <p className="text-xl font-bold text-teal-900">${summary.totalPatientFee.toLocaleString("es-AR")}</p>
            </div>

            <div className="bg-white rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-amber-500">Suspendieron Tratamiento</p>
              <p className="text-2xl font-bold text-amber-700">{summary.totalSuspended}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unsaved changes warning */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-8 z-30 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Cambios sin guardar</span>
            <Button
              size="sm"
              className="ml-2 bg-white text-amber-600 hover:bg-amber-50 h-7"
              onClick={saveSheet}
              disabled={saving}
            >
              <Save className="mr-1 w-3 h-3" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
