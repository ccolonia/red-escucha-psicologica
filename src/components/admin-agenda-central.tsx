"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  P: "bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200",
  OL: "bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200",
  H: "bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200",
  ambas: "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200",
  amb: "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200",
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
  modality: string | null;
  status: string;
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
    patientName: "", patientPhone: "", patientEmail: "", notes: "",
  });
  const [assigning, setAssigning] = useState(false);

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
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  // === Toggles ===
  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setter((prev) => prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]);
  };

  // === Handlers de dialogs ===
  const openAssignDialog = (professional: ProfessionalResult, slot: AvailableSlot, date: string) => {
    setAssignForm({ patientName: "", patientPhone: "", patientEmail: "", notes: "" });
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
          modality: assignDialog.slot.modality,
          patientName: assignForm.patientName.trim(),
          patientPhone: assignForm.patientPhone.trim(),
          patientEmail: assignForm.patientEmail.trim(),
          notes: assignForm.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al asignar el turno"); return; }

      const patientVerb = data.created ? "creado" : "actualizado";
      toast.success(`Turno asignado a ${data.patient.name} (${patientVerb}). ${assignDialog.professional.name} — ${assignDialog.date} ${assignDialog.slot.time} hs.`);
      setAssignDialog((prev) => ({ ...prev, open: false }));
      handleSearch();
    } catch (err) {
      console.error("Error assigning:", err);
      toast.error("Error de conexión al asignar el turno");
    } finally {
      setAssigning(false);
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

      {/* === Split View de 3 columnas === */}
      <div className="grid lg:grid-cols-[260px_280px_1fr] gap-4">

        {/* ============================================== */}
        {/* COLUMNA 1: Buscador lateral + navegador semanas */}
        {/* ============================================== */}
        <Card className="border-teal-100 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <CardHeader className="pb-3 sticky top-0 bg-white z-10">
            <CardTitle className="text-base text-teal-900 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtros
            </CardTitle>
            {/* Navegador de semanas */}
            <div className="flex items-center gap-1 mt-2">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)} className="h-7 w-7 p-0 border-teal-200">
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-teal-600 hover:bg-teal-50 text-xs flex-1">
                {weekOffset === 0 ? "Esta semana" : `Semana ${weekOffset > 0 ? "+" : ""}${weekOffset}`}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)} className="h-7 w-7 p-0 border-teal-200">
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-[10px] text-teal-500 text-center mt-1">{weekLabel}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Profesión */}
            <div className="space-y-1">
              <Label className="text-xs text-teal-700 font-medium">Profesión</Label>
              <Select value={profession || "__all__"} onValueChange={(v) => setProfession(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs border-teal-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent><SelectItem value="__all__">Todas</SelectItem>{PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Especialidad */}
            <div className="space-y-1">
              <Label className="text-xs text-teal-700 font-medium">Especialidad</Label>
              <Select value={specialty || "__all__"} onValueChange={(v) => setSpecialty(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs border-teal-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent><SelectItem value="__all__">Todas</SelectItem>{SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Modalidad de atención */}
            <div className="space-y-1">
              <Label className="text-xs text-teal-700 font-medium">Modalidad de atención</Label>
              <Select value={modality || "__all__"} onValueChange={(v) => setModality(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs border-teal-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent><SelectItem value="__all__">Todas</SelectItem>{MODALITIES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Tipos de terapia */}
            <div className="space-y-1">
              <Label className="text-xs text-teal-700 font-medium">Tipos de terapia</Label>
              <div className="max-h-28 overflow-y-auto border border-teal-100 rounded-md p-1.5 bg-teal-50/30 space-y-0.5">
                {THERAPY_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                    <Checkbox checked={selectedTherapyTypes.includes(t)} onCheckedChange={() => toggleArrayItem(setSelectedTherapyTypes, t)} className="h-3 w-3" />
                    <span className="text-teal-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Población objetivo */}
            <div className="space-y-1">
              <Label className="text-xs text-teal-700 font-medium">Población objetivo</Label>
              <div className="border border-teal-100 rounded-md p-1.5 bg-teal-50/30 space-y-0.5">
                {TARGET_AUDIENCES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                    <Checkbox checked={selectedTargetAudience.includes(t)} onCheckedChange={() => toggleArrayItem(setSelectedTargetAudience, t)} className="h-3 w-3" />
                    <span className="text-teal-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Modalidad de terapia */}
            <div className="space-y-1">
              <Label className="text-xs text-teal-700 font-medium">Modalidad de terapia <span className="text-[10px] text-teal-400">(Individual, Vincular...)</span></Label>
              <div className="border border-teal-100 rounded-md p-1.5 bg-teal-50/30 space-y-0.5">
                {THERAPY_MODALITIES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                    <Checkbox checked={selectedTherapyModalities.includes(t)} onCheckedChange={() => toggleArrayItem(setSelectedTherapyModalities, t)} className="h-3 w-3" />
                    <span className="text-teal-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Botones */}
            <div className="space-y-2 pt-1">
              <Button onClick={handleSearch} disabled={searching} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs">
                {searching ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Buscando...</> : <><Search className="w-3 h-3 mr-1" /> Buscar</>}
              </Button>
              <Button onClick={handleClearFilters} variant="outline" size="sm" className="w-full h-7 text-xs border-teal-200 text-teal-600 hover:bg-teal-50">Limpiar</Button>
            </div>
          </CardContent>
        </Card>

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
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    activeProfessionalId === prof.id
                      ? "border-teal-500 bg-teal-50 shadow-sm ring-1 ring-teal-300"
                      : "border-teal-100 hover:border-teal-300 hover:bg-teal-50/50"
                  }`}
                >
                  <p className="text-sm font-medium text-teal-900 truncate">{prof.name}</p>
                  <p className="text-[10px] text-teal-500 truncate">{prof.specialty}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700 px-1.5 py-0">
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
              <CardHeader className="pb-2 sticky top-0 bg-white z-10">
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
              <CardContent className="pt-2">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-teal-100"><CardContent className="p-4 animate-pulse"><div className="h-4 bg-teal-100 rounded w-1/2 mb-2"></div><div className="h-8 bg-teal-100 rounded w-2/3"></div></CardContent></Card>
        ))}
      </div>
    );
  }
  const occupancyPercent = Math.round(metrics.occupancyRate * 100);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="border-teal-100"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-teal-600" /><p className="text-xs text-teal-500 font-medium">Ocupación</p></div><p className="text-2xl font-bold text-teal-900">{occupancyPercent}%</p><p className="text-xs text-teal-400 mt-0.5">{metrics.bookedSlotsThisWeek}/{metrics.totalSlotsThisWeek}</p></CardContent></Card>
      <Card className="border-teal-100"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Stethoscope className="w-4 h-4 text-emerald-600" /><p className="text-xs text-teal-500 font-medium">Profesionales</p></div><p className="text-2xl font-bold text-teal-900">{metrics.activeProfessionals}</p><p className="text-xs text-teal-400 mt-0.5">activos</p></CardContent></Card>
      <Card className="border-teal-100"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-amber-600" /><p className="text-xs text-teal-500 font-medium">Slots libres</p></div><p className="text-2xl font-bold text-teal-900">{metrics.freeSlotsThisWeek}</p><p className="text-xs text-teal-400 mt-0.5">esta semana</p></CardContent></Card>
      <Card className="border-teal-100"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-600" /><p className="text-xs text-teal-500 font-medium">Top especialidad</p></div>{metrics.topSpecialties.length > 0 ? <><p className="text-sm font-bold text-teal-900 truncate">{metrics.topSpecialties[0].specialty}</p><p className="text-xs text-teal-400 mt-0.5">{metrics.topSpecialties[0].count} turnos</p></> : <p className="text-sm text-teal-400">Sin datos</p>}</CardContent></Card>
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
  // === CORRECTIVO 1: Filas horarias FIJAS de 08:00 a 21:00 en bloques de 45 min ===
  // Antes las filas se generaban dinámicamente a partir de los slots del
  // profesional, lo que causaba desalineación. Ahora generamos una grilla
  // fija completa (08:00, 08:45, 09:30, ..., 20:15) y para cada celda
  // buscamos si hay un slot que coincida con esa hora Y ese día.
  const FIXED_TIME_SLOTS = useMemo(() => {
    const slots: string[] = [];
    let h = 8, m = 0; // empezar 08:00
    while (h < 21) { // hasta 21:00 (no inclusivo)
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      m += 45;
      if (m >= 60) { h += 1; m -= 60; }
    }
    return slots;
  }, []);

  // Verificar si el profesional tiene AL MENOS un slot en toda la semana
  // (para mostrar mensaje de "sin horarios" si no tiene nada)
  const hasAnySlot = useMemo(() => {
    let total = 0;
    for (const day of WEEK_DAYS) {
      const dayData = professional.weeklySlots[day.dayOfWeek];
      if (dayData) {
        total += dayData.availableSlots.length + dayData.bookedSlots.length;
      }
    }
    return total > 0;
  }, [professional]);

  if (!hasAnySlot) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
        <p className="text-teal-600 mt-2 text-sm">Este profesional no tiene horarios configurados para esta semana</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-[900px] border-collapse text-xs">
        {/* === CORRECTIVO 1: Encabezado fijo === */}
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="border border-teal-200 bg-teal-100 p-1.5 text-teal-800 font-semibold text-[10px] sticky left-0 z-20 min-w-[45px]">
              Hora
            </th>
            {WEEK_DAYS.map((day) => {
              const dayData = professional.weeklySlots[day.dayOfWeek];
              const dateStr = dayData?.date || "";
              const dayNum = dateStr ? format(parseISO(dateStr), "d", { locale: es }) : "";
              return (
                <th key={day.dayOfWeek} className="border border-teal-200 bg-teal-100 p-1.5 text-teal-800 font-semibold text-[10px] min-w-[120px] text-center">
                  {day.short} {dayNum}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* === CORRECTIVO 2: Iteración base sobre horarios FIJOS === */}
          {FIXED_TIME_SLOTS.map((time) => (
            <tr key={time} className="hover:bg-teal-50/30">
              {/* Columna Hora (fija a la izquierda) */}
              <td className="border border-teal-100 bg-slate-100 p-1 text-center text-[10px] text-slate-600 font-mono font-semibold sticky left-0 z-10">
                {time}
              </td>
              {/* === 7 celdas por fila (una por día) === */}
              {WEEK_DAYS.map((day) => {
                const dayData = professional.weeklySlots[day.dayOfWeek];

                // Si no hay datos para este día → celda vacía gris
                if (!dayData) {
                  return (
                    <td key={day.dayOfWeek} className="border border-teal-50 bg-slate-50/40 p-0.5">
                      <div className="w-full h-full min-h-[28px]"></div>
                    </td>
                  );
                }

                // === Intersección: buscar slot que coincida con time AND day ===
                const freeSlot = dayData.availableSlots.find((s) => s.time === time);
                const bookedSlot = dayData.bookedSlots.find((s) => s.time === time);
                const past = isSlotInPast(dayData.date, time);

                // === Celda LIBRE ===
                if (freeSlot) {
                  const colorClass = MODALITY_COLORS[freeSlot.modality] || MODALITY_COLORS.ambas;
                  const label = MODALITY_LABELS[freeSlot.modality] || freeSlot.modality;
                  return (
                    <td key={day.dayOfWeek} className="border border-teal-50 p-0.5">
                      <button
                        onClick={() => !past && onSlotClick(freeSlot, dayData.date)}
                        disabled={past}
                        className={`w-full h-full min-h-[28px] rounded border text-[10px] font-medium transition-colors flex items-center justify-center ${
                          past
                            ? "opacity-40 cursor-not-allowed pointer-events-none bg-slate-50 border-slate-200 text-slate-400"
                            : colorClass
                        }`}
                        title={past ? `Pasado — ${time} hs` : `${label} — ${time} a ${freeSlot.endTime} hs (click para asignar)`}
                      >
                        {label}
                      </button>
                    </td>
                  );
                }

                // === Celda OCUPADA ===
                if (bookedSlot) {
                  return (
                    <td key={day.dayOfWeek} className="border border-teal-50 p-0.5">
                      <button
                        onClick={() => onBookedSlotClick(bookedSlot)}
                        className={`w-full h-full min-h-[28px] rounded border border-slate-300 bg-slate-200 text-slate-800 text-[10px] font-semibold hover:bg-slate-300 transition-colors truncate px-1 ${
                          past ? "opacity-40" : ""
                        }`}
                        title={`${bookedSlot.patientName} — ${bookedSlot.status} (click para ver ficha)`}
                      >
                        {bookedSlot.patientName.split(" ").slice(0, 2).join(" ")}
                      </button>
                    </td>
                  );
                }

                // === Celda VACÍA — el profesional no atiende ese día/hora ===
                return (
                  <td key={day.dayOfWeek} className="border border-teal-50 bg-slate-50/40 p-0.5">
                    <div className="w-full h-full min-h-[28px]"></div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px] text-teal-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>Presencial</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>Online</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></span>Híbrido</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>Ambas</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 border border-slate-300"></span>Ocupado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-50 border border-slate-200 opacity-40"></span>Pasado</span>
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
  if (!professional || !slot) return null;
  const modalityLabel = MODALITY_LABELS[slot.modality] || slot.modality;
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
          <p className="text-xs text-teal-600">Modalidad: {modalityLabel}</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs text-teal-700 font-medium">Nombre del paciente <span className="text-red-500">*</span></Label><Input value={form.patientName} onChange={(e) => onFormChange({ ...form, patientName: e.target.value })} placeholder="Nombre y apellido" className="h-8 text-sm border-teal-200" /></div>
          <div className="space-y-1"><Label className="text-xs text-teal-700 font-medium">Teléfono <span className="text-red-500">*</span></Label><Input value={form.patientPhone} onChange={(e) => onFormChange({ ...form, patientPhone: e.target.value })} placeholder="+54 11 xxxx-xxxx" className="h-8 text-sm border-teal-200" /></div>
          <div className="space-y-1"><Label className="text-xs text-teal-700 font-medium">Email <span className="text-red-500">*</span></Label><Input type="email" value={form.patientEmail} onChange={(e) => onFormChange({ ...form, patientEmail: e.target.value })} placeholder="paciente@email.com" className="h-8 text-sm border-teal-200" /><p className="text-[10px] text-teal-500">Si el email ya existe, se reutiliza el paciente (no se duplica)</p></div>
          <div className="space-y-1"><Label className="text-xs text-teal-700 font-medium">Notas (opcional)</Label><Textarea value={form.notes} onChange={(e) => onFormChange({ ...form, notes: e.target.value })} placeholder="Motivo de consulta, observaciones..." className="text-sm border-teal-200 min-h-[60px]" rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cancelar</Button>
          <Button onClick={onConfirm} disabled={assigning} className="bg-teal-600 hover:bg-teal-700 text-white">{assigning ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Asignando...</> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar</>}</Button>
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
}

function FichaDialog({ open, onOpenChange, professional, slot }: FichaDialogProps) {
  if (!professional || !slot) return null;
  const modalityLabel = slot.modality ? MODALITY_LABELS[slot.modality] || slot.modality : "—";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-900 flex items-center gap-2"><Users className="w-5 h-5 text-teal-600" /> Ficha del turno</DialogTitle>
          <DialogDescription className="text-teal-600">{professional.name} — {professional.specialty}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm text-teal-900"><Clock className="w-4 h-4 text-teal-600" /><span>{slot.time} hs</span><Badge variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-700">{modalityLabel}</Badge></div>
            <div className="flex items-center gap-2 text-xs"><span className="text-teal-500">Estado:</span><Badge variant={slot.status === "confirmed" ? "default" : "outline"} className="text-xs">{slot.status === "confirmed" ? "Confirmado" : slot.status === "pending" ? "Pendiente" : slot.status}</Badge></div>
          </div>
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
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
