"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Search,
  Filter,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Mail,
  Phone,
  MessageCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// ====================================================================
// CONSTANTES
// ====================================================================

const PROFESSIONS = [
  "Psicólogo", "Psiquiatra", "Psicopedagogo", "Musicoterapeuta",
  "Licenciado en Psicología", "Doctor en Psicología", "Neuropsicólogo",
  "Terapista Ocupacional", "Trabajador Social", "Estimulador/a Temprana",
  "Neuropsicomotrista", "Neuropsicolingüista", "Nutricionista",
  "Fonoaudiólogo/a", "Otra",
];

const SPECIALTIES = [
  "Psicología Clínica", "Neuropsicología", "Psicología Laboral / Organizacional",
  "Psicología Educacional", "Psicología Deportiva", "Psicología Forense",
  "Psicología Social / Comunitaria", "Psicología de la Salud",
  "Sexología / Terapia Sexual", "Adicciones", "Duelo y Pérdida",
  "Trastornos Alimentarios", "Psicología Geriátrica", "Psicología Transcultural",
  "Psicología Perinatal", "Psicooncología", "Psiconutrición",
  "Violencia y Abuso Sexual", "Trastorno Obsesivo-Compulsivo (TOC)",
  "Psicosis y Esquizofrenia", "Hebefrenia",
  "Trastorno Límite de la Personalidad (TLP)",
  "Ansiedad y Ataques de Pánico", "Síndrome de Burnout",
  "Acoso Laboral", "Bullying", "Autolesiones e Ideación Suicida",
];

const THERAPY_TYPES = [
  "Psicología clínica", "Psicoanálisis", "Terapia cognitivo-conductual",
  "Terapias vinculares", "Terapia sistémica", "Logoterapia",
  "Terapia gestáltica", "Neuropsicología", "Mindfulness",
  "Psicología laboral / organizacional", "Psicología positiva",
  "Psicología forense", "Adicciones", "EMDR",
  "Trastornos alimentarios", "Psiconutrición", "Psicooncología",
  "Psicología geriátrica", "Psicología deportiva", "Psicología perinatal",
  "Terapia humanista", "Terapia junguiana", "Psicodrama",
  "Psicoterapia Integral", "Deportología", "Psicocorporal Reichiana",
  "Terapia transpersonal", "Terapia constructivista", "Otras terapias",
];

const TARGET_AUDIENCES = [
  "Niños/as", "Adolescentes", "Adultos mayores", "Adultos",
  "Jóvenes", "Parejas", "Familias", "Orientación a padres",
];

const THERAPY_MODALITIES = [
  "Individual", "Vincular", "Evaluaciones", "Terapia Grupal",
  "Orientación a Padres", "Asesoría a Empresas", "Pericias",
  "Discapacidad", "Orientación Vocacional",
];

const MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "híbrida", label: "Híbrida" },
  { value: "ambas", label: "Ambas" },
];

// Días de la semana: 1=Lun, 2=Mar, ..., 6=Sab, 0=Dom
const WEEK_DAYS = [
  { dayOfWeek: 1, short: "Lun", label: "Lunes" },
  { dayOfWeek: 2, short: "Mar", label: "Martes" },
  { dayOfWeek: 3, short: "Mié", label: "Miércoles" },
  { dayOfWeek: 4, short: "Jue", label: "Jueves" },
  { dayOfWeek: 5, short: "Vie", label: "Viernes" },
  { dayOfWeek: 6, short: "Sáb", label: "Sábado" },
  { dayOfWeek: 0, short: "Dom", label: "Domingo" },
];

const MODALITY_COLORS: Record<string, string> = {
  P: "bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg py-2 text-xs font-medium hover:bg-emerald-100 transition-colors",
  OL: "bg-blue-50 border border-blue-200 text-blue-600 rounded-lg py-2 text-xs font-medium hover:bg-blue-100 transition-colors",
  H: "bg-purple-50 border border-purple-200 text-purple-600 rounded-lg py-2 text-xs font-medium hover:bg-purple-100 transition-colors",
  ambas: "bg-amber-50 border border-amber-200 text-amber-600 rounded-lg py-2 text-xs font-medium hover:bg-amber-100 transition-colors",
  amb: "bg-amber-50 border border-amber-200 text-amber-600 rounded-lg py-2 text-xs font-medium hover:bg-amber-100 transition-colors",
};

const MODALITY_LABELS: Record<string, string> = {
  P: "Presencial", OL: "Online", H: "Híbrido", ambas: "Ambas", amb: "Ambas",
};

// ====================================================================
// TYPES
// ====================================================================

interface AvailableSlot {
  time: string;
  endTime: string;
  modality: string;
  duration: number;
}

interface BookedSlot {
  id: string;
  time: string;
  date?: string;
  modality: string | null;
  status: string;
  notes: string | null;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string | null;
}

interface DaySlots {
  date: string;
  availableSlots: AvailableSlot[];
  bookedSlots: BookedSlot[];
}

interface ProfessionalResult {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string;
  profession: string | null;
  modalityBadges: string[];
  weeklySlots: Record<number, DaySlots>;
  totalFreeSlots: number;
  totalBookedSlots: number;
  hasAvailability: boolean;
}

interface SearchResponse {
  criteria: Record<string, unknown>;
  summary: {
    totalProfessionalsMatched: number;
    professionalsWithSlots: number;
    professionalsWithoutSlots: number;
    totalSlotsAvailable: number;
    totalBookedSlots: number;
  };
  weekDates: string[];
  professionals: ProfessionalResult[];
}

interface MetricsResponse {
  occupancyRate: number;
  activeProfessionals: number;
  totalSlotsThisWeek: number;
  bookedSlotsThisWeek: number;
  freeSlotsThisWeek: number;
  topSpecialties: { specialty: string; count: number }[];
  appointmentsByStatus: Record<string, number>;
  weekRange: { start: string; end: string };
}

interface AssignFormData {
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  notes: string;
  modality: string; // "P" | "OL" | "H" — selector del dialog
  isLead: boolean;
  leadId: string | null;
}

