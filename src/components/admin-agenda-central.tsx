"use client";

// Trigger redeploy 17/07/2026 - b081129 fix Maria Monge agenda alignment was not picked up by Vercel webhook
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
import { ProfessionalScheduleConfig } from "@/components/professional-schedule-config";
import { ProfessionalWeeklyAgenda } from "@/components/professional-weekly-agenda";
import { ProfessionalProfile } from "@/components/professional-dashboard";
import { Settings2, X, Eye, Wrench, FileText, BadgeCheck, ShieldCheck, Download, CalendarPlus, UserX } from "lucide-react";

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

// === Listas centralizadas en @/lib/professional-categories ===
import { SPECIALTIES, THERAPY_TYPES, TARGET_AUDIENCES, THERAPY_MODALITIES } from "@/lib/professional-categories";

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
  P: "P", OL: "OL", H: "H", ambas: "P|OL", amb: "P|OL",
};

// === Emoji + fullLabel por modalidad para slots disponibles ===
const MODALITY_EMOJI: Record<string, { emoji: string; fullLabel: string }> = {
  OL: { emoji: "💻", fullLabel: "Online" },
  P: { emoji: "📍", fullLabel: "Presencial" },
  H: { emoji: "🔄", fullLabel: "Híbrida" },
  ambas: { emoji: "🔄", fullLabel: "Híbrida" },
  amb: { emoji: "🔄", fullLabel: "Híbrida" },
};

// ====================================================================
// TYPES
// ====================================================================

interface AvailableSlot {
  time: string;
  endTime: string;
  modality: string;
  duration: number;
  // direccionId: enlace a ProfessionalAddress (modelo nuevo) para resolver
  // la dirección del consultorio cuando el slot es presencial.
  // Opcional porque no todos los slots tienen dirección específica asociada.
  direccionId?: string | null;
}

interface BookedSlot {
  id: string;
  time: string;
  endTime?: string | null;
  date?: string;
  modality: string | null;
  status: string;
  notes: string | null;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string | null;
  patientEmailStatus?: string | null;
  patientEmailSentAt?: string | null;
  professionalEmailStatus?: string | null;
  professionalEmailSentAt?: string | null;
  // === Recurrencia (tarea 2026-08-21) ===
  seriesId?: string | null;
  isOverride?: boolean;
  originalDate?: string | null;
}

// === Status labels para mostrar en el card del BookedSlot ===
// (mismas etiquetas que la agenda del profesional)
const STATUS_LABELS_ADMIN: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  rescheduled: "Reprogramado",
  cancelled: "Cancelado",
  // === Etiquetas distintivas por origen (tarea 2026-07-23) ===
  // Antes ambos decían "Cancelado" genérico. Ahora distinguimos:
  // - cancelled_by_patient → "Cancelado por Paciente" (ámbar/marrón)
  // - cancelled_by_professional → "Cancelado por Profesional" (rojo)
  cancelled_by_patient: "Cancelado por Paciente",
  cancelled_by_professional: "Cancelado por Profesional",
  completed: "Atendido",
  absent: "Ausente",
  blocked: "Bloqueado",
};

// === Status colors para el card (mismo estilo que el profesional) ===
const STATUS_COLORS_ADMIN: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", badge: "bg-teal-100 text-teal-700 border-teal-200" },
  rescheduled: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  // === Colores distintivos por origen de cancelación ===
  // - cancelled (legacy): rojo suave (mantiene compatibilidad con turnos viejos)
  // - cancelled_by_patient: ámbar/marrón sutil (el paciente es quien decide)
  // - cancelled_by_professional: rojo (más grave porque implica reprogramación)
  cancelled: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", badge: "bg-red-100 text-red-700 border-red-200" },
  cancelled_by_patient: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300", badge: "bg-amber-100 text-amber-800 border-amber-300" },
  cancelled_by_professional: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", badge: "bg-red-100 text-red-700 border-red-200" },
  completed: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", badge: "bg-gray-100 text-gray-600 border-gray-200" },
  absent: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  blocked: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", badge: "bg-slate-200 text-slate-700 border-slate-300" },
};

