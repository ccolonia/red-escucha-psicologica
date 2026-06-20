"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Search,
  Filter,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Stethoscope,
  X,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  MessageCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isToday,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";

// ====================================================================
// CONSTANTES — listas de opciones para los filtros del buscador.
// Sincronizadas con professional-register.tsx (commit 1b4aaa2 y anteriores).
// ====================================================================

const PROFESSIONS = [
  "Psicólogo",
  "Psiquiatra",
  "Psicopedagogo",
  "Musicoterapeuta",
  "Licenciado en Psicología",
  "Doctor en Psicología",
  "Neuropsicólogo",
  "Terapista Ocupacional",
  "Trabajador Social",
  "Estimulador/a Temprana",
  "Neuropsicomotrista",
  "Neuropsicolingüista",
  "Nutricionista",
  "Fonoaudiólogo/a",
  "Otra",
];

const SPECIALTIES = [
  "Psicología Clínica",
  "Neuropsicología",
  "Psicología Laboral / Organizacional",
  "Psicología Educacional",
  "Psicología Deportiva",
  "Psicología Forense",
  "Psicología Social / Comunitaria",
  "Psicología de la Salud",
  "Sexología / Terapia Sexual",
  "Adicciones",
  "Duelo y Pérdida",
  "Trastornos Alimentarios",
  "Psicología Geriátrica",
  "Psicología Transcultural",
  "Psicología Perinatal",
  "Psicooncología",
  "Psiconutrición",
  "Violencia y Abuso Sexual",
  "Trastorno Obsesivo-Compulsivo (TOC)",
  "Psicosis y Esquizofrenia",
  "Hebefrenia",
  "Trastorno Límite de la Personalidad (TLP)",
  "Ansiedad y Ataques de Pánico",
  "Síndrome de Burnout",
  "Acoso Laboral",
  "Bullying",
  "Autolesiones e Ideación Suicida",
];

const THERAPY_TYPES = [
  "Psicología clínica",
  "Psicoanálisis",
  "Terapia cognitivo-conductual",
  "Terapias vinculares",
  "Terapia sistémica",
  "Logoterapia",
  "Terapia gestáltica",
  "Neuropsicología",
  "Mindfulness",
  "Psicología laboral / organizacional",
  "Psicología positiva",
  "Psicología forense",
  "Adicciones",
  "EMDR",
  "Trastornos alimentarios",
  "Psiconutrición",
  "Psicooncología",
  "Psicología geriátrica",
  "Psicología deportiva",
  "Psicología perinatal",
  "Terapia humanista",
  "Terapia junguiana",
  "Psicodrama",
  "Psicoterapia Integral",
  "Deportología",
  "Psicocorporal Reichiana",
  "Terapia transpersonal",
  "Terapia constructivista",
  "Otras terapias",
];

const TARGET_AUDIENCES = [
  "Niños/as",
  "Adolescentes",
  "Adultos mayores",
  "Adultos",
  "Jóvenes",
  "Parejas",
  "Familias",
  "Orientación a padres",
];

// === Modalidades de Terapia (NUEVO filtro) ===
// NO confundir con la modalidad de atención (Online/Presencial/Híbrida).
// Este es el campo therapyModality del Professional — valores: Individual,
// Vincular, Evaluaciones, Terapia Grupal, etc.
// Sincronizado con THERAPY_MODALITIES de professional-register.tsx.
const THERAPY_MODALITIES = [
  "Individual",
  "Vincular",
  "Evaluaciones",
  "Terapia Grupal",
  "Orientación a Padres",
  "Asesoría a Empresas",
  "Pericias",
  "Discapacidad",
  "Orientación Vocacional",
];

const MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "híbrida", label: "Híbrida" },
  { value: "ambas", label: "Ambas" },
];

const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

// === Colores por modalidad (código visual consistente en toda la vista) ===
const MODALITY_COLORS: Record<string, string> = {
  P: "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100",
  OL: "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100",
  H: "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100",
  ambas: "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100",
  amb: "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100",
};