// ====================================================================
// HELPERS
// ====================================================================

const ARG_TZ = "America/Argentina/Buenos_Aires";

function isSlotInPast(date: string, time: string): boolean {
  try {
    const nowInArgentina = new Date(new Date().toLocaleString("en-US", { timeZone: ARG_TZ }));
    const slotDateTimeStr = `${date}T${time}:00`;
    const slotDateRaw = new Date(slotDateTimeStr);
    const slotInArgentina = new Date(slotDateRaw.toLocaleString("en-US", { timeZone: ARG_TZ }));
    return slotInArgentina < nowInArgentina;
  } catch {
    return false;
  }
}

function getMondayOfWeek(weekOffset: number): Date {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  return addDays(monday, weekOffset * 7);
}

// ====================================================================
// COMPONENTE PRINCIPAL
// ====================================================================

export function AdminAgendaCentral() {
  // === Estado del buscador ===
  const [profession, setProfession] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [selectedTherapyTypes, setSelectedTherapyTypes] = useState<string[]>([]);
  const [selectedTargetAudience, setSelectedTargetAudience] = useState<string[]>([]);
  const [selectedTherapyModalities, setSelectedTherapyModalities] = useState<string[]>([]);
  const [modality, setModality] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  // === Columna de filtros colapsable ===
  const [filtersOpen, setFiltersOpen] = useState(true);

  // === Estado de resultados ===
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // === Profesional activo (seleccionado en la columna 2) ===
  const [activeProfessionalId, setActiveProfessionalId] = useState<string | null>(null);

  // === Estado de dialogs ===
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    professional: ProfessionalResult | null;
    slot: AvailableSlot | null;
    date: string;
  }>({ open: false, professional: null, slot: null, date: "" });

  const [fichaDialog, setFichaDialog] = useState<{
    open: boolean;
    professional: ProfessionalResult | null;
    slot: BookedSlot | null;
  }>({ open: false, professional: null, slot: null });

  const [assignForm, setAssignForm] = useState<AssignFormData>({
    patientName: "", patientPhone: "", patientEmail: "", notes: "", modality: "P", isLead: false, leadId: null,
  });
  const [assigning, setAssigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // === Calcular weekStart (lunes de la semana seleccionada) ===
  const monday = useMemo(() => getMondayOfWeek(weekOffset), [weekOffset]);
  const weekStartISO = useMemo(() => format(monday, "yyyy-MM-dd"), [monday]);

  const weekLabel = useMemo(() => {
    const sunday = addDays(monday, 6);
    return `${format(monday, "d 'de' MMM", { locale: es })} — ${format(sunday, "d 'de' MMM", { locale: es })}`;
  }, [monday]);

  // === Cargar métricas ===
  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch("/api/admin/agenda-metrics");
      if (res.ok) setMetrics(await res.json());
    } catch (err) {
      console.error("Error loading metrics:", err);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  // === Ejecutar búsqueda ===
  const handleSearch = useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("weekStart", weekStartISO);
      if (profession) params.set("profession", profession);
      if (specialty) params.set("specialty", specialty);
      if (selectedTherapyTypes.length > 0) params.set("therapyTypes", selectedTherapyTypes.join(","));
      if (selectedTargetAudience.length > 0) params.set("targetAudience", selectedTargetAudience.join(","));
      if (selectedTherapyModalities.length > 0) params.set("therapyModalities", selectedTherapyModalities.join(","));
      if (modality) params.set("modality", modality);

      const res = await fetch(`/api/admin/search-professionals?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al buscar profesionales");
        return;
      }
      const data: SearchResponse = await res.json();
      setSearchResults(data);

      // Auto-seleccionar el primer profesional con slots
      if (data.professionals.length > 0 && data.professionals[0].hasAvailability) {
        setActiveProfessionalId(data.professionals[0].id);
      } else {
        setActiveProfessionalId(null);
      }

      toast.success(`${data.summary.totalProfessionalsMatched} profesionales — ${data.summary.totalSlotsAvailable} slots libres`);
    } catch (err) {
      console.error("Error searching:", err);
      toast.error("Error de conexión al buscar");
    } finally {
      setSearching(false);
    }
  }, [weekStartISO, profession, specialty, selectedTherapyTypes, selectedTargetAudience, selectedTherapyModalities, modality]);

  // === Búsqueda automática al cambiar semana ===
  // FIX: incluir handleSearch en deps para que el re-fetch se dispare
  // correctamente cuando weekOffset cambia. Antes tenía eslint-disable
  // que silenciaba la warning de deps faltantes, pero eso causaba que
  // el useEffect no se re-ejecutara cuando handleSearch se recreaba
  // con el nuevo weekStartISO.
  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // === Toggles ===
  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setter((prev) => prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]);
  };

  // === Handlers de dialogs ===
  const openAssignDialog = (professional: ProfessionalResult, slot: AvailableSlot, date: string) => {
    setAssignForm({
      patientName: "",
      patientPhone: "",
      patientEmail: "",
      notes: "",
      modality: slot.modality, // heredar del slot
      isLead: false,
      leadId: null,
    });
    setAssignDialog({ open: true, professional, slot, date });
  };

  const openFichaDialog = (professional: ProfessionalResult, slot: BookedSlot) => {
    setFichaDialog({ open: true, professional, slot });
  };

  // === Confirmar asignación ===
  const handleConfirmAssign = async () => {
    if (!assignDialog.professional || !assignDialog.slot) return;
    if (!assignForm.patientName.trim() || !assignForm.patientEmail.trim() || !assignForm.patientPhone.trim()) {
      toast.error("Nombre, teléfono y email del paciente son obligatorios");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/quick-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: assignDialog.professional.id,
          date: assignDialog.date,
          time: assignDialog.slot.time,
          modality: assignForm.modality,
          patientName: assignForm.patientName.trim(),
          patientPhone: assignForm.patientPhone.trim(),
          patientEmail: assignForm.patientEmail.trim(),
          notes: assignForm.notes.trim() || null,
          isLead: assignForm.isLead,
          leadId: assignForm.leadId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al asignar el turno"); return; }

      const patientVerb = data.created ? "creado" : "actualizado";
      const emailFlags: string[] = [];
      if (data.emailSent?.patient) emailFlags.push("paciente notificado");
      if (data.emailSent?.professional) emailFlags.push("profesional notificado");
      const emailMsg = emailFlags.length > 0
        ? ` ${emailFlags.join(" · ")}.`
        : " No se pudieron enviar notificaciones.";
      toast.success(`Turno asignado a ${data.patient.name} (${patientVerb}).${emailMsg} ${assignDialog.professional.name} — ${assignDialog.date} ${assignDialog.slot.time} hs.`);
      setAssignDialog((prev) => ({ ...prev, open: false }));
      handleSearch();
    } catch (err) {
      console.error("Error assigning:", err);
      toast.error("Error de conexión al asignar el turno");
    } finally {
      setAssigning(false);
    }
  };

  // === Cancelar turno desde la ficha rápida ===
  const handleCancelAppointment = async (slot: BookedSlot) => {
    if (!slot) return;
    if (!confirm(`¿Confirmar cancelación del turno de ${slot.patientName}?\n\nEl slot quedará libre para nueva asignación.`)) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/appointments/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al cancelar el turno");
        return;
      }
      toast.success(`Turno de ${slot.patientName} cancelado. Slot liberado.`);
      setFichaDialog((prev) => ({ ...prev, open: false }));
      handleSearch(); // re-fetch automático de la grilla
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      toast.error("Error de conexión al cancelar el turno");
    } finally {
      setCancelling(false);
    }
  };

  const handleClearFilters = () => {
    setProfession(""); setSpecialty("");
    setSelectedTherapyTypes([]); setSelectedTargetAudience([]);
    setSelectedTherapyModalities([]); setModality("");
  };

  // === Profesional activo ===
  const activeProfessional = useMemo(() => {
    if (!searchResults || !activeProfessionalId) return null;
    return searchResults.professionals.find((p) => p.id === activeProfessionalId) || null;
  }, [searchResults, activeProfessionalId]);

  // ====================================================================
  // RENDER — Split View de 3 columnas
  // ====================================================================

  return (
    <div className="space-y-4">
      {/* === Header === */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-teal-900 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-teal-600" />
            Agenda Centralizada
          </h1>
          <p className="text-sm text-teal-600 mt-1">Grilla matricial semanal — Lun a Dom</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadMetrics(); handleSearch(); }} className="border-teal-200 text-teal-600 hover:bg-teal-50">
          <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
        </Button>
      </div>

      {/* === Dashboard de métricas === */}
      <MetricsDashboard metrics={metrics} loading={loadingMetrics} />

      {/* === Split View de 3 columnas (colapsable) === */}
      <div className={`grid gap-4 transition-all duration-300 ${
        filtersOpen
          ? "lg:grid-cols-[260px_230px_1fr]"
          : "lg:grid-cols-[40px_230px_1fr]"
      }`}>

        {/* ============================================== */}
        {/* COLUMNA 1: Buscador lateral colapsable */}
        {/* ============================================== */}
        {filtersOpen ? (
          <Card className="border-teal-100 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <CardHeader className="pb-2 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-teal-900 flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filtros
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(false)} className="h-6 w-6 p-0 text-teal-400 hover:bg-teal-50">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
              {/* Navegador de semanas */}
              <div className="flex items-center gap-1 mt-1">
                <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)} className="h-6 w-6 p-0 border-teal-200">
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-teal-600 hover:bg-teal-50 text-[10px] flex-1">
                  {weekOffset === 0 ? "Esta semana" : `Semana ${weekOffset > 0 ? "+" : ""}${weekOffset}`}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)} className="h-6 w-6 p-0 border-teal-200">
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[9px] text-teal-500 text-center mt-0.5">{weekLabel}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-teal-700 font-medium">Profesión</Label>
                <Select value={profession || "__all__"} onValueChange={(v) => setProfession(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-[11px] border-teal-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent><SelectItem value="__all__">Todas</SelectItem>{PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-teal-700 font-medium">Especialidad</Label>
                <Select value={specialty || "__all__"} onValueChange={(v) => setSpecialty(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-[11px] border-teal-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent><SelectItem value="__all__">Todas</SelectItem>{SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-teal-700 font-medium">Modalidad atención</Label>
                <Select value={modality || "__all__"} onValueChange={(v) => setModality(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-[11px] border-teal-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent><SelectItem value="__all__">Todas</SelectItem>{MODALITIES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-teal-700 font-medium">Tipos de terapia</Label>
                <div className="max-h-24 overflow-y-auto border border-teal-100 rounded-md p-1 bg-teal-50/30 space-y-0.5">
                  {THERAPY_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-1.5 text-[10px] cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                      <Checkbox checked={selectedTherapyTypes.includes(t)} onCheckedChange={() => toggleArrayItem(setSelectedTherapyTypes, t)} className="h-3 w-3" />
                      <span className="text-teal-700">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-teal-700 font-medium">Población objetivo</Label>
                <div className="border border-teal-100 rounded-md p-1 bg-teal-50/30 space-y-0.5">
                  {TARGET_AUDIENCES.map((t) => (
                    <label key={t} className="flex items-center gap-1.5 text-[10px] cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                      <Checkbox checked={selectedTargetAudience.includes(t)} onCheckedChange={() => toggleArrayItem(setSelectedTargetAudience, t)} className="h-3 w-3" />
                      <span className="text-teal-700">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-teal-700 font-medium">Modalidad de terapia</Label>
                <div className="border border-teal-100 rounded-md p-1 bg-teal-50/30 space-y-0.5">
                  {THERAPY_MODALITIES.map((t) => (
                    <label key={t} className="flex items-center gap-1.5 text-[10px] cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                      <Checkbox checked={selectedTherapyModalities.includes(t)} onCheckedChange={() => toggleArrayItem(setSelectedTherapyModalities, t)} className="h-3 w-3" />
                      <span className="text-teal-700">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 pt-1">
                <Button onClick={handleSearch} disabled={searching} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-7 text-[11px]">
                  {searching ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Buscando...</> : <><Search className="w-3 h-3 mr-1" /> Buscar</>}
                </Button>
                <Button onClick={handleClearFilters} variant="outline" size="sm" className="w-full h-6 text-[10px] border-teal-200 text-teal-600 hover:bg-teal-50">Limpiar</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-teal-100 flex flex-col items-center py-2 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(true)} className="h-8 w-8 p-0 text-teal-600 hover:bg-teal-50">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Filter className="w-4 h-4 text-teal-400" />
            {/* Navegador de semanas compacto cuando colapsado */}
            <div className="flex flex-col gap-1">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)} className="h-6 w-6 p-0 border-teal-200">
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)} className="h-6 w-6 p-0 border-teal-200">
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        )}

        {/* ============================================== */}
        {/* COLUMNA 2: Lista de profesionales */}
        {/* ============================================== */}
        <Card className="border-teal-100 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <CardHeader className="pb-2 sticky top-0 bg-white z-10">
            <CardTitle className="text-sm text-teal-900">
              Profesionales {searchResults && `(${searchResults.summary.totalProfessionalsMatched})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            {searching ? (
              <div className="py-8 text-center"><RefreshCw className="w-6 h-6 text-teal-400 mx-auto animate-spin" /></div>
            ) : !searchResults ? (
              <div className="py-8 text-center"><Search className="w-6 h-6 text-teal-300 mx-auto" /><p className="text-teal-500 mt-2 text-xs">Hacé clic en "Buscar"</p></div>
            ) : searchResults.professionals.length === 0 ? (
              <div className="py-8 text-center"><AlertCircle className="w-6 h-6 text-amber-400 mx-auto" /><p className="text-teal-600 mt-2 text-xs">Sin resultados</p></div>
            ) : (
              searchResults.professionals.map((prof) => (
                <button
                  key={prof.id}
                  onClick={() => setActiveProfessionalId(prof.id)}
                  className={`w-full text-left p-2 rounded-lg border transition-all ${
                    activeProfessionalId === prof.id
                      ? "border-teal-500 bg-teal-50 shadow-sm ring-1 ring-teal-300"
                      : "border-teal-100 hover:border-teal-300 hover:bg-teal-50/50"
                  }`}
                >
                  <p className="text-xs font-medium text-teal-900 truncate">{prof.name}</p>
                  <p className="text-[10px] text-teal-500 truncate">{prof.specialty}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700 px-1 py-0">
                      {prof.totalFreeSlots} lib
                    </Badge>
                    <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200 text-slate-600 px-1.5 py-0">
                      {prof.totalBookedSlots} ocup
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* ============================================== */}
        {/* COLUMNA 3: Matriz Excel del profesional activo */}
        {/* ============================================== */}
        <Card className="border-teal-100 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {activeProfessional ? (
            <>
              <CardHeader className="pb-3 bg-white">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base text-teal-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-teal-600" />
                      {activeProfessional.name}
                    </CardTitle>
                    <p className="text-xs text-teal-500">{activeProfessional.specialty} · {weekLabel}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">{activeProfessional.totalFreeSlots} libres</Badge>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">{activeProfessional.totalBookedSlots} ocupados</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={`pt-2 transition-opacity duration-200 ${searching ? "opacity-40 pointer-events-none" : ""}`}>
                {searching && (
                  <div className="absolute inset-0 flex items-center justify-center z-30">
                    <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
                  </div>
                )}
                <ExcelMatrix
                  professional={activeProfessional}
                  weekDates={searchResults?.weekDates || []}
                  onSlotClick={(slot, date) => openAssignDialog(activeProfessional, slot, date)}
                  onBookedSlotClick={(slot) => openFichaDialog(activeProfessional, slot)}
                />
              </CardContent>
            </>
          ) : (
            <CardContent className="py-16 text-center">
              <Calendar className="w-10 h-10 text-teal-300 mx-auto" />
              <p className="text-teal-600 mt-3 text-sm">Seleccioná un profesional de la lista para ver su grilla semanal</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* === Dialogs === */}
      <AssignDialog
        open={assignDialog.open}
        onOpenChange={(open) => setAssignDialog((prev) => ({ ...prev, open }))}
        professional={assignDialog.professional}
        slot={assignDialog.slot}
        date={assignDialog.date}
        form={assignForm}
        onFormChange={setAssignForm}
        onConfirm={handleConfirmAssign}
        assigning={assigning}
      />
      <FichaDialog
        open={fichaDialog.open}
        onOpenChange={(open) => setFichaDialog((prev) => ({ ...prev, open }))}
        professional={fichaDialog.professional}
        slot={fichaDialog.slot}
        onCancel={handleCancelAppointment}
        cancelling={cancelling}
      />
    </div>
  );
}

// ====================================================================
// SUB-COMPONENTE: Dashboard de métricas
// ====================================================================

function MetricsDashboard({ metrics, loading }: { metrics: MetricsResponse | null; loading: boolean }) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-teal-100"><CardContent className="p-2 animate-pulse"><div className="h-3 bg-teal-100 rounded w-1/2 mb-1"></div><div className="h-6 bg-teal-100 rounded w-2/3"></div></CardContent></Card>
        ))}
      </div>
    );
  }
  const occupancyPercent = Math.round(metrics.occupancyRate * 100);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Card className="border-teal-100"><CardContent className="p-2"><div className="flex items-center gap-1.5 mb-0.5"><TrendingUp className="w-3.5 h-3.5 text-teal-600" /><p className="text-[10px] text-teal-500 font-medium">Ocupación</p></div><p className="text-xl font-bold text-teal-900">{occupancyPercent}%</p><p className="text-[10px] text-teal-400">{metrics.bookedSlotsThisWeek}/{metrics.totalSlotsThisWeek}</p></CardContent></Card>
      <Card className="border-teal-100"><CardContent className="p-2"><div className="flex items-center gap-1.5 mb-0.5"><Stethoscope className="w-3.5 h-3.5 text-emerald-600" /><p className="text-[10px] text-teal-500 font-medium">Profesionales</p></div><p className="text-xl font-bold text-teal-900">{metrics.activeProfessionals}</p><p className="text-[10px] text-teal-400">activos</p></CardContent></Card>
      <Card className="border-teal-100"><CardContent className="p-2"><div className="flex items-center gap-1.5 mb-0.5"><Calendar className="w-3.5 h-3.5 text-amber-600" /><p className="text-[10px] text-teal-500 font-medium">Slots libres</p></div><p className="text-xl font-bold text-teal-900">{metrics.freeSlotsThisWeek}</p><p className="text-[10px] text-teal-400">esta semana</p></CardContent></Card>
      <Card className="border-teal-100"><CardContent className="p-2"><div className="flex items-center gap-1.5 mb-0.5"><Users className="w-3.5 h-3.5 text-blue-600" /><p className="text-[10px] text-teal-500 font-medium">Top especialidad</p></div>{metrics.topSpecialties.length > 0 ? <><p className="text-xs font-bold text-teal-900 truncate">{metrics.topSpecialties[0].specialty}</p><p className="text-[10px] text-teal-400">{metrics.topSpecialties[0].count} turnos</p></> : <p className="text-xs text-teal-400">Sin datos</p>}</CardContent></Card>
    </div>
  );
}