// === Modality badge colors (versión compacta para el card) ===
const MODALITY_BADGE_ADMIN: Record<string, { label: string; color: string }> = {
  P: { label: "P", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  OL: { label: "OL", color: "bg-blue-50 text-blue-700 border-blue-200" },
  H: { label: "H", color: "bg-purple-50 text-purple-700 border-purple-200" },
  ambas: { label: "P|OL", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

interface DaySlots {
  date: string;
  availableSlots: AvailableSlot[];
  bookedSlots: BookedSlot[];
}

interface ProfessionalAddress {
  id: string;
  label: string;
  address: string;
  isActive: boolean;
}

interface ProfessionalResult {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string;
  profession: string | null;
  modalityBadges: string[];
  // === Dirección del consultorio (tarea 2026-07-25) ===
  officeAddress: string | null;          // legacy
  addresses: ProfessionalAddress[];      // modelo nuevo
  weeklySlots: Record<number, DaySlots>;
  totalFreeSlots: number;
  totalBookedSlots: number;
  hasAvailability: boolean;
  // === Campos de perfil profesional (tarea 2026-08-18: Ver Perfil) ===
  // La API de /api/admin/search-professionals ya devuelve estos campos,
  // pero el frontend no los declaraba. Los agregamos para mostrar la ficha
  // completa del profesional en el tab "Perfil" del modal de Agenda Central.
  license?: string | null;
  licenseVerified?: boolean;
  title?: string | null;
  bio?: string | null;
  cuil?: string | null;
  gender?: string | null;
  commissionRate?: number | null;
  therapyTypes?: string | null;       // JSON-string array
  targetAudience?: string | null;     // JSON-string array
  therapyModality?: string | null;    // JSON-string array
  otherTherapyDetails?: string | null;
  onlineAttention?: boolean;
  presentialAttention?: boolean;
  homeAttention?: boolean;
  zones?: string | null;              // JSON-string array
  cvFileName?: string | null;
  internalNotes?: string | null;
  evaluationStatus?: string | null;
  createdAt?: string;
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
  leadSource?: string | null; // "patient_request" | "contact_request"
}

// ====================================================================
// HELPERS
// ====================================================================

const ARG_TZ = "America/Argentina/Buenos_Aires";

function isSlotInPast(date: string, time: string): boolean {
  // === Comparación usando strings formateados en timezone Argentina ===
  // PROBLEMA anterior: usar new Date() con toLocaleString causaba bugs de
  // timezone porque el servidor Vercel está en UTC. Si en Argentina son las
  // 01:02 AM del Jueves 25, el servidor UTC marca 04:02 AM → todos los slots
  // de 04:00 para abajo aparecían como "pasados" cuando eran FUTUROS en
  // hora Argentina.
  //
  // SOLUCIÓN: formatear fecha y hora actual en timezone Argentina usando
  // toLocaleDateString (igual que hace el backend) y comparar strings.
  // Esto es 100% consistente con el backend que usa ARG_TZ.
  try {
    // Fecha actual en Argentina (formato YYYY-MM-DD)
    const todayArg = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
    // Hora actual en Argentina (formato HH:MM)
    const nowTimeArg = new Date().toLocaleTimeString("en-GB", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit" });

    // Comparar fechas primero
    if (date < todayArg) return true;  // fecha anterior a hoy → pasado
    if (date > todayArg) return false; // fecha posterior a hoy → futuro

    // Misma fecha: comparar horas
    return time <= nowTimeArg;
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

  // === Profesionales colapsable (igual que Filtros) ===
  // Permite ocultar la lista de profesionales para ganar espacio en pantalla
  // y volver a expandir (estado inicial = expandido).
  const [professionalsOpen, setProfessionalsOpen] = useState(true);
  // === Buscador en tiempo real de profesionales (tarea 2026-07-25) ===
  const [professionalSearchTerm, setProfessionalSearchTerm] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // === Estado de resultados ===
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // === Profesional activo (seleccionado en la columna 2) ===
  const [activeProfessionalId, setActiveProfessionalId] = useState<string | null>(null);

  // === Ref para leer activeProfessionalId dentro de handleSearch sin meterlo
  // en las deps del useCallback. Esto evita que handleSearch se recree cada
  // vez que el admin cambia de profesional, lo cual dispararía un loop infinito
  // con el useEffect que llama a handleSearch.
  const activeProfessionalIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeProfessionalIdRef.current = activeProfessionalId;
  }, [activeProfessionalId]);

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
  // === Modal de Cancelación con Selector de Origen (tarea 2026-07-23) ===
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    slot: BookedSlot | null;
    source: "patient" | "professional" | "";
    reason: string;
  }>({ open: false, slot: null, source: "", reason: "" });

  // === Modal de Config. Agenda (modo admin) ===
  const [scheduleConfigDialog, setScheduleConfigDialog] = useState<{
    open: boolean;
    professionalId: string | null;
    professionalName: string;
    tab: "config" | "agenda" | "profile";
  }>({ open: false, professionalId: null, professionalName: "", tab: "config" });

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

      // === Preservar selección del profesional al cambiar de semana ===
      // ANTES (bug): siempre se pisaba activeProfessionalId con el primer
      // profesional de la nueva búsqueda. Eso causaba que al navegar entre
      // semanas (ej: semana 3 → semana 4) se perdiera la selección del
      // profesional activo y el admin tuviera que hacer click de nuevo.
      //
      // AHORA:
      // - Si hay un profesional activo Y sigue en los resultados → mantenerlo
      // - Si no, auto-seleccionar el primer profesional con slots
      // - Si no hay ningún profesional → null
      //
      // Usamos activeProfessionalIdRef.current para leer el valor actual SIN
      // meter activeProfessionalId en las deps del useCallback (lo cual
      // causaría un loop infinito con el useEffect que llama a handleSearch).
      const currentActiveId = activeProfessionalIdRef.current;

      // === Capturar profId del hash (redirección desde Mapa de Consultorios) ===
      // Si el usuario viene del mapa con ?profId=xxx en el hash, seleccionar
      // automáticamente a ese profesional en vez del primero de la lista.
      let profIdFromHash: string | null = null;
      if (typeof window !== "undefined") {
        const hash = window.location.hash;
        const match = hash.match(/profId=([^&]+)/);
        if (match) {
          profIdFromHash = match[1];
          // Limpiar el hash para que no se re-seleccione en próximas búsquedas
          window.location.hash = "";
        }
      }

      if (data.professionals.length > 0) {
        // Prioridad 1: profId del hash (viene del mapa)
        if (profIdFromHash) {
          const profFromHash = data.professionals.find((p) => p.id === profIdFromHash);
          if (profFromHash) {
            setActiveProfessionalId(profFromHash.id);
            toast.success(`Profesional seleccionado: ${profFromHash.name}`);
            return; // no continuar con la lógica de auto-selección
          }
        }

        // Prioridad 2: preservar selección actual si sigue en los resultados
        const stillExists = currentActiveId
          ? data.professionals.some((p) => p.id === currentActiveId)
          : false;
        if (!stillExists) {
          // Auto-seleccionar el primer profesional con slots disponibles
          const firstWithSlots = data.professionals.find((p) => p.hasAvailability);
          setActiveProfessionalId(firstWithSlots?.id || data.professionals[0].id);
        }
        // Si stillExists es true → NO tocar activeProfessionalId (preservar selección)
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

  // === Tarea 2026-08-21: Abrir AssignDialog para slot pasado NO configurado ===
  // Cuando el admin hace click en un slot "schedule" pasado (no disponible
  // porque el profesional no activó la disponibilidad), fabricamos un slot
  // sintético con la hora clickada para que el AssignDialog pueda abrirse
  // y el admin pueda registrar el turno retroactivo.
  //
  // El slot sintético:
  // - time: la hora clickada
  // - endTime: calculada sumando 45 min (default slotDuration)
  // - modality: "ambas" (luego el admin puede cambiarlo en el form)
  // - duration: 45 min (default)
  // - direccionId: null (sin dirección específica)
  const openAssignDialogForEmptyPast = (professional: ProfessionalResult, time: string, date: string) => {
    // Calcular endTime sumando 45 min (default)
    const [h, m] = time.split(":").map(Number);
    const totalMin = h * 60 + m + 45;
    const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;

    const syntheticSlot: AvailableSlot = {
      time,
      endTime,
      modality: "ambas",
      duration: 45,
      direccionId: null,
    };

    setAssignForm({
      patientName: "",
      patientPhone: "",
      patientEmail: "",
      notes: "",
      modality: "P", // default presencial, el admin puede cambiar
      isLead: false,
      leadId: null,
    });
    setAssignDialog({ open: true, professional, slot: syntheticSlot, date });
    toast.info(`Carga retroactiva — ${professional.name} el ${date} a las ${time} hs. El turno se guardará como completado sin enviar emails.`);
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
          leadSource: assignForm.leadSource,
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

  // === Abrir modal de cancelación con selector de origen ===
  // Reemplaza el confirm() nativo por un modal que pide:
  // 1. Quién solicita la cancelación (paciente o profesional)
  // 2. Motivo opcional
  // Esto es clave para reporting y para distinguir visualmente los turnos
  // cancelados por paciente vs por profesional en la agenda.
  const handleCancelAppointment = (slot: BookedSlot) => {
    if (!slot) return;
    // Abrir el modal de cancelación en vez del confirm()
    setCancelDialog({ open: true, slot, source: "", reason: "" });
  };

  // === Confirmar cancelación con origen y motivo ===
  const handleConfirmCancellation = async () => {
    const { slot, source, reason } = cancelDialog;
    if (!slot || !source) {
      toast.error("Seleccioná quién solicita la cancelación");
      return;
    }
    setCancelling(true);
    try {
      // Mapear source → status:
      //   "patient"      → cancelled_by_patient (estado final, slot liberado)
      //   "professional" → cancelled_by_professional (estado intermedio,
      //                    el admin decide después si reasigna o cancela)
      const newStatus = source === "patient" ? "cancelled_by_patient" : "cancelled_by_professional";

      const res = await fetch(`/api/appointments/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          cancellationSource: source,
          cancellationReason: reason || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al cancelar el turno");
        return;
      }
      const sourceLabel = source === "patient" ? "paciente" : "profesional";
      toast.success(`Turno de ${slot.patientName} cancelado por ${sourceLabel}.`);
      setCancelDialog({ open: false, slot: null, source: "", reason: "" });
      setFichaDialog((prev) => ({ ...prev, open: false }));
      handleSearch(); // re-fetch automático de la grilla
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      toast.error("Error de conexión al cancelar el turno");
    } finally {
      setCancelling(false);
    }
  };

  // === Reprogramar turno desde la ficha rápida (admin) ===
  // Cambia el status a "rescheduled" y guarda el motivo en notes.
  // El turno NO se cancela, queda en estado intermedio esperando que el
  // profesional coordine nueva fecha con el paciente.
  const [rescheduling, setRescheduling] = useState(false);
  const handleReschedule = async (slot: BookedSlot, reason: string) => {
    if (!slot || !reason.trim()) return;
    setRescheduling(true);
    try {
      const res = await fetch(`/api/appointments/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rescheduled",
          notes: `[Reprogramado por admin] ${reason.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al reprogramar el turno");
        return;
      }
      toast.success(`Turno de ${slot.patientName} marcado como "Reprogramado". El profesional debe coordinar nueva fecha.`);
      setFichaDialog((prev) => ({ ...prev, open: false }));
      handleSearch(); // re-fetch automático de la grilla
    } catch (err) {
      console.error("Error rescheduling appointment:", err);
      toast.error("Error de conexión al reprogramar el turno");
    } finally {
      setRescheduling(false);
    }
  };

  const handleClearFilters = () => {
    setProfession(""); setSpecialty("");
    setSelectedTherapyTypes([]); setSelectedTargetAudience([]);
    setSelectedTherapyModalities([]); setModality("");
  };

  // === Helper: normalizar texto (insensible a tildes y mayúsculas) ===
  // Convierte 'Mónica' → 'monica', 'Psicología' → 'psicologia', etc.
  // Permite que el admin busque 'monica' y encuentre a 'Mónica', o
  // 'psicologia' y encuentre 'Psicología'.
  const normalizeText = (text: string = "") => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Elimina tildes y diacríticos
      .toLowerCase();
  };

  // === Profesional activo ===
  const activeProfessional = useMemo(() => {
    if (!searchResults || !activeProfessionalId) return null;
    return searchResults.professionals.find((p) => p.id === activeProfessionalId) || null;
  }, [searchResults, activeProfessionalId]);

  // === Profesionales filtrados por búsqueda en tiempo real (tarea 2026-07-25) ===
  // Filtra por nombre, especialidad o profesión según lo que escriba el admin
  // en el buscador de la columna de profesionales. También aplica el toggle
  // "Solo disponibles" para mostrar solo los que tienen slots libres > 0.
  //
  // === Búsqueda insensible a tildes (tarea 2026-07-25) ===
  // Tanto el término de búsqueda como los campos del profesional pasan
  // por normalizeText() antes de hacer el .includes(). Así:
  //   - 'monica' encuentra a 'Mónica' ✅
  //   - 'psicologia' encuentra a 'Psicología' ✅
  //   - 'julia' encuentra a 'Julia' ✅ (ya funcionaba, pero ahora también
  //     funcionaría si el nombre tuviera tilde)
  const filteredProfessionals = useMemo(() => {
    if (!searchResults) return [];
    const normalizedSearch = normalizeText(professionalSearchTerm.trim());
    return searchResults.professionals.filter((p) => {
      // Filtro por término de búsqueda (nombre, especialidad, profesión)
      // Normalizamos ambos lados para que la búsqueda sea insensible a
      // tildes y mayúsculas.
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(p.name).includes(normalizedSearch) ||
        normalizeText(p.specialty).includes(normalizedSearch) ||
        normalizeText(p.profession || "").includes(normalizedSearch);
      // Filtro "Solo disponibles"
      const matchesAvailable = !onlyAvailable || p.totalFreeSlots > 0;
      return matchesSearch && matchesAvailable;
    });
  }, [searchResults, professionalSearchTerm, onlyAvailable]);

  // === Auto-scroll a la tarjeta del profesional seleccionado (tarea 2026-07-26) ===
  // Cuando se selecciona un profesional (especialmente vía profId del hash
  // desde el Mapa de Consultorios), hacer scroll suave hasta su tarjeta
  // en la columna del medio para que sea visible sin scroll manual.
  useEffect(() => {
    if (activeProfessionalId && searchResults) {
      // Pequeño delay para asegurar que el DOM se renderizó
      const timer = setTimeout(() => {
        const el = document.getElementById(`prof-card-${activeProfessionalId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeProfessionalId, searchResults]);

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
      {/* Grid template dinámico según qué columnas están abiertas/cerradas:
          - Ambas abiertas: 260px + 230px + 1fr
          - Solo Filtros cerrado: 40px + 230px + 1fr
          - Solo Profesionales cerrado: 260px + 40px + 1fr
          - Ambas cerradas: 40px + 40px + 1fr (máximo espacio para la grilla)
      */}
      <div className={`grid gap-4 transition-all duration-300 ${
        filtersOpen && professionalsOpen
          ? "lg:grid-cols-[260px_230px_1fr]"
          : filtersOpen && !professionalsOpen
            ? "lg:grid-cols-[260px_40px_1fr]"
            : !filtersOpen && professionalsOpen
              ? "lg:grid-cols-[40px_230px_1fr]"
              : "lg:grid-cols-[40px_40px_1fr]"
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
        {/* COLUMNA 2: Lista de profesionales (colapsable) */}
        {/* ============================================== */}
        {professionalsOpen ? (
          <Card className="border-teal-100 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <CardHeader className="pb-2 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-teal-900">
                  Profesionales {searchResults && `(${filteredProfessionals.length}${filteredProfessionals.length !== searchResults.summary.totalProfessionalsMatched ? ` de ${searchResults.summary.totalProfessionalsMatched}` : ""})`}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setProfessionalsOpen(false)} className="h-6 w-6 p-0 text-teal-400 hover:bg-teal-50" title="Colapsar lista de profesionales">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
              {/* === Buscador en tiempo real (tarea 2026-07-25) === */}
              {searchResults && searchResults.professionals.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-teal-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o especialidad..."
                      value={professionalSearchTerm}
                      onChange={(e) => setProfessionalSearchTerm(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs border border-teal-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-teal-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyAvailable}
                      onChange={(e) => setOnlyAvailable(e.target.checked)}
                      className="w-3 h-3 rounded border-teal-300 text-teal-600 focus:ring-teal-500/30"
                    />
                    Solo disponibles
                  </label>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-1 pt-2">
              {searching ? (
                <div className="py-8 text-center"><RefreshCw className="w-6 h-6 text-teal-400 mx-auto animate-spin" /></div>
              ) : !searchResults ? (
                <div className="py-8 text-center"><Search className="w-6 h-6 text-teal-300 mx-auto" /><p className="text-teal-500 mt-2 text-xs">Hacé clic en "Buscar"</p></div>
              ) : searchResults.professionals.length === 0 ? (
                <div className="py-8 text-center"><AlertCircle className="w-6 h-6 text-amber-400 mx-auto" /><p className="text-teal-600 mt-2 text-xs">Sin resultados</p></div>
              ) : filteredProfessionals.length === 0 ? (
                <div className="py-6 text-center">
                  <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
                  <p className="text-teal-600 mt-2 text-xs">
                    {onlyAvailable
                      ? "Ninguno tiene slots libres"
                      : `No hay coincidencias para "${professionalSearchTerm}"`}
                  </p>
                  {(professionalSearchTerm || onlyAvailable) && (
                    <button
                      onClick={() => { setProfessionalSearchTerm(""); setOnlyAvailable(false); }}
                      className="mt-2 text-[11px] text-teal-500 hover:text-teal-700 underline"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              ) : (
                filteredProfessionals.map((prof) => (
                  <button
                    key={prof.id}
                    id={`prof-card-${prof.id}`}
                    onClick={() => setActiveProfessionalId(prof.id)}
                    className={`w-full text-left p-1.5 rounded-lg border transition-all ${
                      activeProfessionalId === prof.id
                        ? "border-teal-500 bg-teal-50 shadow-sm ring-1 ring-teal-300"
                        : "border-teal-100 hover:border-teal-300 hover:bg-teal-50/50"
                    }`}
                  >
                    <p className="text-xs font-medium text-teal-900 truncate">{prof.name}</p>
                    <p className="text-[10px] text-teal-500 truncate">{prof.specialty}</p>
                    <div className="flex items-center gap-1 mt-0.5">
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
        ) : (
          <Card className="border-teal-100 flex flex-col items-center py-2 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setProfessionalsOpen(true)} className="h-8 w-8 p-0 text-teal-600 hover:bg-teal-50" title="Expandir lista de profesionales">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Users className="w-4 h-4 text-teal-400" />
            <span className="text-[9px] text-teal-500 text-center font-medium">
              {searchResults ? searchResults.summary.totalProfessionalsMatched : 0}
            </span>
          </Card>
        )}

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
                  <div className="flex gap-1.5 items-center">
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">{activeProfessional.totalFreeSlots} libres</Badge>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">{activeProfessional.totalBookedSlots} ocupados</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-teal-200 text-teal-600 hover:bg-teal-50"
                      onClick={() => setScheduleConfigDialog({
                        open: true,
                        professionalId: activeProfessional.id,
                        professionalName: activeProfessional.name,
                        tab: "config",
                      })}
                      title="Configurar agenda de este profesional"
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1" /> Config. Agenda
                    </Button>
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
                  onEmptyPastSlotClick={(time, date) => openAssignDialogForEmptyPast(activeProfessional, time, date)}
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
        onReschedule={handleReschedule}
        rescheduling={rescheduling}
      />

      {/* === Modal de Cancelación con Selector de Origen (tarea 2026-07-23) === */}
      {/* Reemplaza el confirm() nativo. Pide al admin/profesional especificar
          QUIÉN solicita la cancelación (paciente o profesional) y un motivo
          opcional. Esto permite distinguir visualmente los turnos cancelados
          por paciente vs por profesional en la agenda. */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-teal-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Cancelar Turno
            </DialogTitle>
          </DialogHeader>
          {cancelDialog.slot && (
            <div className="space-y-4 py-2">
              {/* Info del turno que se va a cancelar */}
              <div className="bg-red-50 rounded-lg p-3 space-y-1 border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>Paciente:</strong> {cancelDialog.slot.patientName}
                </p>
                <p className="text-sm text-red-700">
                  <strong>Fecha:</strong> {cancelDialog.slot.date} a las {cancelDialog.slot.time} hs
                </p>
              </div>

              {/* Selector de origen — OBLIGATORIO */}
              <div className="space-y-2">
                <Label className="text-teal-700 text-sm font-medium">
                  ¿Quién solicita la cancelación? <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    cancelDialog.source === "patient"
                      ? "border-amber-400 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <input
                      type="radio"
                      name="cancellation-source"
                      value="patient"
                      checked={cancelDialog.source === "patient"}
                      onChange={(e) => setCancelDialog((prev) => ({ ...prev, source: e.target.value as "patient" }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-teal-900">Solicitado por el Paciente</p>
                      <p className="text-xs text-slate-500">
                        El paciente pidió cancelar. El slot queda libre para nueva asignación.
                      </p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    cancelDialog.source === "professional"
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <input
                      type="radio"
                      name="cancellation-source"
                      value="professional"
                      checked={cancelDialog.source === "professional"}
                      onChange={(e) => setCancelDialog((prev) => ({ ...prev, source: e.target.value as "professional" }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-teal-900">Cancelado por el Profesional</p>
                      <p className="text-xs text-slate-500">
                        El profesional canceló. Se enviará email al paciente y el admin deberá decidir reasignar.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Motivo opcional */}
              <div className="space-y-2">
                <Label className="text-teal-700 text-sm font-medium">
                  Motivo de cancelación <span className="text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Select
                  value={cancelDialog.reason}
                  onValueChange={(value) => setCancelDialog((prev) => ({ ...prev, reason: value }))}
                >
                  <SelectTrigger className="border-teal-200 text-sm">
                    <SelectValue placeholder="Seleccionar motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motivos-personales">Motivos personales</SelectItem>
                    <SelectItem value="incapacidad-asistencia">Incapacidad de asistencia</SelectItem>
                    <SelectItem value="reprogramacion">Reprogramación</SelectItem>
                    <SelectItem value="enfermedad">Enfermedad</SelectItem>
                    <SelectItem value="emergencia-familiar">Emergencia familiar</SelectItem>
                    <SelectItem value="cambio-laboral">Cambio laboral / horario</SelectItem>
                    <SelectItem value="viaje">Viaje</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialog({ open: false, slot: null, source: "", reason: "" })}
              className="border-teal-300"
              disabled={cancelling}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCancellation}
              disabled={cancelling || !cancelDialog.source}
              variant="destructive"
            >
              {cancelling ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Cancelando...</>
              ) : (
                <><XCircle className="w-4 h-4 mr-2" /> Confirmar Cancelación</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Config. Agenda con Tabs (modo admin) === */}
      <Dialog open={scheduleConfigDialog.open} onOpenChange={(open) => setScheduleConfigDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-teal-900 flex items-center gap-2 justify-between flex-wrap">
              <span className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-teal-600" />
                {scheduleConfigDialog.professionalName}
              </span>
              {/* === Botón "Ver Perfil" en el header ===
                  Acceso directo al tab "Perfil" con la ficha completa del profesional.
                  Mantiene el professionalId del modal actual (no abre otro modal). */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-sage-300 text-sage-700 hover:bg-sage-50 hover:text-sage-800"
                onClick={() => setScheduleConfigDialog(prev => ({ ...prev, tab: "profile" }))}
                title="Ver ficha completa del profesional"
              >
                <User className="w-3.5 h-3.5 mr-1" />
                Ver Perfil
              </Button>
            </DialogTitle>
            <DialogDescription>
              Gestión de agenda profesional — Administrador
            </DialogDescription>
          </DialogHeader>

          {/* === Tabs === */}
          <div className="flex gap-2 border-b border-teal-100 pb-2 mb-3 flex-wrap">
            <button
              onClick={() => setScheduleConfigDialog(prev => ({ ...prev, tab: "config" }))}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                scheduleConfigDialog.tab === "config"
                  ? "bg-teal-600 text-white"
                  : "bg-teal-50 text-teal-600 hover:bg-teal-100"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" /> Configuración
            </button>
            <button
              onClick={() => setScheduleConfigDialog(prev => ({ ...prev, tab: "agenda" }))}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                scheduleConfigDialog.tab === "agenda"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Agenda Visual
            </button>
            <button
              onClick={() => setScheduleConfigDialog(prev => ({ ...prev, tab: "profile" }))}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                scheduleConfigDialog.tab === "profile"
                  ? "bg-sage-600 text-white"
                  : "bg-sage-50 text-sage-700 hover:bg-sage-100"
              }`}
            >
              <User className="w-3.5 h-3.5" /> Perfil
            </button>
          </div>

          {/* === Tab 1: Configuración === */}
          {scheduleConfigDialog.tab === "config" && scheduleConfigDialog.professionalId && (
            <div className="min-h-[400px]">
              <ProfessionalScheduleConfig
                key={scheduleConfigDialog.professionalId}
                propProfessionalId={scheduleConfigDialog.professionalId}
                onSaved={() => {
                  toast.success(`Agenda de ${scheduleConfigDialog.professionalName} actualizada con éxito`);
                  handleSearch();
                }}
              />
            </div>
          )}

          {/* === Tab 2: Agenda Visual === */}
          {scheduleConfigDialog.tab === "agenda" && scheduleConfigDialog.professionalId && (
            <div className="min-h-[500px]">
              <ProfessionalWeeklyAgenda professionalId={scheduleConfigDialog.professionalId} />
            </div>
          )}

          {/* === Tab 3: Perfil del Profesional (Hub de Control Profesional) ===
              Se renderiza el componente real <ProfessionalProfile> con el
              professionalId pasado como prop. Esto permite al admin ver y editar
              TODOS los datos del profesional (Hub de Control Profesional completo)
              sin tener que navegar a otra vista.

              El componente ProfessionalProfile cuando recibe propProfessionalId:
              - Entra en "modo admin": carga directamente al profesional por ID
              - Oculta las secciones "Datos Personales" y "Cambiar Contraseña"
                (no sería seguro que un admin edite eso desde acá)
              - Muestra TODO el Hub de Control Profesional completo:
                Identidad, Modalidades, Tipos de Terapia, Dirigido a,
                Modalidad de Terapia, Zonas, Sobre su Práctica, CV
              - Muestra las Direcciones de Atención Presencial

              Al cerrar el modal, el estado de la Agenda Central se mantiene
              intacto (no se pierden cambios no guardados en horarios). */}
          {scheduleConfigDialog.tab === "profile" && scheduleConfigDialog.professionalId && (
            <div className="min-h-[400px]">
              <ProfessionalProfile
                key={scheduleConfigDialog.professionalId}
                propProfessionalId={scheduleConfigDialog.professionalId}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleConfigDialog(prev => ({ ...prev, open: false }))} className="border-teal-200 text-teal-600">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  // === Tarea 2026-08-21: Carga retroactiva en slots NO configurados ===
  // Cuando el admin hace click en un slot "schedule" pasado (no configurado
  // como disponible pero dentro de la franja horaria del profesional),
  // dispara este handler para abrir el AssignDialog con un slot sintético.
  onEmptyPastSlotClick?: (time: string, date: string) => void;
}

function ExcelMatrix({ professional, weekDates, onSlotClick, onBookedSlotClick, onEmptyPastSlotClick }: ExcelMatrixProps) {
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

  // === Calcular timeSlots: RÉPLICA EXACTA del profesional ===
  // === Eje Y ESTANDARIZADO en intervalos de 15 minutos ===
  // FIX CRÍTICO: antes se unían los startTime de cada schedule, causando
  // filas descalzadas (14:00, 14:15, 14:45, 15:00) cuando días con distinto
  // inicio convivían. Ahora filas fijas cada 15 min desde min startTime
  // hasta max endTime. Los slots de 45 min se renderizan con rowSpan=3.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSchedules = (professional as any)?.schedules || [];
  const timeSlots = useMemo(() => {
    if (rawSchedules.length === 0) return generateTimeSlotsDynamic(15);

    // Encontrar min startTime y max endTime de todos los schedules
    let minMin = 24 * 60;
    let maxMin = 0;
    for (const s of rawSchedules) {
      const [sH, sM] = s.startTime.split(":").map(Number);
      const [eH, eM] = s.endTime.split(":").map(Number);
      const sMin = sH * 60 + sM;
      const eMin = eH * 60 + eM;
      if (sMin < minMin) minMin = sMin;
      if (eMin > maxMin) maxMin = eMin;
    }
    // Redondear a múltiplos de 15
    minMin = Math.floor(minMin / 15) * 15;
    maxMin = Math.ceil(maxMin / 15) * 15;

    const slots: string[] = [];
    for (let t = minMin; t < maxMin; t += 15) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
    return slots.length > 0 ? slots : generateTimeSlotsDynamic(15);
  }, [rawSchedules]);

  // === gridStartMinutes: hora mínima visible de la grilla en minutos ===
  const gridStartMinutes = useMemo(() => {
    if (timeSlots.length === 0) return 0;
    const [h, m] = timeSlots[0].split(":").map(Number);
    return h * 60 + m;
  }, [timeSlots]);

  // === getSlotGridPosition: posición absoluta en CSS Grid ===
  // PROHIBIDO usar % (módulo). Calcula la fila relativa a gridStartMinutes.
  function getSlotGridPosition(slotStartTimeStr: string, durationMinutes: number) {
    const [h, m] = slotStartTimeStr.split(":").map(Number);
    const slotStartMin = h * 60 + m;
    const rowStart = Math.floor((slotStartMin - gridStartMinutes) / 15) + 1;
    const span = Math.max(1, Math.round(durationMinutes / 15));
    return { rowStart, span };
  }

  // === Helper: "HH:MM" → minutos ===
  function timeToMinLocal(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  // === generateSlotsForSchedule: genera slots contiguos para un schedule ===
  function generateSlotsForSchedule(startTime: string, endTime: string, slotDuration: number): string[] {
    const slots: string[] = [];
    const sMin = timeToMinLocal(startTime);
    const eMin = timeToMinLocal(endTime);
    let current = sMin;
    while (current + slotDuration <= eMin) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      current += slotDuration;
    }
    return slots;
  }

  // === isSlotInSchedule: RÉPLICA EXACTA del profesional ===
  // El profesional NO verifica si time coincide con un slot generado.
  // Verifica si time está DENTRO DEL RANGO del schedule:
  //   daySchedules.some(s => time >= s.startTime && time < s.endTime)
  // Esto significa que TODAS las filas del grid que caen dentro del
  // rango de atención se muestran como "available", sin importar si
  // time coincide con un múltiplo exacto de slotDuration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawOverrides = (professional as any)?.scheduleOverrides || [];

  const isSlotInSchedule = useCallback((dayOfWeek: number, time: string): boolean => {
    const daySchedules = rawSchedules.filter((s: { dayOfWeek: number }) => s.dayOfWeek === dayOfWeek);
    if (daySchedules.length === 0) return false;
    return daySchedules.some((s: { startTime: string; endTime: string }) => {
      return time >= s.startTime && time < s.endTime;
    });
  }, [rawSchedules]);

  const getModalityForCell = useCallback((dayOfWeek: number, time: string): string | null => {
    const daySchedules = rawSchedules.filter((s: { dayOfWeek: number }) => s.dayOfWeek === dayOfWeek);
    const scheduleMatch = daySchedules.find((s: { startTime: string; endTime: string; modality: string }) =>
      time >= s.startTime && time < s.endTime
    );
    if (scheduleMatch) return scheduleMatch.modality;
    // Check extra overrides
    const dateStr = professional.weeklySlots[dayOfWeek]?.date || "";
    const extraMatch = rawOverrides.find((o: { date: string; type: string; startTime: string | null; endTime: string | null; modality: string | null }) => {
      if (o.date !== dateStr || o.type !== "extra") return false;
      if (!o.startTime || !o.endTime) return false;
      return time >= o.startTime && time < o.endTime;
    });
    return extraMatch?.modality || null;
  }, [rawSchedules, rawOverrides, professional.weeklySlots]);

  const isDateBlocked = useCallback((dateStr: string): boolean => {
    return rawOverrides.some((o: { date: string; type: string; startTime: string | null; endTime: string | null }) =>
      o.date === dateStr && o.type === "block" && !o.startTime && !o.endTime
    );
  }, [rawOverrides]);

  const isTimeSlotBlocked = useCallback((dateStr: string, time: string): boolean => {
    return rawOverrides.some((o: { date: string; type: string; startTime: string | null; endTime: string | null }) => {
      if (o.date !== dateStr || o.type !== "block") return false;
      if (!o.startTime || !o.endTime) return false;
      return time >= o.startTime && time < o.endTime;
    });
  }, [rawOverrides]);

  // === Helper: buscar el schedule que contiene un slot y calcular endTime ===
  // Para slots "past" necesitamos el endTime real (time + slotDuration del schedule)
  // para mostrarlo en el tooltip. Antes el endTime aparecía vacío.
  const getScheduleForCell = useCallback((dayOfWeek: number, time: string): { modality: string; slotDuration: number; endTime: string } | null => {
    const daySchedules = rawSchedules.filter((s: { dayOfWeek: number }) => s.dayOfWeek === dayOfWeek);
    const scheduleMatch = daySchedules.find((s: { startTime: string; endTime: string }) =>
      time >= s.startTime && time < s.endTime
    );
    if (scheduleMatch) {
      // Calcular endTime del slot = time + slotDuration
      const [h, m] = time.split(":").map(Number);
      const total = h * 60 + m + scheduleMatch.slotDuration;
      const endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      return {
        modality: scheduleMatch.modality,
        slotDuration: scheduleMatch.slotDuration,
        endTime,
      };
    }
    return null;
  }, [rawSchedules]);

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
            const isToday = dateStr === new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
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

        {/* === Time rows — CSS Grid por coordenadas === */}
        {/* FIX: mismo refactor que professional-weekly-agenda. Un solo grid
            container con celdas de fondo + slots posicionados por gridRow/gridColumn. */}
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          <div
            className="grid relative w-full"
            style={{
              gridTemplateColumns: `60px repeat(${WEEK_DAYS.length}, 1fr)`,
              gridAutoRows: "28px",
            }}
          >
            {/* === CAPA 1: Celdas de fondo (todas las filas × columnas) === */}
            {timeSlots.map((time, rowIdx) => (
              <React.Fragment key={`bg-${time}`}>
                {/* Time label (columna 1) */}
                <div
                  className="p-1 text-[11px] text-teal-400 text-right pr-2 border-r border-teal-50 flex items-start justify-end pt-1.5"
                  style={{ gridRow: rowIdx + 1, gridColumn: 1 }}
                >
                  {time}
                </div>
                {/* Day background cells (columnas 2-N) */}
                {WEEK_DAYS.map((day) => {
                  const dayData = professional.weeklySlots[day.dayOfWeek];
                  const dateStr = dayData?.date || "";
                  const isToday = dateStr === new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
                  return (
                    <div
                      key={`bg-${day.dayOfWeek}-${time}`}
                      className={`border-l border-b border-teal-50/50 ${isToday ? "bg-teal-50/20" : ""}`}
                      style={{ gridRow: rowIdx + 1, gridColumn: day.dayOfWeek + 1 }}
                    />
                  );
                })}
              </React.Fragment>
            ))}

            {/* === CAPA 2: Slots posicionados por coordenadas directas === */}
            {/* FIX CRÍTICO: NO usar % (módulo) para evaluar inicios de slot.
                Iterar el ARRAY DE SLOTS real y posicionar cada uno por
                getSlotGridPosition(slotStartTime, duration, gridStartMinutes). */}
            {WEEK_DAYS.map((day) => {
              const dayData = professional.weeklySlots[day.dayOfWeek];
              const dateStr = dayData?.date || "";
              const isToday = dateStr === new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
              const colIndex = day.dayOfWeek + 1;

              // === FIX: .filter() en vez de .find() para soportar MÚLTIPLES
              // franjas horarias por día (ej: Jueves 09-13 Online + 16-17 Presencial).
              // Antes usábamos .find() que solo tomaba la primera franja y
              // dejaba los demás bloques del día vacíos en la grilla. ===
              const daySchedules = rawSchedules.filter((s: { dayOfWeek: number }) => s.dayOfWeek === day.dayOfWeek);

              // 1. Generar slots de TODAS las franjas del día (contiguos, sin snapping)
              const scheduleSlots: string[] = [];
              for (const sch of daySchedules) {
                const dur = sch.slotDuration || 45;
                const slots = generateSlotsForSchedule(sch.startTime, sch.endTime, dur);
                // Evitar duplicados por las dudas
                for (const s of slots) {
                  if (!scheduleSlots.includes(s)) scheduleSlots.push(s);
                }
              }

              type AdminSlotItem = {
                time: string;
                duration: number;
                type: "schedule" | "available" | "booked" | "past";
                freeSlot?: typeof dayData.availableSlots[0];
                bookedSlot?: typeof dayData.bookedSlots[0];
              };

              const slotItems: AdminSlotItem[] = [];

              // Helper local: obtener slotDuration de la franja específica
              // que contiene este slot (para múltiples franjas por día)
              const getOwningSchedule = (slotTime: string) => {
                return daySchedules.find(
                  (s: { startTime: string; endTime: string; slotDuration?: number }) =>
                    slotTime >= s.startTime && slotTime < s.endTime
                );
              };

              for (const slotTime of scheduleSlots) {
                // Buscar la franja específica que contiene este slot
                const owningSchedule = getOwningSchedule(slotTime);
                const slotDuration = owningSchedule?.slotDuration || 45;

                const bookedSlot = dayData?.bookedSlots.find((s) => s.time === slotTime);
                const freeSlot = dayData?.availableSlots.find((s) => s.time === slotTime);
                const slotIsPast = dayData ? isSlotInPast(dayData.date, slotTime) : false;

                if (bookedSlot && bookedSlot.status !== "blocked") {
                  slotItems.push({ time: slotTime, duration: slotDuration, type: "booked", bookedSlot });
                } else if (freeSlot && !slotIsPast) {
                  slotItems.push({ time: slotTime, duration: slotDuration, type: "available", freeSlot });
                } else if (freeSlot && slotIsPast) {
                  slotItems.push({ time: slotTime, duration: slotDuration, type: "past", freeSlot });
                } else {
                  slotItems.push({ time: slotTime, duration: slotDuration, type: "schedule" });
                }
              }

              return slotItems.map((slot) => {
                const { rowStart, span } = getSlotGridPosition(slot.time, slot.duration);
                const slotIsPast = dayData ? isSlotInPast(dayData.date, slot.time) : false;
                const modality = (slot.type === "schedule" || slot.type === "available" || slot.type === "past")
                  ? getModalityForCell(day.dayOfWeek, slot.time)
                  : null;
                const scheduleInfo = slot.type === "past" ? getScheduleForCell(day.dayOfWeek, slot.time) : null;

                let slotClass = "p-0.5 transition-colors z-10 h-full flex flex-col justify-stretch ";
                if (slot.type === "schedule") slotClass += "bg-amber-50 ";
                else if (slot.type === "available") slotClass += "bg-emerald-50 ";
                else if (slot.type === "booked") slotClass += "bg-white ";
                else if (slot.type === "past") slotClass += "bg-emerald-50 ";
                if (slotIsPast && slot.type !== "booked") slotClass += "opacity-50 ";
                if (isToday) slotClass += "border-l-2 border-l-teal-300 ";

                const past = slotIsPast;

                return (
                  <div
                    key={`slot-${day.dayOfWeek}-${slot.time}`}
                    className={slotClass}
                    style={{
                      gridRow: `${rowStart} / span ${span}`,
                      gridColumn: colIndex,
                    }}
                    // === Click handler con soporte para slots pasados (admin) ===
                    // - slot.type === "available" Y NO pasado: click normal → onSlotClick
                    // - slot.type === "booked": click → onBookedSlotClick (abre FichaDialog)
                    // - slot.type === "past" Y freeSlot presente: click → onSlotClick
                    //   (permite al admin registrar turno retroactivo en slot pasado)
                    // - slot.type === "schedule" Y pasado Y onEmptyPastSlotClick:
                    //   click → onEmptyPastSlotClick (carga retroactiva en slot NO configurado)
                    // - otros casos: no clickable
                    onClick={
                      (slot.type === "available" && slot.freeSlot && !past)
                        ? () => onSlotClick(slot.freeSlot!, dayData!.date)
                        : (slot.type === "booked" && slot.bookedSlot)
                          ? () => onBookedSlotClick(slot.bookedSlot!)
                          : (slot.type === "past" && slot.freeSlot)
                            ? () => onSlotClick(slot.freeSlot!, dayData!.date)
                            : (slot.type === "schedule" && past && onEmptyPastSlotClick && dayData)
                              ? () => onEmptyPastSlotClick(slot.time, dayData.date)
                              : undefined
                    }
                  >
                    {slot.type === "schedule" && (
                      <div
                        className="flex items-center justify-center w-full rounded text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-600 flex-1 min-h-0"
                        title={`${MODALITY_LABELS[modality || "ambas"] || "P|OL"} ${slot.time}–${(() => { const si = getScheduleForCell(day.dayOfWeek, slot.time); if (si) { const [h,m] = slot.time.split(":").map(Number); const t = h*60+m+si.slotDuration; return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; } return ""; })()} hs — no disponible (el profesional debe activar este slot)`}
                      >
                        {MODALITY_LABELS[modality || "ambas"] || "P|OL"}
                      </div>
                    )}
                    {slot.type === "available" && slot.freeSlot && (
                      <div
                        className="flex items-center justify-center gap-0.5 w-full rounded text-[10px] font-medium bg-emerald-100 border border-emerald-200 text-emerald-700 flex-1 min-h-0"
                        title={`Disponible (${MODALITY_EMOJI[slot.freeSlot.modality || "ambas"]?.fullLabel || "Híbrida"}) ${slot.time}–${slot.freeSlot.endTime} hs — click para asignar turno`}
                      >
                        <span>{MODALITY_EMOJI[slot.freeSlot.modality || "ambas"]?.emoji || "🔄"}</span>
                        <span>Disponible</span>
                        <span className="text-[8px] opacity-75">({MODALITY_LABELS[slot.freeSlot.modality || "ambas"] || "P|OL"})</span>
                      </div>
                    )}
                    {slot.type === "past" && modality && scheduleInfo && (
                      <div
                        className={`flex items-center justify-center w-full rounded text-[10px] font-medium opacity-50 ${MODALITY_COLORS[modality] || MODALITY_COLORS.ambas} flex-1 min-h-0`}
                        title={`Pasado — ${MODALITY_LABELS[modality] || modality} ${slot.time} a ${scheduleInfo.endTime} hs`}
                      >
                        {MODALITY_LABELS[modality] || modality}
                      </div>
                    )}
                    {slot.type === "booked" && slot.bookedSlot && (
                      <BookedSlotCard slot={slot.bookedSlot} past={past} />
                    )}
                  </div>
                );
              });
            })}
          </div>
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
  const isBlocked = slot.status === "blocked";

  // === Slot BLOQUEADO por el profesional ===
  // Se renderiza con estilo distinto (slate, sin nombre de paciente)
  if (isBlocked) {
    return (
      <div
        className={`w-full px-1 ${past ? "opacity-60" : ""}`}
        title="Slot bloqueado por el profesional (click para ver ficha)"
      >
        <div className="w-full text-center rounded py-1.5 text-[10px] font-bold bg-slate-200 border-2 border-slate-400 text-slate-700 hover:bg-slate-300 transition-colors truncate select-none">
          🔒 Ocupado
        </div>
        <div className="text-[9px] text-slate-500 text-center mt-0.5 font-mono">
          {slot.endTime ? `${slot.time}–${slot.endTime}` : slot.time}
        </div>
      </div>
    );
  }

  // === Slot con appointment (mismo formato que la agenda del profesional) ===
  // Estructura:
  //   Línea 1: nombre del paciente (font-bold)
  //   Línea 2: rango horario "21:00–21:45" (font-mono)
  //   Línea 3: badges de status + modality
  const colors = STATUS_COLORS_ADMIN[slot.status] || STATUS_COLORS_ADMIN.pending;
  const statusLabel = STATUS_LABELS_ADMIN[slot.status] || slot.status;
  const modalityInfo = slot.modality ? MODALITY_BADGE_ADMIN[slot.modality] : null;
  const timeDisplay = slot.endTime ? `${slot.time}–${slot.endTime}` : slot.time;

  return (
    <div
      className={`w-full ${past ? "opacity-60" : ""} ${colors.bg} ${colors.text} ${colors.border} border rounded-md px-1.5 py-1 text-[10px] cursor-pointer overflow-hidden hover:shadow-md transition-shadow`}
      title={`${slot.patientName} — ${statusLabel}${slot.notes ? ` — ${slot.notes}` : ""} (click para ver ficha)`}
    >
      {/* Línea 1: nombre del paciente */}
      <div className="font-bold truncate">
        {slot.patientName}
      </div>
      {/* Línea 2: rango horario */}
      <div className="text-[9px] opacity-70 mt-0.5 font-mono font-bold">
        {timeDisplay}
      </div>
      {/* Línea 3: badges de status + modality + recurrencia */}
      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
        <span
          className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${colors.badge} border`}
        >
          {statusLabel}
        </span>
        {modalityInfo && (
          <span
            className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium border ${modalityInfo.color}`}
          >
            {modalityInfo.label}
          </span>
        )}
        {/* === Badges de Recurrencia (tarea 2026-08-21) === */}
        {slot.seriesId && (
          <span
            className="inline-flex items-center px-1 py-0 rounded text-[9px] font-medium border bg-purple-50 text-purple-700 border-purple-200"
            title="Este turno pertenece a una serie recurrente (paciente fijo)"
          >
            🔄 Serie
          </span>
        )}
        {slot.status === "skipped_holiday" && (
          <span
            className="inline-flex items-center px-1 py-0 rounded text-[9px] font-medium border bg-gray-100 text-gray-500 border-gray-300 opacity-60"
            title="Turno saltado por feriado"
          >
            Feriado
          </span>
        )}
        {slot.isOverride && (
          <span
            className="inline-flex items-center px-1 py-0 rounded text-[9px] font-medium border bg-amber-50 text-amber-600 border-amber-200"
            title="Sobreturno fuera de grilla normal"
          >
            Sobreturno
          </span>
        )}
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
  // Flag para evitar que el debounce se dispare después de seleccionar un paciente
  const selectingRef = useRef(false);

  // Debounced search de pacientes
  useEffect(() => {
    // Si acabamos de seleccionar un paciente, no disparar búsqueda
    if (selectingRef.current) {
      selectingRef.current = false;
      return;
    }
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
    // === Mapear modalidad del lead al formato del form ===
    let mappedModality = form.modality;
    if (patient.isLead && patient.leadModality) {
      const mod = patient.leadModality.toLowerCase();
      if (mod === "online") mappedModality = "OL";
      else if (mod === "presencial") mappedModality = "P";
      else if (mod === "híbrida" || mod === "hibrida") mappedModality = "H";
    }
    // === Autocompletar notes con el mensaje del lead si existe ===
    const autoNotes = patient.isLead && patient.leadNotes ? patient.leadNotes : form.notes;
    onFormChange({
      ...form,
      patientName: cleanName,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      isLead: patient.isLead || false,
      leadId: patient.isLead ? patient.id : null,
      leadSource: patient.isLead ? (patient.leadSource || "patient_request") : null,
      modality: mappedModality,
      notes: autoNotes,
    });
    // Setear flag para evitar que el useEffect del debounce se dispare
    selectingRef.current = true;
    // Setear patientSearch al cleanName
    setPatientSearch(cleanName);
    // Ocultar sugerencias inmediatamente
    setShowSuggestions(false);
    setSearchResults([]);
  };

  // Cuando el admin escribe en el input de búsqueda, también actualiza patientName
  // para que si no selecciona ningún suggestion, se use lo que escribió
  const handleSearchInputChange = (value: string) => {
    setPatientSearch(value);
    onFormChange({ ...form, patientName: value, isLead: false, leadId: null, leadSource: null });
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
            {/* === Mensaje "No se encontraron pacientes" ===
                SOLO se muestra cuando:
                - showSuggestions es true
                - patientSearch tiene >= 2 caracteres
                - NO estamos buscando (searching=false)
                - NO hay resultados (searchResults.length === 0)
                - El admin NO tiene ya un paciente seleccionado con ese nombre
                  (para evitar que aparezca después de seleccionar uno)
            */}
            {showSuggestions && patientSearch.length >= 2 && !searching && searchResults.length === 0 && form.patientName !== patientSearch && (
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

          {/* === Badge de dirección del consultorio (tarea 2026-07-25) === */}
          {/* Visible solo cuando la modalidad es Presencial o Híbrido.
              Resuelve la dirección desde ProfessionalAddress (modelo nuevo)
              con fallback a officeAddress (legacy). */}
          {(form.modality === "P" || form.modality === "H") && professional && (
            <OfficeAddressBadge professional={professional} slot={slot} />
          )}

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
// SUB-COMPONENTE: Badge de dirección del consultorio
// ====================================================================
// Muestra la dirección de atención del profesional cuando la modalidad
// del turno es Presencial o Híbrido. Resuelve la dirección desde:
// 1. ProfessionalAddress (modelo nuevo) — si el slot tiene direccionId,
//    busca esa dirección específica. Si no, usa la dirección marcada
//    como isActive=true. Si no hay ninguna activa, usa la primera.
// 2. officeAddress (legacy) — si no hay ProfessionalAddress, usa el
//    campo legacy del Professional.
//
// Esto le permite al admin ver rápidamente dónde se va a atender el
// paciente antes de confirmar la asignación, y al profesional confirmar
// que la dirección es correcta.
function OfficeAddressBadge({
  professional,
  slot,
}: {
  professional: ProfessionalResult;
  slot?: AvailableSlot | null;
}) {
  // === Resolver la dirección ===
  // defensive: si professional.addresses es undefined, tratarlo como array vacío
  const addresses = professional.addresses || [];
  let officeAddress = professional.officeAddress || null;

  // === SANITIZAR officeAddress legacy ===
  // Algunos profesionales cargaron su email en el campo officeAddress
  // por error (ej: julia.th26@gmail.com). Eso NO es una dirección física
  // y no debe mostrarse como tal al admin. Si detectamos que officeAddress
  // es un email, lo descartamos (tratamos como null).
  if (officeAddress && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officeAddress)) {
    console.warn("[OfficeAddressBadge] officeAddress parece un email, ignorando:", officeAddress);
    officeAddress = null;
  }

  let resolvedAddress: string | null = null;
  let resolvedLabel: string | null = null;

  // 1. Si hay addresses (modelo nuevo), buscar la correcta
  if (addresses.length > 0) {
    // Si el slot tiene direccionId, buscar esa dirección específica
    let targetAddr: ProfessionalAddress | undefined;
    if (slot?.direccionId) {
      targetAddr = addresses.find((a) => a.id === slot.direccionId);
    }
    // Si no hay match por direccionId, buscar la activa
    if (!targetAddr) {
      targetAddr = addresses.find((a) => a.isActive);
    }
    // Si no hay activa, usar la primera
    if (!targetAddr) {
      targetAddr = addresses[0];
    }
    if (targetAddr) {
      resolvedLabel = targetAddr.label;
      resolvedAddress = targetAddr.address;
    }
  }

  // 2. Fallback a officeAddress legacy (solo si no es email, ver sanitización arriba)
  if (!resolvedAddress && officeAddress) {
    resolvedAddress = officeAddress;
  }

  // === Renderizar ===
  // Si hay dirección, mostrar badge verde con la dirección completa
  if (resolvedAddress) {
    return (
      <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-md my-2 flex items-start gap-2 text-sm">
        <span className="text-lg leading-none">📍</span>
        <div className="flex-1">
          <p className="font-semibold text-emerald-800">Lugar de atención presencial</p>
          {resolvedLabel && (
            <p className="text-xs text-emerald-600 font-medium">{resolvedLabel}</p>
          )}
          <p className="text-emerald-800">{resolvedAddress}</p>
        </div>
      </div>
    );
  }

  // Si no hay dirección cargada, mostrar badge ámbar de advertencia
  return (
    <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-md my-2 flex items-start gap-2 text-sm">
      <span className="text-lg leading-none">⚠️</span>
      <div className="flex-1">
        <p className="font-semibold text-amber-800">Sin dirección de consultorio cargada</p>
        <p className="text-xs text-amber-700">
          El profesional no cargó su dirección de atención presencial. Coordiná la ubicación por WhatsApp o email antes de confirmar el turno.
        </p>
      </div>
    </div>
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
  onReschedule?: (slot: BookedSlot, reason: string) => void;
  rescheduling?: boolean;
}

function FichaDialog({ open, onOpenChange, professional, slot, onCancel, cancelling, onReschedule, rescheduling }: FichaDialogProps) {
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [resending, setResending] = useState(false);
  const [emailStatusOverride, setEmailStatusOverride] = useState<{
    patient?: string;
    professional?: string;
    patientSentAt?: string;
    professionalSentAt?: string;
  }>({});

  // === Estados del modo Reagendar con nueva fecha/hora ===
  const [rescheduleNewDateMode, setRescheduleNewDateMode] = useState(false);
  const [rescheduleNewDate, setRescheduleNewDate] = useState("");
  const [rescheduleNewTime, setRescheduleNewTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // === Handler: Reprogramar SOLO esta fecha de una serie recurrente ===
  // Llama a PATCH /api/appointments/reschedule con:
  //   { appointmentId, newDate, newTimeSlot }
  // Mantiene intacta la serie general para los días siguientes.
  // Solo actualiza el appointment individual.
  const handleRescheduleSingleFromSeries = async () => {
    if (!slot) return;
    setRescheduleError(null);
    if (!rescheduleNewDate || !rescheduleNewTime) {
      setRescheduleError("Debés seleccionar fecha y hora");
      setRescheduleNewDateMode(true);
      return;
    }
    setRescheduling(true);
    try {
      const res = await fetch("/api/appointments/reschedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: slot.id,
          newDate: rescheduleNewDate,
          newTimeSlot: rescheduleNewTime,
          isOverride: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Turno reprogramado a ${rescheduleNewDate} ${rescheduleNewTime}. La serie general NO se afecta.`);
        setRescheduleNewDateMode(false);
        setRescheduleNewDate("");
        setRescheduleNewTime("");
        setRescheduleError(null);
        if (onOpenChange) onOpenChange(false);
      } else {
        setRescheduleError(data.error || "Error al reprogramar el turno");
      }
    } catch {
      setRescheduleError("Error de conexión al reprogramar");
    } finally {
      setRescheduling(false);
    }
  };

  // === Handler: Dar de baja una serie recurrente completa ===
  // Llama a PATCH /api/appointments/recurring/[id]/cancel
  // Setea active=false en la serie y cancela los turnos futuros.
  const handleCancelSeries = async () => {
    if (!slot?.seriesId) return;
    if (!confirm("¿Dar de baja la serie recurrente completa? Se cancelarán todos los turnos futuros. Los turnos ya atendidos se mantienen para auditoría.")) return;
    setRescheduling(true);
    try {
      const res = await fetch(`/api/appointments/recurring/${slot.seriesId}/cancel`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Serie cancelada. ${data.cancelledAppointments || 0} turnos futuros cancelados, ${data.keptAppointments || 0} históricos mantenidos.`);
        if (onOpenChange) onOpenChange(false);
      } else {
        toast.error(data.error || "Error al cancelar la serie");
      }
    } catch {
      toast.error("Error de conexión al cancelar la serie");
    } finally {
      setRescheduling(false);
    }
  };

  // === Handler: confirmar reagendamiento con nueva fecha/hora ===
  // Llama a PATCH /api/appointments/[id] con:
  //   { status: "confirmed", newDate, newTime }
  // El backend actualiza date/time del turno y dispara email al paciente.
  const handleRescheduleNewDate = async () => {
    if (!slot) return;
    setRescheduleError(null);
    if (!rescheduleNewDate || !rescheduleNewTime) {
      setRescheduleError("Debés seleccionar fecha y hora");
      return;
    }
    try {
      const res = await fetch(`/api/appointments/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "confirmed",
          newDate: rescheduleNewDate,
          newTime: rescheduleNewTime,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Turno reagendado con éxito. Email enviado al paciente.");
        setRescheduleNewDateMode(false);
        setRescheduleNewDate("");
        setRescheduleNewTime("");
        // Cerrar el modal principal para que se refresque la grilla
        if (onOpenChange) onOpenChange(false);
      } else {
        setRescheduleError(data.error || "Error al reagendar el turno");
      }
    } catch {
      setRescheduleError("Error de conexión al reagendar el turno");
    }
  };

  // Limpiar estados cuando se cierra el dialog
  useEffect(() => {
    if (!open) {
      setRescheduleMode(false);
      setRescheduleReason("");
      setEmailStatusOverride({});
      setRescheduleNewDateMode(false);
      setRescheduleNewDate("");
      setRescheduleNewTime("");
      setRescheduleError(null);
    }
  }, [open]);

  if (!professional || !slot) return null;
  const modalityLabel = slot.modality ? MODALITY_LABELS[slot.modality] || slot.modality : "—";
  const isRescheduled = slot.status === "rescheduled";
  const statusLabel = slot.status === "confirmed" ? "Confirmado" : slot.status === "pending" ? "Pendiente" : slot.status === "rescheduled" ? "Reprogramado" : slot.status;

  // === Estados de email (con override para actualización en tiempo real) ===
  const patientEmailStatus = emailStatusOverride.patient || slot.patientEmailStatus || "PENDING";
  const professionalEmailStatus = emailStatusOverride.professional || slot.professionalEmailStatus || "PENDING";
  const patientEmailSentAt = emailStatusOverride.patientSentAt || slot.patientEmailSentAt;
  const professionalEmailSentAt = emailStatusOverride.professionalSentAt || slot.professionalEmailSentAt;

  const handleResendEmail = async () => {
    setResending(true);
    try {
      const res = await fetch(`/api/appointments/${slot.id}/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: "both" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al reenviar emails");
        return;
      }
      // Actualizar badges en tiempo real
      const now = new Date().toISOString();
      setEmailStatusOverride({
        patient: data.results?.patient || "SENT",
        professional: data.results?.professional || "SENT",
        patientSentAt: now,
        professionalSentAt: now,
      });
      toast.success(data.message || "¡Mails de confirmación enviados exitosamente!");
    } catch {
      toast.error("Error de conexión al reenviar emails");
    } finally {
      setResending(false);
    }
  };

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
            <div className="flex items-center gap-2 text-sm text-teal-900 font-bold"><Clock className="w-4 h-4 text-teal-600" /><span>{slot.endTime ? `${slot.time}–${slot.endTime} hs` : `${slot.time} hs`}</span><Badge variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-700">{modalityLabel}</Badge></div>
            <div className="flex items-center gap-2 text-xs"><span className="text-teal-500">Estado:</span><Badge variant={isRescheduled ? "destructive" : slot.status === "confirmed" ? "default" : "outline"} className="text-xs">{statusLabel}</Badge></div>
          </div>

          {/* === Badge de dirección del consultorio (tarea 2026-07-25) === */}
          {/* Visible solo cuando la modalidad del turno es Presencial o Híbrido. */}
          {(slot.modality === "P" || slot.modality === "H") && (
            <OfficeAddressBadge professional={professional} />
          )}

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

          {/* === Estado de Notificaciones por Email === */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Estado de Notificaciones
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* Email Paciente */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">📧 Paciente</span>
                {patientEmailStatus === "SENT" ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700 w-fit">
                    ✅ Enviado{patientEmailSentAt ? ` (${new Date(patientEmailSentAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })})` : ""}
                  </Badge>
                ) : patientEmailStatus === "FAILED" ? (
                  <Badge variant="outline" className="text-[10px] bg-red-50 border-red-200 text-red-600 w-fit">
                    ❌ Falló
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-slate-100 border-slate-200 text-slate-500 w-fit">
                    ⏳ No enviado
                  </Badge>
                )}
              </div>
              {/* Email Profesional */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">📧 Profesional</span>
                {professionalEmailStatus === "SENT" ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700 w-fit">
                    ✅ Enviado{professionalEmailSentAt ? ` (${new Date(professionalEmailSentAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })})` : ""}
                  </Badge>
                ) : professionalEmailStatus === "FAILED" ? (
                  <Badge variant="outline" className="text-[10px] bg-red-50 border-red-200 text-red-600 w-fit">
                    ❌ Falló
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-slate-100 border-slate-200 text-slate-500 w-fit">
                    ⏳ No enviado
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* === Modo Reprogramar: textarea para el motivo === */}
          {rescheduleMode && !rescheduleNewDateMode && (
            <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-semibold text-orange-800">Reprogramar turno</p>
              </div>
              <p className="text-xs text-orange-700">
                Indicá el motivo de la reprogramación. El turno quedará en estado
                "Reprogramado" y el profesional deberá coordinar nueva fecha con el paciente.
              </p>
              <textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Ej: El profesional tiene una urgencia, se reprogramará para la próxima semana..."
                className="w-full min-h-[80px] rounded-md border border-orange-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={rescheduling || rescheduleReason.trim().length < 3}
                  onClick={() => {
                    if (onReschedule) onReschedule(slot, rescheduleReason.trim());
                  }}
                >
                  {rescheduling ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Confirmando...</> : <><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar Reprogramación</>}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-300 text-slate-600 hover:bg-slate-50"
                  onClick={() => { setRescheduleMode(false); setRescheduleReason(""); }}
                  disabled={rescheduling}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* === Modo Reagendar con nueva fecha/hora ===
              Solo se muestra cuando el turno ya está en estado "rescheduled"
              y el admin/profesional quiere asignarle nueva fecha y hora.
              Al confirmar:
              1. PATCH /api/appointments/[id] con status="confirmed" + newDate + newTime
              2. Backend actualiza date/time del turno
              3. Backend dispara email al paciente con los nuevos datos
              4. El slot original queda libre (rescheduled no ocupa slot) */}
          {rescheduleNewDateMode && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">Reagendar Turno — Asignar nueva fecha/hora</p>
              </div>
              <p className="text-xs text-emerald-700">
                Seleccioná la nueva fecha y hora para el turno. El paciente recibirá
                automáticamente un email con los datos actualizados.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-emerald-700">Nueva fecha</Label>
                  <Input
                    type="date"
                    value={rescheduleNewDate}
                    onChange={(e) => setRescheduleNewDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border-emerald-200 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-emerald-700">Nueva hora</Label>
                  <Input
                    type="time"
                    value={rescheduleNewTime}
                    onChange={(e) => setRescheduleNewTime(e.target.value)}
                    step={900}
                    className="border-emerald-200 bg-white"
                  />
                </div>
              </div>
              {rescheduleError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded">
                  {rescheduleError}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={rescheduling || !rescheduleNewDate || !rescheduleNewTime}
                  onClick={handleRescheduleNewDate}
                >
                  {rescheduling
                    ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Confirmando...</>
                    : <><CalendarPlus className="w-3 h-3 mr-1" /> Confirmar Reagendamiento</>}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-300 text-slate-600 hover:bg-slate-50"
                  onClick={() => { setRescheduleNewDateMode(false); setRescheduleError(null); }}
                  disabled={rescheduling}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between gap-2 sm:justify-between flex-wrap">
          {/* === Botones de acción (solo si NO estamos en modo reprogramar/reagendar) === */}
          {!rescheduleMode && !rescheduleNewDateMode && (
            <>
              {/* === Botón Reenviar Email === */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendEmail}
                disabled={resending}
                className="text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                {resending ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
                {resending ? "Enviando..." : "📧 Reenviar Email"}
              </Button>

              {/* === Botón Reprogramar ===
                  Solo aparece para turnos confirmed/pending que NO sean pasados.
                  Misma lógica que Cancelar Turno, pero con motivo obligatorio. */}
              {onReschedule && ["confirmed", "pending"].includes(slot.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRescheduleMode(true)}
                  disabled={cancelling || rescheduling}
                  className="text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Reprogramar
                </Button>
              )}

              {/* === Botón Reagendar Turno (NUEVO) ===
                  Solo aparece para turnos en estado "rescheduled" (pendientes
                  de reagendar). Permite asignar nueva fecha/hora y disparar
                  email de confirmación al paciente. */}
              {slot.status === "rescheduled" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setRescheduleNewDateMode(true);
                    setRescheduleNewDate("");
                    setRescheduleNewTime("");
                    setRescheduleError(null);
                  }}
                  disabled={cancelling || rescheduling || resending}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CalendarPlus className="w-3 h-3 mr-1" /> 🗓️ Reagendar Turno
                </Button>
              )}

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

              {/* === Botones de Serie Recurrente (tarea 2026-08-21) ===
                  Solo se muestran si el turno pertenece a una serie recurrente.
                  - "Reprogramar solo esta fecha": abre el modal de reprogramación
                    puntual (PATCH /api/appointments/reschedule). Mantiene la serie
                    intacta para los días siguientes.
                  - "Baja de Serie Completa": cancela la serie a futuro
                    (PATCH /api/appointments/recurring/[id]/cancel). */}
              {slot.seriesId && ["scheduled", "confirmed", "pending"].includes(slot.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRescheduleSingleFromSeries()}
                  disabled={cancelling || rescheduling || resending}
                  className="text-xs border-purple-300 text-purple-600 hover:bg-purple-50"
                  title="Reprogramar SOLO esta fecha. La serie general no se afecta."
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Reprogramar solo esta fecha
                </Button>
              )}
              {slot.seriesId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelSeries()}
                  disabled={cancelling || rescheduling || resending}
                  className="text-xs border-red-300 text-red-600 hover:bg-red-50"
                  title="Dar de baja la serie completa. Se cancelan los turnos futuros."
                >
                  <UserX className="w-3 h-3 mr-1" /> Baja de Serie Completa
                </Button>
              )}

              {/* === Mensaje informativo para turnos NO cancelables === */}
              {onCancel && ["completed", "absent", "cancelled", "cancelled_by_professional", "blocked"].includes(slot.status) && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Turno no cancelable (estado: {slot.status === "completed" ? "atendido" : slot.status === "absent" ? "ausente" : slot.status === "blocked" ? "bloqueado" : "cancelado"})</span>
                </div>
              )}
            </>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
