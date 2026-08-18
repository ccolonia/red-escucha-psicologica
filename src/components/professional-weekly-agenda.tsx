"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  XCircle,
  MapPin,
  Monitor,
  Copy,
  RefreshCw,
  Mail,
  MessageCircle,
  AlertCircle,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isToday,
  isSameDay,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";

// ===== Types =====
interface Appointment {
  id: string;
  date: string;
  time: string;
  // timeEnd calculado por el backend según slotDuration del schedule del
  // profesional para ese día. Default 45 min si no viene.
  timeEnd?: string;
  status: string;
  reason: string | null;
  notes: string | null;
  modality: string | null;
  patient: { user: { name: string; email: string; phone: string | null } };
  professional: { user: { name: string } };
}

interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  modality: string;
}

interface OverrideEntry {
  id?: string;
  date: string;
  type: "block" | "extra";
  startTime?: string | null;
  endTime?: string | null;
  modality?: string | null;
  slotDuration?: number | null;
}

// ===== Constants =====
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; border: string; badge: string }
> = {
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  confirmed: {
    bg: "bg-teal-50",
    text: "text-teal-800",
    border: "border-teal-200",
    badge: "bg-teal-100 text-teal-700 border-teal-200",
  },
  completed: {
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
  },
  cancelled: {
    bg: "bg-red-50",
    text: "text-red-500 line-through",
    border: "border-red-200",
    badge: "bg-red-100 text-red-600 border-red-200",
  },
  cancelled_by_professional: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
  absent: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
  rescheduled: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-600 border-blue-200",
  },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  completed: "Atendido",
  cancelled: "Cancelado",
  cancelled_by_professional: "Cancelado por profesional",
  absent: "Ausente",
  rescheduled: "Reprogramado",
};

// Modality display for available cells (grid background)
const MODALITY_CELL_DISPLAY: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; colorClass: string; fullLabel: string; emoji: string }
> = {
  OL: { icon: Monitor, label: "OL", colorClass: "bg-blue-50 border border-blue-200 text-blue-600 rounded-lg py-2 text-xs font-medium hover:bg-blue-100 transition-colors", fullLabel: "Online", emoji: "💻" },
  P: { icon: MapPin, label: "P", colorClass: "bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg py-2 text-xs font-medium hover:bg-emerald-100 transition-colors", fullLabel: "Presencial", emoji: "📍" },
  ambas: { icon: MapPin, label: "P|OL", colorClass: "bg-amber-50 border border-amber-200 text-amber-600 rounded-lg py-2 text-xs font-medium hover:bg-amber-100 transition-colors", fullLabel: "Híbrida", emoji: "🔄" },
  H: { icon: MapPin, label: "H", colorClass: "bg-purple-50 border border-purple-200 text-purple-600 rounded-lg py-2 text-xs font-medium hover:bg-purple-100 transition-colors", fullLabel: "Híbrida", emoji: "🔄" },
};

// Modality display for appointment cards
const MODALITY_BADGE: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
  }
> = {
  OL: { icon: Monitor, label: "OL", color: "bg-blue-50 text-blue-600 border-blue-200" },
  P: { icon: MapPin, label: "P", color: "bg-purple-50 text-purple-600 border-purple-200" },
  ambas: { icon: MapPin, label: "P|OL", color: "bg-indigo-50 text-indigo-600 border-indigo-200" },
  H: { icon: MapPin, label: "H", color: "bg-violet-50 text-violet-600 border-violet-200" },
};

// === Timezone Argentina constante ===
const ARG_TZ = "America/Argentina/Buenos_Aires";