// ====================================================================
// SUB-COMPONENTE: Matriz Excel (Lun-Dom × Horarios)
// ====================================================================

interface ExcelMatrixProps {
  professional: ProfessionalResult;
  weekDates: string[];
  onSlotClick: (slot: AvailableSlot, date: string) => void;
  onBookedSlotClick: (slot: BookedSlot) => void;
}

function ExcelMatrix({ professional, weekDates, onSlotClick, onBookedSlotClick }: ExcelMatrixProps) {
  // === REPLICA EXACTA de la grilla del profesional ===
  // El usuario pidió que la Agenda Central del admin se vea IGUAL que la
  // agenda del profesional. Por eso este componente ahora usa el mismo
  // patrón: generateTimeSlotsDynamic(slotDuration) para filas homogéneas
  // + grid grid-cols-[60px_repeat(7,1fr)] para las columnas.
  //
  // La ÚNICA diferencia con el profesional:
  // - 7 días (Lun-Dom) en vez de 6 (el profesional excluye domingo)
  // - Click en available → onSlotClick (asignar turno, no bloquear)
  // - Click en booked → onBookedSlotClick (ver ficha, no editar)

  // === generateTimeSlotsDynamic: replicado de professional-weekly-agenda.tsx ===
  // Genera slots de 06:00 a 24:00 según el slotDuration del profesional.
  // Esto da uniformidad visual: si el profesional usa 45 min, las filas son
  // 06:00, 06:45, 07:30, 08:15... (NO 06:00, 06:30, 07:00 como antes).
  const generateTimeSlotsDynamic = (slotDuration: number): string[] => {
    const slots: string[] = [];
    let h = 6, m = 0;
    const endH = 24;
    while (h < endH) {
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      m += slotDuration;
      while (m >= 60) { h += 1; m -= 60; }
    }
    return slots;
  };

  // === Calcular slotDuration más común del profesional ===
  // (mismo algoritmo que professional-weekly-agenda.tsx línea 358-367)
  const timeSlots = useMemo(() => {
    // Recolectar todos los slotDuration disponibles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const durations: number[] = [];
    for (const day of WEEK_DAYS) {
      const dayData = professional.weeklySlots[day.dayOfWeek];
      if (dayData) {
        dayData.availableSlots.forEach((s) => durations.push(s.duration || 45));
      }
    }
    if (durations.length === 0) return generateTimeSlotsDynamic(45);
    // Encontrar el slotDuration más frecuente
    const counts: Record<number, number> = {};
    for (const d of durations) {
      counts[d] = (counts[d] || 0) + 1;
    }
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const slotDuration = mostCommon ? parseInt(mostCommon[0], 10) : 45;
    return generateTimeSlotsDynamic(slotDuration);
  }, [professional]);

  // Verificar si el profesional tiene AL MENOS un slot en toda la semana
  const hasAnySlot = Object.values(professional.weeklySlots).some(
    (dayData) => dayData && (dayData.availableSlots.length > 0 || dayData.bookedSlots.length > 0)
  );

  if (!hasAnySlot) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
        <p className="text-teal-600 mt-2 text-sm">Este profesional no tiene horarios configurados para esta semana</p>
      </div>
    );
  }

  // === Grid template IDÉNTICO al profesional ===
  // 60px hora + 7 × 1fr días = uniforme, mismo patrón que funciona en profesional
  const GRID_TEMPLATE = "grid grid-cols-[60px_repeat(7,1fr)]";

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[900px]">

        {/* === Header: day names and dates (IDÉNTICO al profesional) === */}
        <div className={GRID_TEMPLATE + " border-b border-teal-100"}>
          <div className="p-2 text-xs text-teal-400 text-center" />
          {WEEK_DAYS.map((day) => {
            const dayData = professional.weeklySlots[day.dayOfWeek];
            const dateStr = dayData?.date || "";
            const dayNum = dateStr ? format(parseISO(dateStr), "d", { locale: es }) : "";
            const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
            return (
              <div
                key={day.dayOfWeek}
                className={`p-2 text-center border-l border-teal-50 ${isToday ? "bg-teal-50" : ""}`}
              >
                <p className={`text-xs font-medium ${isToday ? "text-teal-700" : "text-teal-500"}`}>
                  {day.short}
                </p>
                <p className={`text-sm font-bold ${isToday ? "w-7 h-7 rounded-full flex items-center justify-center mx-auto bg-teal-600 text-white" : "text-teal-800"}`}>
                  {dayNum}
                </p>
              </div>
            );
          })}
        </div>

        {/* === Time rows (IDÉNTICO al profesional) === */}
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {timeSlots.map((time) => (
            <div
              key={time}
              className={GRID_TEMPLATE + " border-b border-teal-50/50 last:border-b-0"}
            >
              {/* Time label */}
              <div className="p-1 text-[11px] text-teal-400 text-right pr-2 border-r border-teal-50 flex items-start justify-end pt-1.5">
                {time}
              </div>

              {/* Day cells */}
              {WEEK_DAYS.map((day) => {
                const dayData = professional.weeklySlots[day.dayOfWeek];
                const dateStr = dayData?.date || "";
                const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

                // === SNAP-DOWN para todos los tipos de slot ===
                // Replica exacta de la lógica de professional-weekly-agenda.tsx
                // getAppointmentForCell (líneas 597-609):
                // Los turnos pueden empezar en minutos no múltiplos de slotDuration
                // (ej: 08:15 con slotDuration=45). Para que aparezcan en la grilla,
                // hacemos snap-down: el appointment se muestra en el slot más cercano
                // ANTERIOR a su hora real. Ej: 08:15 → slot 08:00.
                //
                // Esto se aplica a availableSlots, allScheduleSlots Y bookedSlots
                // para que TODOS los slots aparezcan en la grilla, sin importar
                // si su hora real coincide con un múltiplo exacto del slotDuration
                // más común usado para generar las filas.
                const findWithSnapDown = (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  slots: any[] | undefined,
                  time: string
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ): any | undefined => {
                  if (!slots || slots.length === 0) return undefined;
                  return slots.find((s) => {
                    if (s.time === time) return true;
                    // Snap-down: buscar slots anteriores al start real
                    const slotsBefore = timeSlots.filter((t) => t <= s.time);
                    const snappedSlot = slotsBefore[slotsBefore.length - 1];
                    return snappedSlot === time;
                  });
                };

                const freeSlot = findWithSnapDown(dayData?.availableSlots, time);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const scheduleSlot = findWithSnapDown((dayData as any)?.allScheduleSlots, time);
                const bookedSlot = findWithSnapDown(dayData?.bookedSlots, time);

                // Determinar estado de la celda (misma lógica que el profesional)
                // ORDEN de prioridad: booked > available (clickeable) > past-available (no clickeable) > outside
                let state: "available" | "booked" | "outside" | "blocked" | "past" = "outside";

                if (dayData) {
                  if (bookedSlot && bookedSlot.status === "blocked") {
                    state = "blocked";
                  } else if (bookedSlot) {
                    state = "booked";
                  } else if (freeSlot) {
                    state = "available";
                  } else if (scheduleSlot) {
                    // Slot que estaba en el schedule pero ya pasó o está booked
                    // Mostrar modalidad pero NO clickeable
                    state = "past";
                  }
                }

                // Clases CSS (IDÉNTICAS al profesional, +past)
                let cellClass = "border-l border-teal-50/50 p-0.5 min-h-[32px] transition-colors ";

                if (state === "outside" || state === "blocked") {
                  cellClass += "bg-gray-50/50 ";
                } else if (state === "available") {
                  cellClass += "bg-emerald-50/60 ";
                } else if (state === "booked") {
                  cellClass += "bg-white ";
                } else if (state === "past") {
                  // Slot pasado: fondo gris claro pero muestra modalidad
                  cellClass += "bg-gray-50/30 ";
                }

                if (isToday) {
                  cellClass += "border-l-2 border-l-teal-300 ";
                }

                const past = dayData ? isSlotInPast(dayData.date, time) : false;

                return (
                  <div
                    key={`${day.dayOfWeek}-${time}`}
                    className={cellClass}
                    onClick={(state === "available" && freeSlot && !past) ? () => onSlotClick(freeSlot, dayData!.date) : (state === "booked" && bookedSlot) ? () => onBookedSlotClick(bookedSlot) : undefined}
                    style={(state === "available" || state === "booked") ? { cursor: "pointer" } : undefined}
                  >
                    {/* === Slot LIBRE (clickeable) === */}
                    {state === "available" && freeSlot && (
                      <ModalityIndicator slot={freeSlot} past={past} />
                    )}

                    {/* === Slot PASADO (muestra modalidad pero no clickeable) === */}
                    {state === "past" && scheduleSlot && (
                      <ModalityIndicator
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        slot={scheduleSlot as any}
                        past={true}
                      />
                    )}

                    {/* === Slot BLOQUEADO por el profesional === */}
                    {state === "blocked" && (
                      <div
                        className="flex items-center justify-center w-full bg-slate-200 border border-slate-400 text-slate-700 rounded-md py-1.5 text-[10px] font-bold select-none"
                        title="Slot bloqueado por el profesional"
                      >
                        🔒 Ocupado
                      </div>
                    )}

                    {/* === Slot OCUPADO (appointment) === */}
                    {state === "booked" && bookedSlot && (
                      <BookedSlotCard slot={bookedSlot} past={past} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px] text-teal-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200"></span>Presencial</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200"></span>Online</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-50 border border-purple-200"></span>Híbrido</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200"></span>Ambas</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-300"></span>Ocupado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 border-2 border-slate-400"></span>Bloqueado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 opacity-40"></span>Pasado</span>
      </div>
    </div>
  );
}

// === Sub-componentes para mantener el código limpio ===
// (replican el renderModalityIndicator y renderAppointment del profesional)

function ModalityIndicator({ slot, past }: { slot: AvailableSlot; past: boolean }) {
  const display = MODALITY_LABELS[slot.modality] || slot.modality;
  const colorClass = MODALITY_COLORS[slot.modality] || MODALITY_COLORS.ambas;
  return (
    <div
      className={`flex items-center justify-center w-full rounded py-1.5 text-[10px] font-medium ${past ? "opacity-40" : ""} ${colorClass}`}
      title={`${display} — ${slot.time} a ${slot.endTime} hs (click para asignar)`}
    >
      {display}
    </div>
  );
}

function BookedSlotCard({ slot, past }: { slot: BookedSlot; past: boolean }) {
  const isRescheduled = slot.status === "rescheduled";
  const isCancelledByProf = slot.status === "cancelled_by_professional";
  const isCompleted = slot.status === "completed";
  const isAbsent = slot.status === "absent";

  let cellClass = "w-full text-center rounded py-1.5 text-[10px] font-bold bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 transition-colors truncate";
  let cellText = slot.patientName.split(" ").slice(0, 2).join(" ");

  if (isRescheduled) {
    cellClass = "w-full text-center rounded py-1.5 text-[10px] font-semibold bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors truncate";
    cellText = "⚠️ Reprogramado";
  } else if (isCancelledByProf) {
    cellClass = "w-full text-center rounded py-1.5 text-[10px] font-bold bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 transition-colors truncate line-through";
    cellText = slot.patientName.split(" ").slice(0, 2).join(" ");
  } else if (isCompleted) {
    cellClass = "w-full text-center rounded py-1.5 text-[10px] font-bold bg-gray-100 border border-gray-300 text-gray-500 hover:bg-gray-200 transition-colors truncate";
    cellText = `✓ ${slot.patientName.split(" ").slice(0, 2).join(" ")}`;
  } else if (isAbsent) {
    cellClass = "w-full text-center rounded py-1.5 text-[10px] font-bold bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors truncate";
    cellText = `⊘ ${slot.patientName.split(" ").slice(0, 2).join(" ")}`;
  }

  return (
    <div
      className={`w-full px-1 ${past ? "opacity-60" : ""}`}
      title={`${slot.patientName} — ${slot.status}${slot.notes ? ` — ${slot.notes}` : ""} (click para ver ficha)`}
    >
      <div className={cellClass}>
        {cellText}
      </div>
      <div className="text-[9px] text-teal-500 text-center mt-0.5 font-mono">
        {slot.time}
      </div>
    </div>
  );
}

// ====================================================================
// SUB-COMPONENTE: Dialog de asignación rápida
// ====================================================================

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: ProfessionalResult | null;
  slot: AvailableSlot | null;
  date: string;
  form: AssignFormData;
  onFormChange: (form: AssignFormData) => void;
  onConfirm: () => void;
  assigning: boolean;
}

function AssignDialog({ open, onOpenChange, professional, slot, date, form, onFormChange, onConfirm, assigning }: AssignDialogProps) {
  const [patientSearch, setPatientSearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search de pacientes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (patientSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search-patients?q=${encodeURIComponent(patientSearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error("Error searching patients:", err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [patientSearch]);

  // Limpiar búsqueda cuando se cierra el dialog
  useEffect(() => {
    if (!open) {
      setPatientSearch("");
      setSearchResults([]);
      setShowSuggestions(false);
    }
  }, [open]);

  // Seleccionar paciente existente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectPatient = (patient: any) => {
    const cleanName = patient.isLead ? patient.name.replace(" (Solicitud Online)", "") : patient.name;
    onFormChange({
      ...form,
      patientName: cleanName,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      isLead: patient.isLead || false,
      leadId: patient.isLead ? patient.id : null,
    });
    setPatientSearch(patient.name);
    setShowSuggestions(false);
  };

  // Cuando el admin escribe en el input de búsqueda, también actualiza patientName
  // para que si no selecciona ningún suggestion, se use lo que escribió
  const handleSearchInputChange = (value: string) => {
    setPatientSearch(value);
    onFormChange({ ...form, patientName: value, isLead: false, leadId: null });
  };

  if (!professional || !slot) return null;
  let dateLabel = date;
  try { dateLabel = format(parseISO(date), "EEEE d 'de' MMMM", { locale: es }); } catch { /* keep ISO */ }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-teal-600" /> Asignar turno</DialogTitle>
          <DialogDescription className="text-teal-600">{professional.name} — {professional.specialty}</DialogDescription>
        </DialogHeader>
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1">
          <p className="text-sm text-teal-900 font-medium capitalize">{dateLabel}</p>
          <p className="text-sm text-teal-700"><Clock className="w-3.5 h-3.5 inline mr-1" />{slot.time} a {slot.endTime} hs</p>
        </div>

        <div className="space-y-3">
          {/* === Combobox de búsqueda de pacientes === */}
          <div className="space-y-1 relative">
            <Label className="text-xs text-teal-700 font-medium">Buscar paciente existente o escribir nuevo <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                value={patientSearch}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
                placeholder="Escribí nombre o email para buscar..."
                className="h-8 text-sm border-teal-200 pr-8"
              />
              {searching && <RefreshCw className="w-3.5 h-3.5 text-teal-400 animate-spin absolute right-2 top-2" />}
            </div>
            {/* Sugerencias de autocompletado */}
            {showSuggestions && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-teal-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPatient(p)}
                    className="w-full text-left px-3 py-2 hover:bg-teal-50 transition-colors border-b border-teal-50 last:border-0"
                  >
                    <p className="text-sm font-medium text-teal-900">{p.name}</p>
                    <p className="text-[10px] text-teal-500">{p.email} {p.phone && `· ${p.phone}`}</p>
                  </button>
                ))}
              </div>
            )}
            {showSuggestions && patientSearch.length >= 2 && !searching && searchResults.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-teal-200 rounded-lg shadow-lg p-3">
                <p className="text-xs text-teal-500">No se encontraron pacientes. Completá los campos abajo para crear uno nuevo.</p>
              </div>
            )}
          </div>

          {/* Datos del paciente (autocompletados o manuales) */}
          <div className="space-y-1">
            <Label className="text-xs text-teal-700 font-medium">Nombre completo <span className="text-red-500">*</span></Label>
            <Input value={form.patientName} onChange={(e) => { onFormChange({ ...form, patientName: e.target.value }); setPatientSearch(e.target.value); }} placeholder="Nombre y apellido" className="h-8 text-sm border-teal-200" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs text-teal-700 font-medium">Teléfono <span className="text-red-500">*</span></Label><Input value={form.patientPhone} onChange={(e) => onFormChange({ ...form, patientPhone: e.target.value })} placeholder="+54 11 xxxx-xxxx" className="h-8 text-sm border-teal-200" /></div>
            <div className="space-y-1"><Label className="text-xs text-teal-700 font-medium">Email <span className="text-red-500">*</span></Label><Input type="email" value={form.patientEmail} onChange={(e) => onFormChange({ ...form, patientEmail: e.target.value })} placeholder="paciente@email.com" className="h-8 text-sm border-teal-200" /></div>
          </div>

          {/* === Selector de modalidad === */}
          <div className="space-y-1">
            <Label className="text-xs text-teal-700 font-medium">Modalidad de la sesión</Label>
            <Select value={form.modality} onValueChange={(v) => onFormChange({ ...form, modality: v })}>
              <SelectTrigger className="h-8 text-sm border-teal-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="P">Presencial</SelectItem>
                <SelectItem value="OL">Online</SelectItem>
                <SelectItem value="H">Híbrido</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-teal-500">Por defecto hereda la modalidad del slot, pero podés cambiarla.</p>
          </div>

          <div className="space-y-1"><Label className="text-xs text-teal-700 font-medium">Notas (opcional)</Label><Textarea value={form.notes} onChange={(e) => onFormChange({ ...form, notes: e.target.value })} placeholder="Motivo de consulta, observaciones..." className="text-sm border-teal-200 min-h-[50px]" rows={2} /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cancelar</Button>
          <Button onClick={onConfirm} disabled={assigning} className="bg-teal-600 hover:bg-teal-700 text-white">{assigning ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Asignando...</> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar Turno</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ====================================================================
// SUB-COMPONENTE: Dialog de ficha rápida (slot ocupado)
// ====================================================================

interface FichaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: ProfessionalResult | null;
  slot: BookedSlot | null;
  onCancel?: (slot: BookedSlot) => void;
  cancelling?: boolean;
}

function FichaDialog({ open, onOpenChange, professional, slot, onCancel, cancelling }: FichaDialogProps) {
  if (!professional || !slot) return null;
  const modalityLabel = slot.modality ? MODALITY_LABELS[slot.modality] || slot.modality : "—";
  const isRescheduled = slot.status === "rescheduled";
  const statusLabel = slot.status === "confirmed" ? "Confirmado" : slot.status === "pending" ? "Pendiente" : slot.status === "rescheduled" ? "Reprogramado" : slot.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-900 flex items-center gap-2"><Users className="w-5 h-5 text-teal-600" /> Ficha del turno</DialogTitle>
          <DialogDescription className="text-teal-600">{professional.name} — {professional.specialty}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm text-teal-900 font-bold"><Calendar className="w-4 h-4 text-teal-600" /><span className="capitalize">{(() => { try { return format(parseISO(slot.date || ""), "EEEE d 'de' MMMM", { locale: es }); } catch { return slot.date || ""; } })()}</span></div>
            <div className="flex items-center gap-2 text-sm text-teal-900 font-bold"><Clock className="w-4 h-4 text-teal-600" /><span>{slot.time} hs</span><Badge variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-700">{modalityLabel}</Badge></div>
            <div className="flex items-center gap-2 text-xs"><span className="text-teal-500">Estado:</span><Badge variant={isRescheduled ? "destructive" : slot.status === "confirmed" ? "default" : "outline"} className="text-xs">{statusLabel}</Badge></div>
          </div>

          {/* === Alerta de Reprogramación === */}
          {isRescheduled && (
            <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-semibold text-orange-800">Reprogramado — Pendiente de acción</p>
              </div>
              {slot.notes && (
                <div className="mt-2">
                  <p className="text-xs text-orange-600 font-medium mb-1">Notas del profesional:</p>
                  <p className="text-sm text-orange-800 bg-white rounded-md p-2 border border-orange-200">{slot.notes}</p>
                </div>
              )}
              {!slot.notes && <p className="text-xs text-orange-500 italic">Sin notas de reprogramación.</p>}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-teal-500 font-medium uppercase tracking-wide">Paciente</p>
            <p className="text-sm font-medium text-teal-900">{slot.patientName}</p>
            {(slot.patientPhone || slot.patientEmail) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                {slot.patientPhone && (<a href={`https://wa.me/${slot.patientPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 hover:underline transition-colors"><MessageCircle className="w-3 h-3 text-emerald-500" />{slot.patientPhone}</a>)}
                {slot.patientEmail && (<a href={`mailto:${slot.patientEmail}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline transition-colors"><Mail className="w-3 h-3 text-teal-500" />{slot.patientEmail}</a>)}
              </div>
            )}
            {!slot.patientPhone && !slot.patientEmail && <p className="text-xs text-teal-400 italic">Sin datos de contacto</p>}
          </div>

          {/* Mostrar notas generales si no es rescheduled pero tiene notas */}
          {!isRescheduled && slot.notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
              <p className="text-xs text-slate-500 font-medium mb-1">Notas:</p>
              <p className="text-sm text-slate-700">{slot.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          {/* === Solo permitir cancelar turnos FUTUROS o PENDIENTES ===
              NO se puede cancelar:
              - completed (ya atendido)
              - absent (paciente ausente)
              - cancelled (ya cancelado)
              - cancelled_by_professional (cancelado por el profesional)
              - blocked (slot bloqueado, no es un appointment real)
              SÍ se puede cancelar:
              - confirmed (confirmado, futuro)
              - pending (pendiente de confirmación)
              - rescheduled (reprogramado por el profesional, esperando nueva fecha)
          */}
          {onCancel && ["confirmed", "pending", "rescheduled"].includes(slot.status) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(slot)}
              disabled={cancelling}
              className="text-xs"
            >
              {cancelling ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Cancelando...</> : <><XCircle className="w-3 h-3 mr-1" /> Cancelar Turno</>}
            </Button>
          )}
          {/* === Mensaje informativo para turnos NO cancelables === */}
          {onCancel && ["completed", "absent", "cancelled", "cancelled_by_professional", "blocked"].includes(slot.status) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Turno no cancelable (estado: {slot.status === "completed" ? "atendido" : slot.status === "absent" ? "ausente" : slot.status === "blocked" ? "bloqueado" : "cancelado"})</span>
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