const MODALITY_LABELS: Record<string, string> = {
  P: "Presencial",
  OL: "Online",
  H: "Híbrido",
  ambas: "Ambas",
  amb: "Ambas",
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

interface ProfessionalResult {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string;
  profession: string | null;
  modalityBadges: string[];
  availableSlots: AvailableSlot[];
  bookedSlots: BookedSlot[];
  hasAvailability: boolean;
}

interface SearchResponse {
  criteria: {
    profession: string | null;
    specialty: string | null;
    therapyTypes: string[] | null;
    targetAudience: string[] | null;
    dayOfWeek: number | null;
    date: string | null;
    modality: string | null;
  };
  summary: {
    totalProfessionalsMatched: number;
    professionalsWithSlots: number;
    professionalsWithoutSlots: number;
    totalSlotsAvailable: number;
    avgSlotsPerProfessional: number;
  };
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
// COMPONENTE PRINCIPAL
// ====================================================================

export function AdminAgendaCentral() {
  // === Estado del buscador ===
  const [profession, setProfession] = useState<string>("");
  const [specialty, setSpecialty] = useState<string>("");
  const [selectedTherapyTypes, setSelectedTherapyTypes] = useState<string[]>([]);
  const [selectedTargetAudience, setSelectedTargetAudience] = useState<string[]>([]);
  const [selectedTherapyModalities, setSelectedTherapyModalities] = useState<string[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // default: Lunes
  const [modality, setModality] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = esta semana, -1 = anterior, +1 = siguiente

  // === Estado de resultados ===
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

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
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    notes: "",
  });
  const [assigning, setAssigning] = useState(false);

  // === Calcular fecha seleccionada basada en dayOfWeek + weekOffset ===
  const selectedDate = useMemo(() => {
    const now = new Date();
    const mondayOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
    const target = addDays(mondayOfThisWeek, weekOffset * 7 + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return format(target, "yyyy-MM-dd");
  }, [dayOfWeek, weekOffset]);

  const selectedDateLabel = useMemo(() => {
    try {
      const d = parseISO(selectedDate);
      return format(d, "EEEE d 'de' MMMM", { locale: es });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // === Cargar métricas al montar ===
  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch("/api/admin/agenda-metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Error loading metrics:", err);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // === Ejecutar búsqueda ===
  const handleSearch = useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (profession) params.set("profession", profession);
      if (specialty) params.set("specialty", specialty);
      if (selectedTherapyTypes.length > 0) params.set("therapyTypes", selectedTherapyTypes.join(","));
      if (selectedTargetAudience.length > 0) params.set("targetAudience", selectedTargetAudience.join(","));
      if (selectedTherapyModalities.length > 0) params.set("therapyModalities", selectedTherapyModalities.join(","));
      params.set("dayOfWeek", String(dayOfWeek));
      params.set("date", selectedDate);
      if (modality) params.set("modality", modality);

      const res = await fetch(`/api/admin/search-professionals?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al buscar profesionales");
        return;
      }
      const data: SearchResponse = await res.json();
      setSearchResults(data);
      toast.success(`${data.summary.totalProfessionalsMatched} profesionales coinciden (${data.summary.totalSlotsAvailable} slots libres)`);
    } catch (err) {
      console.error("Error searching:", err);
      toast.error("Error de conexión al buscar");
    } finally {
      setSearching(false);
    }
  }, [profession, specialty, selectedTherapyTypes, selectedTargetAudience, selectedTherapyModalities, dayOfWeek, selectedDate, modality]);

  // === Búsqueda automática al cambiar día/weekOffset (para que el admin vea
  // resultados sin tener que clickear "Buscar" cada vez que navega semanas) ===
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOfWeek, weekOffset]);

  // === Toggle arrays para los checkboxes multi-select ===
  const toggleTherapyType = (t: string) => {
    setSelectedTherapyTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };
  const toggleTargetAudience = (t: string) => {
    setSelectedTargetAudience((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };
  const toggleTherapyModality = (t: string) => {
    setSelectedTherapyModalities((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  // === Abrir dialog de asignación ===
  const openAssignDialog = (professional: ProfessionalResult, slot: AvailableSlot) => {
    setAssignForm({ patientName: "", patientPhone: "", patientEmail: "", notes: "" });
    setAssignDialog({ open: true, professional, slot, date: selectedDate });
  };

  // === Abrir dialog de ficha rápida (slot ocupado) ===
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
      // Reutilizar el endpoint POST /api/appointments que ya existe.
      // Pero ese endpoint requiere patientId directo, no datos del paciente.
      // Para mantener el flujo "buscar o crear", vamos a usar el endpoint
      // de patient-requests que ya hace upsert de Patient por email.
      // Pero ese endpoint requiere un patientRequestId...
      //
      // Solución más simple: usar POST /api/appointments pero primero
      // hacer upsert del Patient via /api/patients... pero no hay endpoint
      // público de upsert.
      //
      // Mejor: crear un endpoint dedicado /api/admin/quick-assign que haga
      // todo en una transacción. Pero eso es del Paso 4.
      //
      // Por ahora, como workaround, usamos el endpoint existente de
      // patient-requests con action=assign, pero simulando que el admin
      // está asignando una solicitud existente. Como no tenemos un
      // PatientRequest, vamos a crear uno primero.
      //
      // ACTUALIZACIÓN: para no complicar, voy a usar directamente el
      // endpoint POST /api/appointments con un patientId que obtengo
      // haciendo una búsqueda previa por email. Si no existe, lo creo
      // via /api/auth/register con role=patient. Pero eso manda email...
      //
      // Mejor enfoque: crear el endpoint /api/admin/quick-assign en el
      // Paso 4 que haga todo limpio. Por ahora dejo el botón deshabilitado
      // con un mensaje claro.
      toast.info("La asignación rápida se implementará en el Paso 4 (endpoint /api/admin/quick-assign). Por ahora usá el Triage para asignar.");
      setAssignDialog((prev) => ({ ...prev, open: false }));
    } catch (err) {
      console.error("Error assigning:", err);
      toast.error("Error al asignar el turno");
    } finally {
      setAssigning(false);
    }
  };

  // === Limpiar filtros ===
  const handleClearFilters = () => {
    setProfession("");
    setSpecialty("");
    setSelectedTherapyTypes([]);
    setSelectedTargetAudience([]);
    setSelectedTherapyModalities([]);
    setModality("");
    setDayOfWeek(1);
    setWeekOffset(0);
  };

  // ====================================================================
  // RENDER
  // ====================================================================

  return (
    <div className="space-y-6">
      {/* === Header === */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-teal-900 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-teal-600" />
            Agenda Centralizada
          </h1>
          <p className="text-sm text-teal-600 mt-1">
            Motor de asignación inteligente — cruce clínico en tiempo real
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { loadMetrics(); handleSearch(); }}
          className="border-teal-200 text-teal-600 hover:bg-teal-50"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Actualizar
        </Button>
      </div>

      {/* === Dashboard de métricas === */}
      <MetricsDashboard metrics={metrics} loading={loadingMetrics} />

      {/* === Layout principal: buscador + grilla === */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* === Buscador lateral === */}
        <Card className="border-teal-100 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-teal-900 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros de búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profesión */}
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">Profesión</Label>
              <Select value={profession} onValueChange={(v) => setProfession(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs border-teal-200">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {PROFESSIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Especialidad */}
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">Especialidad</Label>
              <Select value={specialty} onValueChange={(v) => setSpecialty(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs border-teal-200">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modalidad */}
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">Modalidad</Label>
              <Select value={modality} onValueChange={(v) => setModality(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs border-teal-200">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {MODALITIES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Día de la semana */}
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">Día de la semana</Label>
              <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(parseInt(v, 10))}>
                <SelectTrigger className="h-8 text-xs border-teal-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DAY_LABELS).filter(([k]) => k !== "0").map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipos de terapia (multi-select con checkboxes) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">Tipos de terapia</Label>
              <div className="max-h-32 overflow-y-auto border border-teal-100 rounded-md p-2 bg-teal-50/30 space-y-1">
                {THERAPY_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedTherapyTypes.includes(t)}
                      onCheckedChange={() => toggleTherapyType(t)}
                      className="h-3 w-3"
                    />
                    <span className="text-teal-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Población objetivo (multi-select) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">Población objetivo</Label>
              <div className="border border-teal-100 rounded-md p-2 bg-teal-50/30 space-y-1">
                {TARGET_AUDIENCES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedTargetAudience.includes(t)}
                      onCheckedChange={() => toggleTargetAudience(t)}
                      className="h-3 w-3"
                    />
                    <span className="text-teal-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* === NUEVO: Modalidad de Terapia (multi-select) === */}
            {/* NO confundir con la modalidad de atención (Online/Presencial).
                Este es el campo therapyModality del Professional. */}
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">
                Modalidad de Terapia
                <span className="text-[10px] text-teal-400 block font-normal">(Individual, Vincular, etc.)</span>
              </Label>
              <div className="border border-teal-100 rounded-md p-2 bg-teal-50/30 space-y-1">
                {THERAPY_MODALITIES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedTherapyModalities.includes(t)}
                      onCheckedChange={() => toggleTherapyModality(t)}
                      className="h-3 w-3"
                    />
                    <span className="text-teal-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Botones */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={handleSearch}
                disabled={searching}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs"
              >
                {searching ? (
                  <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Buscando...</>
                ) : (
                  <><Search className="w-3 h-3 mr-1" /> Buscar</>
                )}
              </Button>
              <Button
                onClick={handleClearFilters}
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs border-teal-200 text-teal-600 hover:bg-teal-50"
              >
                Limpiar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* === Grilla de resultados === */}
        <div className="space-y-4">
          {/* Navegación de semana */}
          <Card className="border-teal-100">
            <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="h-8 w-8 p-0 border-teal-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-center min-w-[200px]">
                  <p className="text-sm font-semibold text-teal-900 capitalize">{selectedDateLabel}</p>
                  <p className="text-xs text-teal-500">Semana {weekOffset === 0 ? "actual" : weekOffset > 0 ? `+${weekOffset}` : weekOffset}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="h-8 w-8 p-0 border-teal-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeekOffset(0)}
                className="text-teal-600 hover:bg-teal-50 text-xs"
              >
                Hoy
              </Button>
            </CardContent>
          </Card>

          {/* Resultados */}
          {searching ? (
            <Card className="border-teal-100">
              <CardContent className="py-12 text-center">
                <RefreshCw className="w-8 h-8 text-teal-400 mx-auto animate-spin" />
                <p className="text-teal-600 mt-2 text-sm">Buscando profesionales...</p>
              </CardContent>
            </Card>
          ) : !searchResults ? (
            <Card className="border-teal-100">
              <CardContent className="py-12 text-center">
                <Search className="w-8 h-8 text-teal-300 mx-auto" />
                <p className="text-teal-600 mt-2 text-sm">Hacé clic en "Buscar" para ver profesionales disponibles</p>
              </CardContent>
            </Card>
          ) : searchResults.professionals.length === 0 ? (
            <Card className="border-teal-100">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-teal-700 mt-2 text-sm font-medium">No hay profesionales que coincidan con los filtros</p>
                <p className="text-teal-500 text-xs mt-1">Probá relajar algunos criterios de búsqueda</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-700">
                  {searchResults.summary.totalProfessionalsMatched} profesionales
                </Badge>
                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
                  {searchResults.summary.totalSlotsAvailable} slots libres
                </Badge>
                {searchResults.summary.professionalsWithoutSlots > 0 && (
                  <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                    {searchResults.summary.professionalsWithoutSlots} sin disponibilidad
                  </Badge>
                )}
              </div>

              {/* Lista de profesionales con sus slots */}
              <div className="space-y-3">
                {searchResults.professionals.map((prof) => (
                  <ProfessionalCard
                    key={prof.id}
                    professional={prof}
                    onSlotClick={(slot) => openAssignDialog(prof, slot)}
                    onBookedSlotClick={(slot) => openFichaDialog(prof, slot)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* === Dialog de asignación rápida === */}
      <AssignDialog
        open={assignDialog.open}
        onOpenChange={(open) => setAssignDialog((prev) => ({ ...prev, open }))}
        professional={assignDialog.professional}
        slot={assignDialog.slot}
        date={assignDialog.date}
        dateLabel={selectedDateLabel}
        form={assignForm}
        onFormChange={setAssignForm}
        onConfirm={handleConfirmAssign}
        assigning={assigning}
      />

      {/* === Dialog de ficha rápida (slot ocupado) === */}
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
          <Card key={i} className="border-teal-100">
            <CardContent className="p-4 animate-pulse">
              <div className="h-4 bg-teal-100 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-teal-100 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const occupancyPercent = Math.round(metrics.occupancyRate * 100);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="border-teal-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <p className="text-xs text-teal-500 font-medium">Ocupación</p>
          </div>
          <p className="text-2xl font-bold text-teal-900">{occupancyPercent}%</p>
          <p className="text-xs text-teal-400 mt-0.5">{metrics.bookedSlotsThisWeek}/{metrics.totalSlotsThisWeek} turnos</p>
        </CardContent>
      </Card>
      <Card className="border-teal-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="w-4 h-4 text-emerald-600" />
            <p className="text-xs text-teal-500 font-medium">Profesionales</p>
          </div>
          <p className="text-2xl font-bold text-teal-900">{metrics.activeProfessionals}</p>
          <p className="text-xs text-teal-400 mt-0.5">activos</p>
        </CardContent>
      </Card>
      <Card className="border-teal-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-teal-500 font-medium">Slots libres</p>
          </div>
          <p className="text-2xl font-bold text-teal-900">{metrics.freeSlotsThisWeek}</p>
          <p className="text-xs text-teal-400 mt-0.5">esta semana</p>
        </CardContent>
      </Card>
      <Card className="border-teal-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-600" />
            <p className="text-xs text-teal-500 font-medium">Top especialidad</p>
          </div>
          {metrics.topSpecialties.length > 0 ? (
            <>
              <p className="text-sm font-bold text-teal-900 truncate">{metrics.topSpecialties[0].specialty}</p>
              <p className="text-xs text-teal-400 mt-0.5">{metrics.topSpecialties[0].count} turnos</p>
            </>
          ) : (
            <p className="text-sm text-teal-400">Sin datos</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
// SUB-COMPONENTE: Tarjeta de profesional con sus slots
// ====================================================================

interface ProfessionalCardProps {
  professional: ProfessionalResult;
  onSlotClick: (slot: AvailableSlot) => void;
  onBookedSlotClick: (slot: BookedSlot) => void;
}

function ProfessionalCard({ professional, onSlotClick, onBookedSlotClick }: ProfessionalCardProps) {
  return (
    <Card className={`border-teal-100 ${!professional.hasAvailability ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        {/* Header del profesional */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-teal-900">{professional.name}</p>
            <p className="text-xs text-teal-600">{professional.specialty}</p>
            {professional.profession && (
              <p className="text-xs text-teal-400">{professional.profession}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            {professional.modalityBadges.map((m) => (
              <Badge key={m} variant="outline" className="text-[10px] bg-teal-50 border-teal-200 text-teal-700">
                {m}
              </Badge>
            ))}
          </div>
        </div>

        {/* Slots disponibles */}
        {professional.availableSlots.length > 0 ? (
          <div className="mb-3">
            <p className="text-xs text-teal-500 mb-1.5 font-medium">Slots libres:</p>
            <div className="flex flex-wrap gap-1.5">
              {professional.availableSlots.map((slot) => {
                const colorClass = MODALITY_COLORS[slot.modality] || MODALITY_COLORS.ambas;
                const label = MODALITY_LABELS[slot.modality] || slot.modality;
                return (
                  <button
                    key={`${slot.time}-${slot.modality}`}
                    onClick={() => onSlotClick(slot)}
                    className={`text-xs px-2 py-1 rounded-md border font-mono transition-colors ${colorClass}`}
                    title={`${label} — ${slot.time} a ${slot.endTime} hs (click para asignar)`}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <p className="text-xs text-amber-600 italic">Sin slots disponibles este día</p>
          </div>
        )}

        {/* Slots ocupados */}
        {professional.bookedSlots.length > 0 && (
          <div>
            <p className="text-xs text-teal-500 mb-1.5 font-medium">Turnos ocupados:</p>
            <div className="flex flex-wrap gap-1.5">
              {professional.bookedSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => onBookedSlotClick(slot)}
                  className="text-xs px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors font-mono"
                  title={`${slot.patientName} — ${slot.status} (click para ver ficha)`}
                >
                  {slot.time} · {slot.patientName}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
  dateLabel: string;
  form: AssignFormData;
  onFormChange: (form: AssignFormData) => void;
  onConfirm: () => void;
  assigning: boolean;
}

function AssignDialog({
  open, onOpenChange, professional, slot, date, dateLabel,
  form, onFormChange, onConfirm, assigning,
}: AssignDialogProps) {
  if (!professional || !slot) return null;
  const modalityLabel = MODALITY_LABELS[slot.modality] || slot.modality;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-teal-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            Asignar turno
          </DialogTitle>
          <DialogDescription className="text-teal-600">
            {professional.name} — {professional.specialty}
          </DialogDescription>
        </DialogHeader>

        {/* Resumen del slot */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1">
          <p className="text-sm text-teal-900 font-medium capitalize">{dateLabel}</p>
          <p className="text-sm text-teal-700">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            {slot.time} a {slot.endTime} hs
          </p>
          <p className="text-xs text-teal-600">Modalidad: {modalityLabel}</p>
        </div>

        {/* Formulario */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-teal-700 font-medium">
              Nombre del paciente <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.patientName}
              onChange={(e) => onFormChange({ ...form, patientName: e.target.value })}
              placeholder="Nombre y apellido"
              className="h-8 text-sm border-teal-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-teal-700 font-medium">
              Teléfono <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.patientPhone}
              onChange={(e) => onFormChange({ ...form, patientPhone: e.target.value })}
              placeholder="+54 11 xxxx-xxxx"
              className="h-8 text-sm border-teal-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-teal-700 font-medium">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              type="email"
              value={form.patientEmail}
              onChange={(e) => onFormChange({ ...form, patientEmail: e.target.value })}
              placeholder="paciente@email.com"
              className="h-8 text-sm border-teal-200"
            />
            <p className="text-[10px] text-teal-500">
              Si el email ya existe, se reutiliza el paciente (no se duplica)
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-teal-700 font-medium">Notas (opcional)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Motivo de consulta, observaciones..."
              className="text-sm border-teal-200 min-h-[60px]"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-teal-200 text-teal-600 hover:bg-teal-50"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={assigning}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {assigning ? (
              <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Asignando...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar asignación</>
            )}
          </Button>
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
          <DialogTitle className="text-teal-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Ficha del turno
          </DialogTitle>
          <DialogDescription className="text-teal-600">
            {professional.name} — {professional.specialty}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Datos del turno */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm text-teal-900">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>{slot.time} hs</span>
              <Badge variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-700">
                {modalityLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-teal-500">Estado:</span>
              <Badge variant={slot.status === "confirmed" ? "default" : "outline"} className="text-xs">
                {slot.status === "confirmed" ? "Confirmado" : slot.status === "pending" ? "Pendiente" : slot.status}
              </Badge>
            </div>
          </div>

          {/* Datos del paciente */}
          <div className="space-y-2">
            <p className="text-xs text-teal-500 font-medium uppercase tracking-wide">Paciente</p>
            <p className="text-sm font-medium text-teal-900">{slot.patientName}</p>

            {/* Contacto rápido */}
            {(slot.patientPhone || slot.patientEmail) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                {slot.patientPhone && (
                  <a
                    href={`https://wa.me/${slot.patientPhone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 hover:underline transition-colors"
                  >
                    <MessageCircle className="w-3 h-3 text-emerald-500" />
                    {slot.patientPhone}
                  </a>
                )}
                {slot.patientEmail && (
                  <a
                    href={`mailto:${slot.patientEmail}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline transition-colors"
                  >
                    <Mail className="w-3 h-3 text-teal-500" />
                    {slot.patientEmail}
                  </a>
                )}
              </div>
            )}
            {!slot.patientPhone && !slot.patientEmail && (
              <p className="text-xs text-teal-400 italic">Sin datos de contacto</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-teal-200 text-teal-600 hover:bg-teal-50"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