// === Verificar si un slot está en el pasado ===
// PROBLEMA: el profesional podía cancelar turnos atendidos, bloquear días
// pasados y marcar turnos futuros como atendidos/ausentes. Todo eso es
// un error de lógica de negocio: las acciones retroactivas NO deben
// permitirse.
//
// FIX: función helper que compara fecha y hora del slot contra la fecha
// y hora actual en timezone Argentina (mismo patrón que la Agenda Central
// del admin, commit 0db5161).
//
// USA comparación de strings (no new Date()) para evitar bugs de timezone
// del servidor Vercel que está en UTC.
function isSlotInPast(date: string, time: string): boolean {
  try {
    const todayArg = new Date().toLocaleDateString("sv-SE", { timeZone: ARG_TZ });
    const nowTimeArg = new Date().toLocaleTimeString("en-GB", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit" });
    if (date < todayArg) return true;
    if (date > todayArg) return false;
    return time <= nowTimeArg;
  } catch {
    return false;
  }
}

// Generate time slots dynamically based on the professional's slotDuration.
// ANTES: array fijo de 30 min (07:00, 07:30, 08:00...). Esto causaba
// desfasaje visual cuando el profesional configuraba bloques de 45 min.
// AHORA: genera slots según el slotDuration más común de los schedules
// del profesional. Si no hay schedules, usa 45 min por defecto.
function generateTimeSlotsDynamic(slotDuration: number): string[] {
  const slots: string[] = [];
  let h = 6, m = 0; // empezar 06:00
  const endH = 24; // hasta 24:00 (medianoche)
  while (h < endH) {
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    m += slotDuration;
    while (m >= 60) { h += 1; m -= 60; }
  }
  return slots;
}

// === Generar slots alineados al startTime de un schedule específico ===
// PROBLEMA: generateTimeSlotsDynamic empieza siempre desde 06:00. Si el
// schedule empieza a las 08:15 con slotDuration=45, los slots generados
// desde 06:00 son: 06:00, 06:45, 07:30, 08:15, 09:00, 09:45...
// Coinciden porque 08:15 cae en 06:00 + 2*45.
// PERO si el schedule empieza a las 08:30 con slotDuration=45, los slots
// generados desde 06:00 son: 06:00, 06:45, 07:30, 08:15, 09:00... y
// 08:30 NO coincide con ninguna fila → el schedule no se ve.
//
// SOLUCIÓN: generar slots alineados al startTime del schedule:
// 08:30, 09:15, 10:00, 10:45... garantizando que TODOS los slots del
// schedule aparezcan como filas en la grilla.
function generateTimeSlotsForSchedule(startTime: string, endTime: string, slotDuration: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  let current = startMin;
  // === Slots estrictamente contiguos ===
  // Solo generar un slot si el slot COMPLETO entra dentro del rango
  // (current + slotDuration <= endMin). Esto evita:
  // 1. Slots que se extienden past endTime (ej: 19:15-20:00 cuando endTime es 19:30)
  // 2. Gaps artificiales por snapping/rounding
  // El siguiente slot empieza EXACTAMENTE donde termina el anterior:
  // currentStart = currentEnd (contiguo estricto, sin huecos)
  while (current + slotDuration <= endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    current += slotDuration;
  }
  return slots;
}

// === Eje Y estandarizado en intervalos de 15 minutos ===
// FIX CRÍTICO: el eje Y NO debe construirse uniendo los startTime de cada
// schedule, porque eso genera filas descalzadas (14:00, 14:15, 14:45, 15:00)
// cuando días con distinto inicio conviven en la misma grilla.
//
// SOLUCIÓN: generar filas fijas cada 15 minutos desde el min startTime
// hasta el max endTime de TODOS los schedules. Así:
//   - Un slot de 45 min a las 14:00 abarca 3 filas (14:00, 14:15, 14:30)
//     via rowSpan=3
//   - Un slot de 45 min a las 14:15 también abarca 3 filas (14:15, 14:30, 14:45)
//   - Ambos conviven alineados sin filas fantasma intermedias
//
// Los slots se renderizan como BLOQUES UNIFICADOS (rowSpan) en la fila
// correspondiente a su startTime, no como tarjetas duplicadas por sub-intervalo.
const GRID_INTERVAL_MIN = 15; // 15 minutos por fila

function generateStandardizedTimeSlots(schedules: ScheduleEntry[]): string[] {
  if (schedules.length === 0) {
    // Fallback: 07:00 a 22:00 cada 15 min
    return generateTimeSlotsDynamic(GRID_INTERVAL_MIN);
  }

  // Encontrar el min startTime y max endTime de todos los schedules
  let minMin = 24 * 60; // 24:00 en minutos
  let maxMin = 0;
  for (const s of schedules) {
    const [sH, sM] = s.startTime.split(":").map(Number);
    const [eH, eM] = s.endTime.split(":").map(Number);
    const sMin = sH * 60 + sM;
    const eMin = eH * 60 + eM;
    if (sMin < minMin) minMin = sMin;
    if (eMin > maxMin) maxMin = eMin;
  }

  // Redondear minMin hacia abajo al múltiplo de 15 más cercano
  minMin = Math.floor(minMin / GRID_INTERVAL_MIN) * GRID_INTERVAL_MIN;
  // Redondear maxMin hacia arriba al múltiplo de 15 más cercano
  maxMin = Math.ceil(maxMin / GRID_INTERVAL_MIN) * GRID_INTERVAL_MIN;

  // Generar filas cada 15 min
  const slots: string[] = [];
  for (let t = minMin; t < maxMin; t += GRID_INTERVAL_MIN) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
  return slots;
}

// === Calcular cuántas filas de 15 min abarca un slot ===
// Ej: slotDuration=45 → 3 filas; slotDuration=60 → 4 filas; slotDuration=30 → 2 filas
function getSlotRowSpan(slotDuration: number): number {
  return Math.max(1, Math.round(slotDuration / GRID_INTERVAL_MIN));
}

// === Calcular posición absoluta en el CSS Grid para un slot ===
// PROHIBIDO usar % (módulo) para evaluar inicios de slot.
// En su lugar, calculamos la fila del grid relativa al gridStartMinutes
// (la hora mínima visible de la grilla).
//
// Ej: gridStartMinutes=480 (08:00), slotStartTime="14:00" (840 min)
//   rowStart = (840 - 480) / 15 + 1 = 360/15 + 1 = 24 + 1 = 25
//   span = 45 / 15 = 3
//   → gridRow: "25 / span 3"
function getSlotGridPosition(
  slotStartTimeStr: string,
  durationMinutes: number,
  gridStartMinutes: number
): { rowStart: number; span: number } {
  const [h, m] = slotStartTimeStr.split(":").map(Number);
  const slotStartMin = h * 60 + m;
  const rowStart = Math.floor((slotStartMin - gridStartMinutes) / GRID_INTERVAL_MIN) + 1;
  const span = Math.max(1, Math.round(durationMinutes / GRID_INTERVAL_MIN));
  return { rowStart, span };
}

// === Helper: convertir "HH:MM" a minutos desde medianoche ===
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ===== Component =====
interface ProfessionalWeeklyAgendaProps {
  professionalId?: string;
}

export function ProfessionalWeeklyAgenda({
  professionalId: propProfessionalId,
}: ProfessionalWeeklyAgendaProps) {
  const { data: session } = useSession();
  const [fetchedProfessionalId, setFetchedProfessionalId] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [overrides, setOverrides] = useState<OverrideEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [isMobile, setIsMobile] = useState(false);
  const [userSelectedDay, setUserSelectedDay] = useState<Date | null>(null);

  // === Appointments visibles en la Agenda Visual (grilla) ===
  // Filtramos cancelled_by_patient y cancelled (legacy) para que el slot
  // aparezca como LIBRE en la grilla y el profesional pueda activarlo
  // para otro paciente.
  //
  // === FIX (tarea 2026-08-18): también excluimos 'rescheduled' de la grilla. ===
  // Cuando un turno se marca como "Reprogramado" (pendiente de reagendar),
  // el slot ORIGINAL debe quedar LIBRE en la grilla (no se renderiza como
  // bloque ocupado). El turno sigue existiendo en la DB y se puede ver en:
  //   - La pestaña "Lista" del dashboard (auditoría histórica)
  //   - El panel Admin (con badge "+48h" para coordinación)
  //   - El modal de Ficha (cuando se filtra por "Reprogramados")
  //
  // El array completo `appointments` (sin filtrar) sigue usándose en:
  // - La pestaña "Lista" del dashboard (auditoría histórica de cancelaciones)
  // - Los handlers de cancelar/reprogramar (que comparan por ID)
  //
  // Pero para la grilla visual usamos `visibleAppointments` que excluye
  // los cancelados por paciente Y los rescheduled. Así:
  //   - Si un turno se cancela por paciente → el slot se libera (verde)
  //   - Si un turno se marca como reprogramado → el slot se libera (verde)
  //   - Si después se asigna OTRO turno en ese horario → se muestra el nuevo
  //   - El turno cancelado/reprogramado sigue siendo visible en la pestaña "Lista"
  const visibleAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.status !== "cancelled_by_patient" &&
          a.status !== "cancelled" &&
          a.status !== "rescheduled"
      ),
    [appointments]
  );

  // === Estados para acciones masivas ===
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyFromDay, setCopyFromDay] = useState("1");
  const [copyToDay, setCopyToDay] = useState("2");
  const [copying, setCopying] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // === Ficha rápida del paciente (paridad con admin) ===
  const [fichaAppointment, setFichaAppointment] = useState<Appointment | null>(null);
  const [fichaDialogOpen, setFichaDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // === Modal de Cancelación con Selector de Origen (tarea 2026-07-24) ===
  // Reemplaza el confirm() nativo por un modal que pide al profesional
  // especificar QUIÉN solicita la cancelación y el motivo opcional.
  const [cancelSourceDialog, setCancelSourceDialog] = useState<{
    open: boolean;
    source: "patient" | "professional" | "";
    reason: string;
  }>({ open: false, source: "", reason: "" });
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [activatingSlot, setActivatingSlot] = useState(false);

  // === Estados para el modo Reagendar con nueva fecha/hora ===
  // Cuando el profesional abre un turno en estado "rescheduled" y quiere
  // asignarle nueva fecha/hora, se activa este modo.
  const [rescheduleNewDateMode, setRescheduleNewDateMode] = useState(false);
  const [rescheduleNewDate, setRescheduleNewDate] = useState("");
  const [rescheduleNewTime, setRescheduleNewTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // === Handler: confirmar reagendamiento con nueva fecha/hora ===
  // Llama a PATCH /api/appointments/[id] con:
  //   { status: "confirmed", newDate, newTime }
  // El backend actualiza date/time del turno y dispara email al paciente.
  const handleRescheduleNewDate = async () => {
    if (!fichaAppointment) return;
    setRescheduleError(null);
    if (!rescheduleNewDate || !rescheduleNewTime) {
      setRescheduleError("Debés seleccionar fecha y hora");
      return;
    }
    setRescheduling(true);
    try {
      const res = await fetch(`/api/appointments/${fichaAppointment.id}`, {
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
        // Actualizar el appointment localmente con los nuevos datos
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === fichaAppointment.id
              ? {
                  ...a,
                  status: "confirmed",
                  date: rescheduleNewDate,
                  time: rescheduleNewTime,
                }
              : a
          )
        );
        setRescheduleNewDateMode(false);
        setRescheduleNewDate("");
        setRescheduleNewTime("");
        setFichaDialogOpen(false);
      } else {
        setRescheduleError(data.error || "Error al reagendar el turno");
      }
    } catch {
      setRescheduleError("Error de conexión al reagendar el turno");
    } finally {
      setRescheduling(false);
    }
  };

  const openFichaDialog = (apt: Appointment) => {
    setFichaAppointment(apt);
    setFichaDialogOpen(true);
  };

  // === Activar slot como Disponible ===
  // El profesional hace click en un slot "schedule" (naranja) → se activa
  // como "available" (verde) creando un override type="extra".
  // Esto lo hace visible para el admin en la Agenda Central.
  const handleActivateSlot = async (dateStr: string, time: string, dayOfWeek: number) => {
    if (!professionalId) return;
    // NO permitir activar slots pasados
    if (isSlotInPast(dateStr, time)) {
      toast.error("No se puede activar un slot que ya pasó");
      return;
    }
    // Calcular endTime según slotDuration y modality de la FRANJA ESPECÍFICA
    // que contiene este slot (FIX: múltiples franjas por día).
    // Antes usábamos .find() por dayOfWeek y tomábamos la primera franja,
    // lo cual daba slotDuration/modality incorrectos para slots de franjas
    // secundarias (ej: tarde si la primera franja era la mañana).
    const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);
    const owningSchedule = daySchedules.find(
      (s) => time >= s.startTime && time < s.endTime
    ) || daySchedules[0]; // fallback a la primera franja del día
    const dur = owningSchedule?.slotDuration || 45;
    const modality = owningSchedule?.modality || "ambas";
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + dur;
    const endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

    setActivatingSlot(true);
    try {
      const res = await fetch(`/api/professionals/${professionalId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          type: "extra",
          startTime: time,
          endTime: endTime,
          slotDuration: dur,
          modality: modality,
          reason: "Slot activado desde grilla",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al activar slot");
        return;
      }
      toast.success(`Slot ${time}–${endTime} activado como Disponible`);
      // Recargar overrides de la semana actual (con from/to)
      const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
      const weekEnd = addDays(currentWeekStart, 6);
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");
      const overRes = await fetch(`/api/professionals/${professionalId}/overrides?from=${weekStartStr}&to=${weekEndStr}`).then((r) => r.json());
      setOverrides(Array.isArray(overRes) ? overRes : []);
    } catch (err) {
      console.error("Error activating slot:", err);
      toast.error("Error de conexión al activar slot");
    } finally {
      setActivatingSlot(false);
    }
  };

  // === Desactivar slot (volver de Disponible a schedule) ===
  const handleDeactivateSlot = async (dateStr: string, time: string) => {
    if (!professionalId) return;
    if (isSlotInPast(dateStr, time)) {
      toast.error("No se puede desactivar un slot que ya pasó");
      return;
    }
    // Buscar el override type="extra" que coincide
    const existing = overrides.find((o) =>
      o.date === dateStr && o.type === "extra" && o.startTime === time
    );
    if (!existing?.id) {
      toast.error("No se encontró el slot activado");
      return;
    }
    setActivatingSlot(true);
    try {
      const res = await fetch(
        `/api/professionals/${professionalId}/overrides?overrideId=${existing.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al desactivar slot");
        return;
      }
      toast.success(`Slot ${time} desactivado`);
      // Recargar overrides de la semana actual (con from/to)
      const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
      const weekEnd = addDays(currentWeekStart, 6);
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");
      const overRes = await fetch(`/api/professionals/${professionalId}/overrides?from=${weekStartStr}&to=${weekEndStr}`).then((r) => r.json());
      setOverrides(Array.isArray(overRes) ? overRes : []);
    } catch (err) {
      console.error("Error deactivating slot:", err);
      toast.error("Error de conexión al desactivar slot");
    } finally {
      setActivatingSlot(false);
    }
  };

  // === Abrir modal de cancelación con selector de origen ===
  // Reemplaza el confirm() nativo por un modal React que pide:
  // 1. Quién solicita la cancelación (paciente o profesional)
  // 2. Motivo opcional
  // El profesional debe especificar el origen para que el admin pueda
  // distinguir visualmente en la agenda central quién canceló.
  const handleCancelFromFicha = () => {
    if (!fichaAppointment) return;
    // Abrir el modal de cancelación en vez del confirm()
    setCancelSourceDialog({ open: true, source: "", reason: "" });
  };

  // === Confirmar cancelación con origen y motivo ===
  // Se ejecuta cuando el profesional confirma en el modal selector.
  const handleConfirmCancellationFromFicha = async () => {
    if (!fichaAppointment) return;
    const { source, reason } = cancelSourceDialog;
    if (!source) {
      toast.error("Seleccioná quién solicita la cancelación");
      return;
    }
    setCancelling(true);
    try {
      // Mapear source → status:
      //   "patient"      → cancelled_by_patient (el paciente pidió cancelar)
      //   "professional" → cancelled_by_professional (el profesional canceló,
      //                    se envía email automático al paciente)
      const newStatus = source === "patient" ? "cancelled_by_patient" : "cancelled_by_professional";

      const res = await fetch(`/api/appointments/${fichaAppointment.id}`, {
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
      // Feedback según origen y si se envió email al paciente
      const sourceLabel = source === "patient" ? "paciente" : "profesional";
      if (source === "professional" && data.emailSent?.patient) {
        toast.success(`Turno cancelado por ${sourceLabel}. Se envió email al paciente.`);
      } else if (source === "professional") {
        toast.warning(`Turno cancelado por ${sourceLabel}. No se pudo enviar email — recomendamos contactar al paciente por WhatsApp.`);
      } else {
        toast.success(`Turno cancelado por ${sourceLabel}.`);
      }
      // Actualizar estado local del appointment
      setAppointments((prev) =>
        prev.map((a) => (a.id === fichaAppointment.id ? { ...a, status: newStatus } : a))
      );
      setCancelSourceDialog({ open: false, source: "", reason: "" });
      setFichaDialogOpen(false);
    } catch (err) {
      console.error("Error cancelling from ficha:", err);
      toast.error("Error de conexión al cancelar el turno");
    } finally {
      setCancelling(false);
    }
  };

  // === Reprogramar turno desde la ficha rápida (profesional) ===
  // Cambia el status a "rescheduled" y guarda el motivo en notes.
  // El turno NO se cancela, queda en estado intermedio esperando que el
  // profesional coordine nueva fecha con el paciente (lo hace por su cuenta).
  // Paridad 1:1 con el admin (commit 63361b5).
  const handleRescheduleFromFicha = async () => {
    if (!fichaAppointment) return;
    if (rescheduleReason.trim().length < 3) {
      toast.error("El motivo debe tener al menos 3 caracteres");
      return;
    }
    setRescheduling(true);
    try {
      const res = await fetch(`/api/appointments/${fichaAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rescheduled",
          notes: `[Reprogramado por profesional] ${rescheduleReason.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al reprogramar el turno");
        return;
      }
      toast.success(`Turno marcado como "Reprogramado". Coordiná nueva fecha con el paciente.`);
      // Actualizar estado local del appointment
      setAppointments((prev) =>
        prev.map((a) => (a.id === fichaAppointment.id ? { ...a, status: "rescheduled", notes: `[Reprogramado por profesional] ${rescheduleReason.trim()}` } : a))
      );
      setRescheduleMode(false);
      setRescheduleReason("");
      setFichaDialogOpen(false);
    } catch (err) {
      console.error("Error rescheduling from ficha:", err);
      toast.error("Error de conexión al reprogramar el turno");
    } finally {
      setRescheduling(false);
    }
  };

  // Use prop professionalId if provided, otherwise use fetched one
  const professionalId = propProfessionalId || fetchedProfessionalId;

  // === Eje Y ESTANDARIZADO en intervalos de 15 minutos ===
  const timeSlots = useMemo(() => {
    return generateStandardizedTimeSlots(schedules);
  }, [schedules]);

  // === gridStartMinutes: la hora mínima visible de la grilla en minutos ===
  // Se usa para calcular posiciones absolutas de slots en el CSS Grid.
  // Ej: si timeSlots[0] = "08:00", gridStartMinutes = 480.
  const gridStartMinutes = useMemo(() => {
    if (timeSlots.length === 0) return 0;
    return timeToMin(timeSlots[0]);
  }, [timeSlots]);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Get days of the current week
  const weekDays = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Default mobile day: today if in this week, else first day
  const defaultMobileDay = useMemo(() => {
    const today = weekDays.find((d) => isToday(d));
    return today || weekDays[0];
  }, [weekDays]);

  // The actual displayed mobile day: user selection or default
  const selectedMobileDay = userSelectedDay || defaultMobileDay;

  // Load professional ID if not provided via prop
  useEffect(() => {
    if (propProfessionalId) return;
    if (session?.user) {
      const userId = (session.user as { id: string }).id;
      fetch("/api/professionals?all=true&includeUnverified=true")
        .then((res) => res.json())
        .then((data) => {
          const profs = Array.isArray(data) ? data : [];
          const prof = profs.find((p: { userId: string }) => p.userId === userId);
          if (prof) {
            setFetchedProfessionalId(prof.id);
          }
        })
        .catch(() => {});
    }
  }, [session, propProfessionalId]);

  // Load schedule + overrides data
  // CRÍTICO: este useEffect depende de `currentWeekStart` para que al cambiar
  // de semana se recarguen los overrides de esa semana específica.
  // Sin esta dependencia, los overrides activados en una semana no aparecen
  // al volver a esa semana después de navegar.
  useEffect(() => {
    if (professionalId) {
      // Calcular rango de fechas de la semana actual (Lun-Dom)
      const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
      const weekEnd = addDays(currentWeekStart, 6);
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      Promise.all([
        fetch(`/api/professionals/${professionalId}/schedule`).then((r) =>
          r.json()
        ),
        fetch(`/api/professionals/${professionalId}/overrides?from=${weekStartStr}&to=${weekEndStr}`).then((r) =>
          r.json()
        ),
      ])
        .then(([scheduleData, overridesData]) => {
          console.log(`[AGENDA LOAD] professionalId=${professionalId} weekStart=${weekStartStr}`);
          console.log(`[AGENDA LOAD] Schedules recibidos:`, scheduleData);
          console.log(`[AGENDA LOAD] Overrides recibidos:`, Array.isArray(overridesData) ? `${overridesData.length} overrides` : overridesData);
          setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
          setOverrides(Array.isArray(overridesData) ? overridesData : []);
        })
        .catch(() => {});
    }
  }, [professionalId, currentWeekStart]);

  // Load appointments — filtrar por professionalId cuando se pasa como prop (modo admin)
  useEffect(() => {
    if (!professionalId) return;
    const url = propProfessionalId
      ? `/api/appointments?professionalId=${professionalId}`
      : "/api/appointments";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setAppointments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Error al cargar turnos");
        setLoading(false);
      });
  }, [professionalId, currentWeekStart, propProfessionalId]);

  // Week navigation
  const goToPrevWeek = () =>
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
  const goToNextWeek = () =>
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  const goToCurrentWeek = () =>
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // === Acciones masivas: Copiar día ===
  const handleCopyDay = async () => {
    if (!professionalId) return;
    if (copyFromDay === copyToDay) {
      toast.error("El día origen y destino deben ser distintos");
      return;
    }
    setCopying(true);
    try {
      const res = await fetch(`/api/professionals/${professionalId}/schedule/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy-day",
          fromDay: parseInt(copyFromDay, 10),
          toDay: parseInt(copyToDay, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al copiar agenda");
        return;
      }
      toast.success(data.message || `Día copiado correctamente (${data.created} bloques)`);
      setCopyDialogOpen(false);
      // Recargar schedules y overrides (con filtro de semana para overrides)
      const ws = format(currentWeekStart, "yyyy-MM-dd");
      const we = format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
      const [schedRes, overRes] = await Promise.all([
        fetch(`/api/professionals/${professionalId}/schedule`).then((r) => r.json()),
        fetch(`/api/professionals/${professionalId}/overrides?from=${ws}&to=${we}`).then((r) => r.json()),
      ]);
      setSchedules(Array.isArray(schedRes) ? schedRes : []);
      setOverrides(Array.isArray(overRes) ? overRes : []);
    } catch (err) {
      console.error("Error copying day:", err);
      toast.error("Error de conexión al copiar agenda");
    } finally {
      setCopying(false);
    }
  };

  // === Acciones masivas: Duplicar plantilla semanal ===
  const handleDuplicateTemplate = async () => {
    if (!professionalId) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/professionals/${professionalId}/schedule/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate-template" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al duplicar plantilla");
        return;
      }
      toast.success(data.message || "Plantilla replicada para la próxima semana");
      setDuplicateDialogOpen(false);
      // Recargar overrides de la semana actual (con from/to)
      const ws = format(currentWeekStart, "yyyy-MM-dd");
      const we = format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
      const overRes = await fetch(`/api/professionals/${professionalId}/overrides?from=${ws}&to=${we}`).then((r) => r.json());
      setOverrides(Array.isArray(overRes) ? overRes : []);
    } catch (err) {
      console.error("Error duplicating template:", err);
      toast.error("Error de conexión al duplicar plantilla");
    } finally {
      setDuplicating(false);
    }
  };

  // Check if a time slot is within the professional's schedule for a given day
  const isSlotInSchedule = useCallback(
    (dayOfWeek: number, time: string): boolean => {
      const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);
      if (daySchedules.length === 0) return false;

      return daySchedules.some((s) => {
        return time >= s.startTime && time < s.endTime;
      });
    },
    [schedules]
  );

  // Get the modality for a specific available cell
  const getModalityForCell = useCallback(
    (dateStr: string, dayOfWeek: number, time: string): string | null => {
      // First check weekly schedule
      const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);
      const scheduleMatch = daySchedules.find(
        (s) => time >= s.startTime && time < s.endTime
      );
      if (scheduleMatch) return scheduleMatch.modality;

      // Then check extra overrides for this specific date
      const extraMatch = overrides.find((o) => {
        if (o.date !== dateStr || o.type !== "extra") return false;
        if (!o.startTime || !o.endTime) return false;
        return time >= o.startTime && time < o.endTime;
      });
      if (extraMatch?.modality) return extraMatch.modality;

      return null;
    },
    [schedules, overrides]
  );

  // Check if a date is blocked by an override
  const isDateBlocked = useCallback(
    (dateStr: string): boolean => {
      return overrides.some(
        (o) =>
          o.date === dateStr &&
          o.type === "block" &&
          !o.startTime &&
          !o.endTime
      );
    },
    [overrides]
  );

  // Check if a specific time slot is blocked
  const isTimeSlotBlocked = useCallback(
    (dateStr: string, time: string): boolean => {
      return overrides.some((o) => {
        if (o.date !== dateStr || o.type !== "block") return false;
        if (!o.startTime || !o.endTime) return false;
        return time >= o.startTime && time < o.endTime;
      });
    },
    [overrides]
  );

  // Get appointment for a specific cell
  //
  // IMPORTANTE: el grid de la agenda visual genera slots fijos de 30 min
  // (07:00, 07:30, 08:00, ..., 22:00). Pero los turnos pueden empezar en
  // minutos no múltiplos de 30 (ej: 18:45 con slotDuration=15 o 45 min).
  // Para que esos turnos aparezcan en la agenda, hacemos "snap down":
  // el appointment se muestra en el slot más cercano ANTERIOR a su hora
  // real de inicio. Ej: turno a las 18:45 → se muestra en el slot 18:30,
  // pero el card muestra "18:45 a 19:30 hs" como hora real.
  //
  // El card se renderiza UNA sola vez (en el slot snap-down), no se
  // duplica en slots posteriores del mismo rango. Esto evita que un
  // turno de 45 min ocupe 2 visualmente, pero si el slotDuration es
  // mayor a 30 min puede haber espacio visual "vacío" entre el card y
  // el siguiente turno — es un trade-off aceptable por ahora.
  //
  // Usamos `visibleAppointments` (que excluye cancelled_by_patient y
  // cancelled) en vez de `appointments` (que tiene todo). Así la grilla
  // no dibuja los turnos cancelados por paciente → el slot queda LIBRE.
  const getAppointmentForCell = useCallback(
    (dateStr: string, time: string): Appointment | undefined => {
      // Con eje Y estandarizado a 15 min, el appointment se renderiza en su
      // hora exacta de inicio (no snap-down). El rowSpan hace que visualmente
      // abarque las filas inferiores correspondientes a su duración.
      return visibleAppointments.find((a) => {
        if (a.date !== dateStr) return false;
        return a.time === time;
      });
    },
    [visibleAppointments]
  );

  // Determine cell state
  // === FLUJO CON EJE Y ESTANDARIZADO A 15 MIN ===
  // - "schedule": la celda es el INICIO de un slot del schedule (muestra modalidad)
  // - "available": la celda es el INICIO de un slot activado (verde "Disponible")
  // - "booked": la celda es el INICIO de un appointment (card del turno)
  // - "outside": fuera del schedule o es sub-intervalo cubierto por rowSpan superior
  //
  // IMPORTANTE: con el eje Y de 15 min, una celda a las 14:15 que está dentro
  // de un slot de 45 min empezado a las 14:00 NO debe renderizarse como
  // "schedule" o "available" — está cubierta por el rowSpan de la celda 14:00.
  // Devolvemos "outside" para que no renderice contenido (la celda se "oculta"
  // porque la superior usa rowSpan).
  const getCellState = useCallback(
    (
      dateStr: string,
      time: string,
      dayOfWeek: number
    ): "schedule" | "available" | "booked" | "outside" => {
      const apt = getAppointmentForCell(dateStr, time);
      if (apt && apt.status !== "cancelled_by_patient" && apt.status !== "cancelled") {
        return "booked";
      }

      // Encontrar TODOS los schedules de este día (FIX: múltiples franjas por día)
      const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);

      // Verificar si la celda es el INICIO de un slot activado (override extra)
      const activatedSlot = overrides.find((o) => {
        if (o.date !== dateStr || o.type !== "extra") return false;
        if (!o.startTime || !o.endTime) return false;
        // Solo renderizar en el startTime exacto del override
        return time === o.startTime;
      });
      if (activatedSlot) return "available";

      // Verificar si la celda es el INICIO de un slot de CUALQUIERA de las
      // franjas del día. Iteramos todas y nos quedamos con la primera que
      // matchee (rara vez habrá más de una, porque las franjas no se solapan).
      // FIX: antes usábamos .find() y solo checkeábamos la primera franja.
      for (const sch of daySchedules) {
        const allSlots = generateTimeSlotsForSchedule(
          sch.startTime,
          sch.endTime,
          sch.slotDuration
        );
        if (allSlots.includes(time) && isSlotInSchedule(dayOfWeek, time)) {
          return "schedule";
        }
      }

      return "outside";
    },
    [getAppointmentForCell, isSlotInSchedule, overrides, schedules]
  );

  // Handle status update for appointments (Atendido / Ausente)
  const handleStatusUpdate = useCallback(
    async (id: string, status: string) => {
      try {
        const res = await fetch(`/api/appointments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          setAppointments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status } : a))
          );
          toast.success(
            status === "completed"
              ? "Turno marcado como Atendido"
              : status === "absent"
                ? "Turno marcado como Ausente"
                : "Estado actualizado"
          );
        } else {
          toast.error("Error al actualizar turno");
        }
      } catch {
        toast.error("Error al actualizar turno");
      }
    },
    []
  );

  // Format week range for header
  const weekRangeText = useMemo(() => {
    const start = format(currentWeekStart, "d MMM", { locale: es });
    const end = format(
      endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
      "d MMM yyyy",
      { locale: es }
    );
    return `${start} - ${end}`;
  }, [currentWeekStart]);

  // Render modality icon for an available cell
  const renderModalityIndicator = (modality: string | null) => {
    if (!modality) return null;
    const display = MODALITY_CELL_DISPLAY[modality];
    if (!display) return null;
    return (
      <div
        className={`flex items-center justify-center w-full ${display.colorClass}`}
        title={display.label}
      >
        {display.label}
      </div>
    );
  };

  // Render a single appointment block
  const renderAppointment = (apt: Appointment) => {
    const colors = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
    const modalityInfo = apt.modality ? MODALITY_BADGE[apt.modality] : null;
    const ModIcon = modalityInfo?.icon;
    // Rango horario real del appointment (no el slot snap-down del grid).
    // Si el turno empieza a las 18:45 y dura 45 min, mostramos "18:45-19:30"
    // aunque el card esté renderizado en el slot 18:30 del grid.
    const timeDisplay = apt.timeEnd
      ? `${apt.time}–${apt.timeEnd}`
      : apt.time;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        onClick={() => openFichaDialog(apt)}
        className={`${colors.bg} ${colors.text} ${colors.border} border rounded-md px-2 py-1 text-xs cursor-pointer overflow-hidden hover:shadow-md transition-shadow`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold truncate">{apt.patient.user.name}</span>
          {ModIcon && <ModIcon className="w-3 h-3 flex-shrink-0 opacity-60" />}
        </div>
        <div className="text-[10px] opacity-70 mt-0.5 font-mono font-bold">
          {timeDisplay}
        </div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span
            className={`inline-flex items-center px-1 py-0 rounded text-[10px] font-medium ${colors.badge} border`}
          >
            {STATUS_LABELS[apt.status] || apt.status}
          </span>
          {modalityInfo && (
            <span
              className={`inline-flex items-center gap-0.5 px-1 py-0 rounded text-[10px] font-medium border ${modalityInfo.color}`}
            >
              {modalityInfo.label}
            </span>
          )}
        </div>
        {apt.status === "confirmed" && isSlotInPast(apt.date, apt.time) && (
          <div className="flex gap-1 mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate(apt.id, "completed");
              }}
              className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded text-[9px] font-medium transition-colors"
            >
              Atendido
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate(apt.id, "absent");
              }}
              className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded text-[9px] font-medium transition-colors"
            >
              Ausente
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  // Desktop weekly grid
  const renderDesktopGrid = () => (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header: day names and dates */}
        <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-teal-100">
          <div className="p-2 text-xs text-teal-400 text-center" />
          {weekDays.map((day, i) => {
            const isCurrentDay = isToday(day);
            return (
              <div
                key={i}
                className={`p-2 text-center border-l border-teal-50 ${
                  isCurrentDay ? "bg-teal-50" : ""
                }`}
              >
                <p
                  className={`text-xs font-medium ${
                    isCurrentDay ? "text-teal-700" : "text-teal-500"
                  }`}
                >
                  {DAY_LABELS[i]}
                </p>
                <p
                  className={`text-sm font-bold ${
                    isCurrentDay
                      ? "w-7 h-7 rounded-full flex items-center justify-center mx-auto bg-teal-600 text-white"
                      : "text-teal-800"
                  }`}
                >
                  {format(day, "d")}
                </p>
              </div>
            );
          })}
        </div>

        {/* === Time rows — CSS Grid por coordenadas === */}
        {/* FIX: reemplazado <table>/<td rowSpan> por CSS Grid puro.
            El problema con <table> era que omitir <td> en filas cubiertas por
            rowSpan desplazaba las columnas horizontalmente. Con CSS Grid,
            cada slot se posiciona explícitamente con gridRow/gridColumn sin
            afectar a las demás celdas. */}
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          <div
            className="grid relative w-full"
            style={{
              gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)`,
              gridAutoRows: "28px",
            }}
          >
            {/* === CAPA 1: Celdas de fondo (todas las filas × columnas) === */}
            {/* Siempre se renderizan TODAS las celdas para mantener la grilla visual.
                Los slots se superponen en la CAPA 2. */}
            {timeSlots.map((time, rowIdx) => (
              <Fragment key={`bg-${time}`}>
                {/* Time label (columna 1) */}
                <div
                  className="p-1 text-[11px] text-teal-400 text-right pr-2 border-r border-teal-50 flex items-start justify-end pt-1.5"
                  style={{ gridRow: rowIdx + 1, gridColumn: 1 }}
                >
                  {time}
                </div>
                {/* Day background cells (columnas 2-N) */}
                {weekDays.map((day, dayIdx) => {
                  const isCurrentDay = isToday(day);
                  return (
                    <div
                      key={`bg-${format(day, "yyyy-MM-dd")}-${time}`}
                      className={`border-l border-b border-teal-50/50 ${isCurrentDay ? "bg-teal-50/20" : ""}`}
                      style={{ gridRow: rowIdx + 1, gridColumn: dayIdx + 2 }}
                    />
                  );
                })}
              </Fragment>
            ))}

            {/* === CAPA 2: Slots posicionados por coordenadas directas === */}
            {/* FIX CRÍTICO: NO iterar celda por celda evaluando % (módulo).
                En su lugar, iterar el ARRAY DE SLOTS real generado por
                generateTimeSlotsForSchedule y posicionar cada slot por su
                coordenada absoluta en el CSS Grid.
                Esto elimina el "efecto 14:15" donde 840 % 45 = 30 ≠ 0
                descartaba las 14:00 como inicio de slot. */}
            {/* APLANAR el array de arrays: weekDays.map devuelve un array por día,
                pero CSS Grid necesita elementos planos. Usamos flat() para evitar
                que React no renderice correctamente los elementos anidados. */}
            {weekDays.flatMap((day, dayIdx) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayOfWeek = dayIdx + 1;
              const isCurrentDay = isToday(day);
              const colIndex = dayIdx + 2;

              // === FIX: .filter() en vez de .find() para soportar MÚLTIPLES
              // franjas horarias por día (ej: Jueves 09-13 Online + 16-17 Presencial).
              // Antes usábamos .find() que solo tomaba la primera franja y
              // dejaba los demás bloques del día vacíos en la grilla. ===
              const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);

              // 1. Generar slots de TODAS las franjas del día (contiguos, sin snapping)
              // Para cada franja, generamos sus slots y los acumulamos en un array plano.
              const scheduleSlots: string[] = [];
              for (const sch of daySchedules) {
                const dur = sch.slotDuration || 45;
                const slots = generateTimeSlotsForSchedule(sch.startTime, sch.endTime, dur);
                // Evitar duplicados por las dudas (no debería pasar si las franjas no se solapan)
                for (const s of slots) {
                  if (!scheduleSlots.includes(s)) scheduleSlots.push(s);
                }
              }

              // === LOGS DE DIAGNÓSTICO ===
              if (daySchedules.length > 0) {
                console.log(`[AGENDA DEBUG] ${dateStr} (dayIdx=${dayIdx}, dayOfWeek=${dayOfWeek})`, {
                  schedulesCount: daySchedules.length,
                  schedules: daySchedules.map(s => ({ startTime: s.startTime, endTime: s.endTime, slotDuration: s.slotDuration, modality: s.modality })),
                  generatedSlots: scheduleSlots,
                  overridesForDay: overrides.filter(o => o.date === dateStr).length,
                  blockOverridesForDay: overrides.filter(o => o.date === dateStr && o.type === "block"),
                });
              } else {
                console.warn(`[AGENDA DEBUG] ${dateStr} (dayOfWeek=${dayOfWeek}) — NO schedule found for this day.`);
                console.table(schedules.map(s => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, slotDuration: s.slotDuration })));
              }

              // 2. Generar slots de overrides type="extra" (disponibilidad activada)
              const extraOverrides = overrides.filter((o) => {
                if (o.date !== dateStr || o.type !== "extra") return false;
                if (!o.startTime || !o.endTime) return false;
                return true;
              });

              // 3. Collect all slot items to render: schedule slots, extra overrides, appointments
              type SlotItem = {
                time: string;
                duration: number;
                type: "schedule" | "available" | "booked";
                modality: string | null;
                apt?: typeof visibleAppointments[0];
              };

              const slotItems: SlotItem[] = [];

              // Helper local: obtener slotDuration y modality de la franja que
              // contiene este tiempo (para soportar múltiples franjas por día)
              const getOwningSchedule = (slotTime: string) => {
                return daySchedules.find((s) => slotTime >= s.startTime && slotTime < s.endTime);
              };

              // Schedule slots (no activados, no con appointment)
              for (const slotTime of scheduleSlots) {
                // Buscar la franja específica que contiene este slot
                const owningSchedule = getOwningSchedule(slotTime);
                const slotDuration = owningSchedule?.slotDuration || 45;

                // Check if there's an appointment at this exact time
                const apt = visibleAppointments.find((a) => a.date === dateStr && a.time === slotTime);
                if (apt && apt.status !== "cancelled_by_patient" && apt.status !== "cancelled") {
                  slotItems.push({ time: slotTime, duration: slotDuration, type: "booked", modality: null, apt });
                } else {
                  // Check if this slot is activated by an extra override
                  const isActivated = extraOverrides.some((o) => {
                    if (!o.startTime) return false;
                    const oStart = timeToMin(o.startTime);
                    const oEnd = o.endTime ? timeToMin(o.endTime) : oStart + slotDuration;
                    const sMin = timeToMin(slotTime);
                    return sMin >= oStart && sMin < oEnd;
                  });
                  if (isActivated) {
                    const modality = getModalityForCell(dateStr, dayOfWeek, slotTime);
                    slotItems.push({ time: slotTime, duration: slotDuration, type: "available", modality });
                  } else {
                    const modality = getModalityForCell(dateStr, dayOfWeek, slotTime);
                    slotItems.push({ time: slotTime, duration: slotDuration, type: "schedule", modality });
                  }
                }
              }

              // Extra override slots that DON'T align with schedule (extra availability outside schedule)
              for (const o of extraOverrides) {
                if (!o.startTime || !o.endTime) continue;
                const oDuration = o.slotDuration || 45;
                const extraSlots = generateTimeSlotsForSchedule(o.startTime, o.endTime, oDuration);
                for (const slotTime of extraSlots) {
                  // Skip if already in scheduleSlots (avoid duplicates)
                  if (scheduleSlots.includes(slotTime)) continue;
                  const apt = visibleAppointments.find((a) => a.date === dateStr && a.time === slotTime);
                  if (apt && apt.status !== "cancelled_by_patient" && apt.status !== "cancelled") {
                    slotItems.push({ time: slotTime, duration: oDuration, type: "booked", modality: null, apt });
                  } else {
                    const modality = o.modality || "ambas";
                    slotItems.push({ time: slotTime, duration: oDuration, type: "available", modality });
                  }
                }
              }

              return slotItems.map((slot) => {
                const { rowStart, span } = getSlotGridPosition(slot.time, slot.duration, gridStartMinutes);
                const slotIsPast = isSlotInPast(dateStr, slot.time);

                // === LOG DE RENDERIZADO ===
                if (slot.time === "15:30") {
                  console.log(`[RENDER DEBUG] Slot 15:30 → gridRow: ${rowStart} / span ${span}, gridColumn: ${colIndex}, type: ${slot.type}, gridStartMinutes: ${gridStartMinutes}, totalRows: ${timeSlots.length}`);
                }
                const slotEnd = (() => {
                  const [h, m] = slot.time.split(":").map(Number);
                  const t = h * 60 + m + slot.duration;
                  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
                })();

                let slotClass = "p-0.5 transition-colors z-10 h-full flex flex-col justify-stretch ";
                if (slot.type === "schedule") slotClass += "bg-amber-50 ";
                else if (slot.type === "available") slotClass += "bg-emerald-50 ";
                else if (slot.type === "booked") slotClass += "bg-white ";
                if (slotIsPast) slotClass += "opacity-50 ";
                if (isCurrentDay) slotClass += "border-l-2 border-l-teal-300 ";

                return (
                  <div
                    key={`slot-${dateStr}-${slot.time}`}
                    className={slotClass}
                    style={{
                      gridRow: `${rowStart} / span ${span}`,
                      gridColumn: colIndex,
                    }}
                    onClick={(slot.type === "schedule" && !slotIsPast) ? () => handleActivateSlot(dateStr, slot.time, dayOfWeek) : (slot.type === "available" && !slotIsPast) ? () => handleDeactivateSlot(dateStr, slot.time) : undefined}
                  >
                    {slot.type === "booked" && slot.apt && renderAppointment(slot.apt)}
                    {slot.type === "schedule" && (
                      <div
                        className="flex items-center justify-center w-full rounded text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors flex-1 min-h-0"
                        title={`${MODALITY_CELL_DISPLAY[slot.modality || "ambas"]?.label || "P|OL"} — click para activar como Disponible ${slot.time}–${slotEnd} hs`}
                      >
                        {MODALITY_CELL_DISPLAY[slot.modality || "ambas"]?.label || "P|OL"}
                      </div>
                    )}
                    {slot.type === "available" && (
                      <div
                        className="flex items-center justify-center gap-0.5 w-full rounded text-[10px] font-medium bg-emerald-100 border border-emerald-200 text-emerald-700 hover:bg-emerald-200 transition-colors flex-1 min-h-0"
                        title={`Disponible (${MODALITY_CELL_DISPLAY[slot.modality || "ambas"]?.fullLabel || "Híbrida"}) ${slot.time}–${slotEnd} hs — click para desactivar`}
                      >
                        <span>{MODALITY_CELL_DISPLAY[slot.modality || "ambas"]?.emoji || "🔄"}</span>
                        <span>Disponible</span>
                        <span className="text-[8px] opacity-75">({MODALITY_CELL_DISPLAY[slot.modality || "ambas"]?.label || "P|OL"})</span>
                      </div>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile: single day view
  const renderMobileDayView = () => {
    const dateStr = format(selectedMobileDay, "yyyy-MM-dd");
    const dayIdx = weekDays.findIndex((d) => isSameDay(d, selectedMobileDay));
    const dayOfWeek = dayIdx + 1;

    return (
      <div>
        {/* Day selector tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
          {weekDays.map((day, i) => {
            const isCurrentDay = isToday(day);
            const isSelected = isSameDay(day, selectedMobileDay);
            return (
              <button
                key={i}
                onClick={() => setUserSelectedDay(day)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-center min-w-[52px] transition-all ${
                  isSelected
                    ? "bg-teal-600 text-white"
                    : isCurrentDay
                      ? "bg-teal-50 text-teal-700 border border-teal-200"
                      : "bg-gray-50 text-teal-600 hover:bg-teal-50"
                }`}
              >
                <p className="text-[10px] font-medium">{DAY_LABELS[i]}</p>
                <p className="text-sm font-bold">{format(day, "d")}</p>
              </button>
            );
          })}
        </div>

        {/* Time slots for selected day */}
        <div className="space-y-0.5">
          {timeSlots.map((time) => {
            const state = getCellState(dateStr, time, dayOfWeek);
            const apt = getAppointmentForCell(dateStr, time);
            const modality =
              (state === "schedule" || state === "available")
                ? getModalityForCell(dateStr, dayOfWeek, time)
                : null;
            const modalityDisplay = modality
              ? MODALITY_CELL_DISPLAY[modality]
              : null;

            let rowClass =
              "flex items-start min-h-[36px] rounded-md px-2 py-1 transition-colors ";

            if (state === "outside") {
              rowClass += "bg-red-50/20 ";
            } else if (state === "schedule") {
              rowClass += "bg-amber-50/30 ";
            } else if (state === "available") {
              rowClass += "bg-emerald-50/50 ";
            } else if (state === "booked") {
              rowClass += "bg-white ";
            }

            const slotIsPastMobile = isSlotInPast(dateStr, time);

            return (
              <div
                key={time}
                className={`${rowClass} ${slotIsPastMobile ? "opacity-50" : ""}`}
              >
                <span className="text-[11px] text-teal-400 w-12 flex-shrink-0 pt-0.5">
                  {time}
                </span>
                <div className="flex-1">
                  {state === "booked" && apt && (
                    <div className="ml-2">{renderAppointment(apt)}</div>
                  )}
                  {state === "schedule" && !slotIsPastMobile && (
                    <div className="ml-2 flex-1">
                      <button
                        onClick={() => handleActivateSlot(dateStr, time, dayOfWeek)}
                        className="flex items-center justify-center w-full bg-amber-50 border border-amber-200 text-amber-600 rounded-lg py-2 text-xs font-medium hover:bg-amber-100 transition-colors"
                      >
                        {modalityDisplay?.label || "P|OL"}
                      </button>
                    </div>
                  )}
                  {state === "available" && !slotIsPastMobile && (
                    <div className="ml-2 flex-1">
                      <button
                        onClick={() => handleDeactivateSlot(dateStr, time)}
                        className="flex items-center justify-center gap-1 w-full bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg py-2 text-xs font-medium hover:bg-emerald-200 transition-colors"
                      >
                        <span>{MODALITY_CELL_DISPLAY[modality || "ambas"]?.emoji || "🔄"}</span>
                        Disponible ({MODALITY_CELL_DISPLAY[modality || "ambas"]?.label || "P|OL"})
                      </button>
                    </div>
                  )}
                  {state === "schedule" && slotIsPastMobile && (
                    <div className="ml-2 flex-1">
                      <div className="flex items-center justify-center w-full bg-amber-50/50 border border-amber-200/50 text-amber-500 rounded-lg py-2 text-xs font-medium">
                        {modalityDisplay?.label || "P|OL"}
                      </div>
                    </div>
                  )}
                  {state === "available" && slotIsPastMobile && (
                    <div className="ml-2 flex-1">
                      <div className="flex items-center justify-center gap-1 w-full bg-emerald-50/50 border border-emerald-200/50 text-emerald-500 rounded-lg py-2 text-xs font-medium">
                        <span>{MODALITY_CELL_DISPLAY[modality || "ambas"]?.emoji || "🔄"}</span>
                        Disponible ({MODALITY_CELL_DISPLAY[modality || "ambas"]?.label || "P|OL"})
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Stats for the week
  const weekStats = useMemo(() => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekAppts = appointments.filter((a) => {
      const aptDate = parseISO(a.date);
      return aptDate >= currentWeekStart && aptDate <= weekEnd;
    });
    return {
      total: weekAppts.length,
      pending: weekAppts.filter((a) => a.status === "pending").length,
      confirmed: weekAppts.filter((a) => a.status === "confirmed").length,
    };
  }, [appointments, currentWeekStart]);

  return (
    <div className="space-y-4">
      {/* Week navigation header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevWeek}
            className="border-teal-200 text-teal-600 hover:bg-teal-50 h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center min-w-[180px]">
            <p className="text-sm font-semibold text-teal-900 capitalize">
              {weekRangeText}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextWeek}
            className="border-teal-200 text-teal-600 hover:bg-teal-50 h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToCurrentWeek}
            className="border-teal-200 text-teal-600 hover:bg-teal-50 text-xs h-8"
          >
            <Calendar className="w-3 h-3 mr-1" />
            Hoy
          </Button>
          {/* === Acciones masivas === */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCopyDialogOpen(true)}
            className="border-teal-200 text-teal-600 hover:bg-teal-50 text-xs h-8"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copiar día
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateDialogOpen(true)}
            className="border-teal-200 text-teal-600 hover:bg-teal-50 text-xs h-8"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Duplicar semana
          </Button>
        </div>
      </div>

      {/* === Dialog: Copiar día === */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-teal-900 flex items-center gap-2">
              <Copy className="w-5 h-5 text-teal-600" />
              Copiar agenda a otro día
            </DialogTitle>
            <DialogDescription className="text-teal-600">
              Cloná la rutina de un día hacia otro. Los bloques existentes del día destino serán reemplazados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">Desde (día origen)</Label>
              <Select value={copyFromDay} onValueChange={setCopyFromDay}>
                <SelectTrigger className="border-teal-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Lunes</SelectItem>
                  <SelectItem value="2">Martes</SelectItem>
                  <SelectItem value="3">Miércoles</SelectItem>
                  <SelectItem value="4">Jueves</SelectItem>
                  <SelectItem value="5">Viernes</SelectItem>
                  <SelectItem value="6">Sábado</SelectItem>
                  <SelectItem value="0">Domingo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-teal-700 font-medium">Hacia (día destino)</Label>
              <Select value={copyToDay} onValueChange={setCopyToDay}>
                <SelectTrigger className="border-teal-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Lunes</SelectItem>
                  <SelectItem value="2">Martes</SelectItem>
                  <SelectItem value="3">Miércoles</SelectItem>
                  <SelectItem value="4">Jueves</SelectItem>
                  <SelectItem value="5">Viernes</SelectItem>
                  <SelectItem value="6">Sábado</SelectItem>
                  <SelectItem value="0">Domingo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cancelar</Button>
            <Button onClick={handleCopyDay} disabled={copying} className="bg-teal-600 hover:bg-teal-700 text-white">
              {copying ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Copiando...</> : <><Copy className="w-4 h-4 mr-1" /> Copiar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Dialog: Duplicar semana entrante === */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-teal-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-teal-600" />
              Confirmar semana entrante
            </DialogTitle>
            <DialogDescription className="text-teal-600">
              ¿Querés replicar tu estructura base para la próxima semana calendario?
              Se crearán bloques de disponibilidad explícitos (excepciones "extra") para cada día de la semana entrante.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cancelar</Button>
            <Button onClick={handleDuplicateTemplate} disabled={duplicating} className="bg-teal-600 hover:bg-teal-700 text-white">
              {duplicating ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Duplicando...</> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Week stats */}
      <div className="flex gap-3">
        <div className="flex items-center gap-1.5 text-xs text-teal-600 bg-teal-50 px-2.5 py-1.5 rounded-full">
          <Calendar className="w-3 h-3" />
          <span className="font-medium">{weekStats.total}</span> turnos
        </div>
        {weekStats.pending > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-full">
            <Clock className="w-3 h-3" />
            <span className="font-medium">{weekStats.pending}</span> pendientes
          </div>
        )}
        {weekStats.confirmed > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 px-2.5 py-1.5 rounded-full border border-teal-100">
            <CheckCircle2 className="w-3 h-3" />
            <span className="font-medium">{weekStats.confirmed}</span>{" "}
            confirmados
          </div>
        )}
      </div>

      {/* Calendar grid */}
      <Card className="border-teal-100">
        <CardContent className="p-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-8 bg-teal-50 animate-pulse rounded"
                />
              ))}
            </div>
          ) : isMobile ? (
            renderMobileDayView()
          ) : (
            renderDesktopGrid()
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-teal-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-200" />
          Disponible
        </div>
        <div className="flex items-center gap-1">
          <Monitor className="w-3 h-3 text-emerald-500/70" />
          Online
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-emerald-500/70" />
          Presencial / Híbrida
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-200" />
          Pendiente
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-teal-50 border border-teal-200" />
          Confirmado
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-50 border border-gray-200" />
          Atendido
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-50 border border-red-200" />
          Cancelado
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-orange-50 border border-orange-200" />
          Ausente
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
          Fuera de agenda
        </div>
      </div>

      {/* === Ficha rápida del paciente (paridad con admin) === */}
      <Dialog open={fichaDialogOpen} onOpenChange={setFichaDialogOpen}>
        <DialogContent className="max-w-md">
          {fichaAppointment && (() => {
            const apt = fichaAppointment;
            const isRescheduled = apt.status === "rescheduled";
            const statusLabel = apt.status === "confirmed" ? "Confirmado"
              : apt.status === "pending" ? "Pendiente"
              : apt.status === "rescheduled" ? "Reprogramado"
              : apt.status === "completed" ? "Atendido"
              : apt.status === "absent" ? "Ausente"
              : apt.status;
            const modalityLabel = apt.modality === "P" ? "P"
              : apt.modality === "OL" ? "OL"
              : apt.modality === "H" ? "H"
              : apt.modality === "ambas" ? "P|OL"
              : "—";
            const timeDisplay = apt.timeEnd ? `${apt.time}–${apt.timeEnd} hs` : `${apt.time} hs`;
            const patientName = apt.patient?.user?.name || "Paciente";
            const patientEmail = apt.patient?.user?.email || null;
            const patientPhone = apt.patient?.user?.phone || null;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-teal-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-600" /> Ficha del turno
                  </DialogTitle>
                  <DialogDescription className="text-teal-600">{timeDisplay}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  {/* Datos del turno */}
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-teal-900 font-bold">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <span className="capitalize">{(() => { try { return format(parseISO(apt.date), "EEEE d 'de' MMMM", { locale: es }); } catch { return apt.date; } })()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-teal-900 font-bold">
                      <Clock className="w-4 h-4 text-teal-600" />
                      <span>{timeDisplay}</span>
                      <Badge variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-700">{modalityLabel}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-teal-500">Estado:</span>
                      <Badge variant={isRescheduled ? "destructive" : apt.status === "confirmed" ? "default" : "outline"} className="text-xs">{statusLabel}</Badge>
                    </div>
                  </div>

                  {/* Alerta de Reprogramación */}
                  {isRescheduled && (
                    <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                        <p className="text-sm font-semibold text-orange-800">Reprogramado — Pendiente de acción</p>
                      </div>
                      {apt.notes && (
                        <div className="mt-2">
                          <p className="text-xs text-orange-600 font-medium mb-1">Notas:</p>
                          <p className="text-sm text-orange-800 bg-white rounded-md p-2 border border-orange-200">{apt.notes}</p>
                        </div>
                      )}
                      {!apt.notes && <p className="text-xs text-orange-500 italic">Sin notas de reprogramación.</p>}
                    </div>
                  )}

                  {/* Datos del paciente */}
                  <div className="space-y-2">
                    <p className="text-xs text-teal-500 font-medium uppercase tracking-wide">Paciente</p>
                    <p className="text-sm font-medium text-teal-900">{patientName}</p>
                    {(patientPhone || patientEmail) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        {patientPhone && (
                          <a href={`https://wa.me/${patientPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 hover:underline transition-colors">
                            <MessageCircle className="w-3 h-3 text-emerald-500" />{patientPhone}
                          </a>
                        )}
                        {patientEmail && (
                          <a href={`mailto:${patientEmail}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline transition-colors">
                            <Mail className="w-3 h-3 text-teal-500" />{patientEmail}
                          </a>
                        )}
                      </div>
                    )}
                    {!patientPhone && !patientEmail && <p className="text-xs text-teal-400 italic">Sin datos de contacto</p>}
                  </div>

                  {/* Notas generales (si no es rescheduled pero tiene notas) */}
                  {!isRescheduled && apt.notes && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <p className="text-xs text-slate-500 font-medium mb-1">Notas:</p>
                      <p className="text-sm text-slate-700">{apt.notes}</p>
                    </div>
                  )}

                  {/* Motivo de consulta */}
                  {apt.reason && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <p className="text-xs text-slate-500 font-medium mb-1">Motivo:</p>
                      <p className="text-sm text-slate-700">{apt.reason}</p>
                    </div>
                  )}
                </div>
                {/* === Modo Reprogramar: textarea para el motivo === */}
                {rescheduleMode && !rescheduleNewDateMode && fichaAppointment && (
                  <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <p className="text-sm font-semibold text-orange-800">Reprogramar turno</p>
                    </div>
                    <p className="text-xs text-orange-700">
                      Indicá el motivo de la reprogramación. El turno quedará en estado
                      "Reprogramado" y deberás coordinar nueva fecha con el paciente.
                    </p>
                    <textarea
                      value={rescheduleReason}
                      onChange={(e) => setRescheduleReason(e.target.value)}
                      placeholder="Ej: Tengo una urgencia, se reprogramará para la próxima semana..."
                      className="w-full min-h-[80px] rounded-md border border-orange-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={rescheduling || rescheduleReason.trim().length < 3}
                        onClick={handleRescheduleFromFicha}
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

                {/* === Modo Reagendar con nueva fecha/hora (NUEVO) ===
                    Solo se muestra cuando:
                    - El turno ya está en estado "rescheduled" (pendiente de reagendar)
                    - El profesional activó el modo Reagendar con el botón verde
                    Permite asignar nueva fecha/hora y dispara email al paciente. */}
                {rescheduleNewDateMode && fichaAppointment && (
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
                <DialogFooter className="flex justify-between gap-2 sm:justify-between flex-wrap">
                  {/* === Botones de acción (solo si NO estamos en modo reprogramar/reagendar) === */}
                  {!rescheduleMode && !rescheduleNewDateMode && (
                    <>
                      {/* === Botón Reprogramar ===
                          Solo aparece para turnos confirmed/pending que sean FUTUROS.
                          Paridad 1:1 con el admin (commit 63361b5). */}
                      {fichaAppointment
                        && ["confirmed", "pending"].includes(fichaAppointment.status)
                        && !isSlotInPast(fichaAppointment.date, fichaAppointment.time)
                        && (
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
                          de reagendar). Permite al profesional asignar nueva fecha/hora. */}
                      {fichaAppointment
                        && fichaAppointment.status === "rescheduled"
                        && !isSlotInPast(fichaAppointment.date, fichaAppointment.time)
                        && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setRescheduleNewDateMode(true);
                            setRescheduleNewDate("");
                            setRescheduleNewTime("");
                            setRescheduleError(null);
                          }}
                          disabled={cancelling || rescheduling}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CalendarPlus className="w-3 h-3 mr-1" /> 🗓️ Reagendar Turno
                        </Button>
                      )}

                      {/* === Restricción: NO cancelar turnos completados/ausentes/cancelados
                          NI turnos pasados (acciones retroactivas prohibidas) ===
                          Solo se puede cancelar un turno confirmed/pendiente/rescheduled
                          que sea FUTURO (no haya pasado la hora).
                          Misma lógica que el admin en commit 03cd5e8. */}
                      {fichaAppointment
                        && !["completed", "absent", "cancelled", "cancelled_by_professional"].includes(fichaAppointment.status)
                        && !isSlotInPast(fichaAppointment.date, fichaAppointment.time)
                        && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleCancelFromFicha}
                          disabled={cancelling}
                          className="text-xs"
                        >
                          {cancelling ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Cancelando...</> : <><XCircle className="w-3 h-3 mr-1" /> Cancelar Turno</>}
                        </Button>
                      )}
                      {fichaAppointment
                        && !["completed", "absent", "cancelled", "cancelled_by_professional"].includes(fichaAppointment.status)
                        && isSlotInPast(fichaAppointment.date, fichaAppointment.time)
                        && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Turno pasado — no se puede cancelar ni reprogramar</span>
                        </div>
                      )}
                      {fichaAppointment
                        && ["completed", "absent"].includes(fichaAppointment.status)
                        && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Turno {fichaAppointment.status === "completed" ? "atendido" : "con ausencia"} — no se puede cancelar ni reprogramar</span>
                        </div>
                      )}
                    </>
                  )}
                  <Button variant="outline" onClick={() => {
                    setFichaDialogOpen(false);
                    setRescheduleMode(false);
                    setRescheduleReason("");
                    // === Cleanup de estados del modo Reagendar ===
                    setRescheduleNewDateMode(false);
                    setRescheduleNewDate("");
                    setRescheduleNewTime("");
                    setRescheduleError(null);
                  }} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cerrar</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* === Modal de Cancelación con Selector de Origen (tarea 2026-07-24) === */}
      {/* Reemplaza el confirm() nativo. Pide al profesional especificar
          QUIÉN solicita la cancelación (paciente o profesional) y un motivo
          opcional. Esto permite al admin distinguir visualmente en la agenda
          central quién canceló cada turno. */}
      <Dialog open={cancelSourceDialog.open} onOpenChange={(open) => setCancelSourceDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-teal-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Cancelar Turno
            </DialogTitle>
          </DialogHeader>
          {fichaAppointment && (
            <div className="space-y-4 py-2">
              {/* Info del turno que se va a cancelar */}
              <div className="bg-red-50 rounded-lg p-3 space-y-1 border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>Paciente:</strong> {fichaAppointment.patient?.user?.name || "Paciente"}
                </p>
                <p className="text-sm text-red-700">
                  <strong>Fecha:</strong> {fichaAppointment.date} a las {fichaAppointment.time} hs
                </p>
              </div>

              {/* Selector de origen — OBLIGATORIO */}
              <div className="space-y-2">
                <Label className="text-teal-700 text-sm font-medium">
                  ¿Quién solicita la cancelación? <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    cancelSourceDialog.source === "patient"
                      ? "border-amber-400 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <input
                      type="radio"
                      name="cancellation-source-prof"
                      value="patient"
                      checked={cancelSourceDialog.source === "patient"}
                      onChange={(e) => setCancelSourceDialog((prev) => ({ ...prev, source: e.target.value as "patient" }))}
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
                    cancelSourceDialog.source === "professional"
                      ? "border-red-400 bg-red-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <input
                      type="radio"
                      name="cancellation-source-prof"
                      value="professional"
                      checked={cancelSourceDialog.source === "professional"}
                      onChange={(e) => setCancelSourceDialog((prev) => ({ ...prev, source: e.target.value as "professional" }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-teal-900">Cancelado por el Profesional</p>
                      <p className="text-xs text-slate-500">
                        Vos cancelás el turno. Se enviará email automático al paciente avisando de la cancelación.
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
                  value={cancelSourceDialog.reason}
                  onValueChange={(value) => setCancelSourceDialog((prev) => ({ ...prev, reason: value }))}
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
              onClick={() => setCancelSourceDialog({ open: false, source: "", reason: "" })}
              className="border-teal-300"
              disabled={cancelling}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCancellationFromFicha}
              disabled={cancelling || !cancelSourceDialog.source}
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
    </div>
  );
}
