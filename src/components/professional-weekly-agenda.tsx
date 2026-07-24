"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  date: string;
  type: "block" | "extra";
  startTime?: string | null;
  endTime?: string | null;
  modality?: string | null;
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
  { icon: React.ComponentType<{ className?: string }>; label: string; colorClass: string }
> = {
  OL: { icon: Monitor, label: "OL", colorClass: "bg-blue-50 border border-blue-200 text-blue-600 rounded-lg py-2 text-xs font-medium hover:bg-blue-100 transition-colors" },
  P: { icon: MapPin, label: "P", colorClass: "bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg py-2 text-xs font-medium hover:bg-emerald-100 transition-colors" },
  ambas: { icon: MapPin, label: "P|OL", colorClass: "bg-amber-50 border border-amber-200 text-amber-600 rounded-lg py-2 text-xs font-medium hover:bg-amber-100 transition-colors" },
  H: { icon: MapPin, label: "H", colorClass: "bg-purple-50 border border-purple-200 text-purple-600 rounded-lg py-2 text-xs font-medium hover:bg-purple-100 transition-colors" },
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
  while (current < endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    current += slotDuration;
  }
  return slots;
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
    // Calcular endTime según slotDuration del schedule
    const schedule = schedules.find((s) => s.dayOfWeek === dayOfWeek);
    const dur = schedule?.slotDuration || 45;
    const modality = schedule?.modality || "ambas";
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
      // Recargar overrides
      const overRes = await fetch(`/api/professionals/${professionalId}/overrides`).then((r) => r.json());
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
      // Recargar overrides
      const overRes = await fetch(`/api/professionals/${professionalId}/overrides`).then((r) => r.json());
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

  // === TIME_SLOTS: unión de slots generados por CADA schedule ===
  // PROBLEMA anterior: usábamos solo el slotDuration MÁS COMÚN. Si el
  // profesional tenía schedules con slotDuration distintos (ej: 15 y 45),
  // el más común (15) generaba una grilla con filas cada 15 min. Los
  // turnos de 45 min del otro schedule NO coincidian con esas filas
  // exactas → se veían como huecos pequeños intercalados.
  //
  // SOLUCIÓN: para CADA schedule, generar sus slots alineados a su propio
  // startTime (ej: schedule 08:15-15:45 con slotDuration=45 genera:
  // 08:15, 09:00, 09:45, 10:30, 11:15, 12:00, 12:45, 13:30, 14:15, 15:00).
  // Luego tomar la UNIÓN ordenada de todos esos slots.
  // Así cada schedule aporta SUS slots como filas, sin importar si
  // coinciden con múltiplos de un slotDuration global.
  const timeSlots = useMemo(() => {
    if (schedules.length === 0) return generateTimeSlotsDynamic(45);

    // Para cada schedule, generar sus slots alineados
    const allSlotsSet = new Set<string>();
    for (const s of schedules) {
      const slotsForThisSchedule = generateTimeSlotsForSchedule(
        s.startTime,
        s.endTime,
        s.slotDuration
      );
      slotsForThisSchedule.forEach((slot) => allSlotsSet.add(slot));
    }

    // Si por algún motivo no se generaron slots (schedules vacíos?), fallback
    if (allSlotsSet.size === 0) return generateTimeSlotsDynamic(45);

    // Ordenar los slots cronológicamente
    return Array.from(allSlotsSet).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

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

  // Load schedule data
  useEffect(() => {
    if (professionalId) {
      Promise.all([
        fetch(`/api/professionals/${professionalId}/schedule`).then((r) =>
          r.json()
        ),
        fetch(`/api/professionals/${professionalId}/overrides`).then((r) =>
          r.json()
        ),
      ])
        .then(([scheduleData, overridesData]) => {
          setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
          setOverrides(Array.isArray(overridesData) ? overridesData : []);
        })
        .catch(() => {});
    }
  }, [professionalId]);

  // Load appointments
  useEffect(() => {
    if (!professionalId) return;
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => {
        setAppointments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Error al cargar turnos");
        setLoading(false);
      });
  }, [professionalId, currentWeekStart]);

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
      // Recargar schedules y overrides
      const [schedRes, overRes] = await Promise.all([
        fetch(`/api/professionals/${professionalId}/schedule`).then((r) => r.json()),
        fetch(`/api/professionals/${professionalId}/overrides`).then((r) => r.json()),
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
      // Recargar overrides (los schedules base no cambian)
      const overRes = await fetch(`/api/professionals/${professionalId}/overrides`).then((r) => r.json());
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
  const getAppointmentForCell = useCallback(
    (dateStr: string, time: string): Appointment | undefined => {
      // Buscar appointments cuyo snap-down coincide con este slot
      return appointments.find((a) => {
        if (a.date !== dateStr) return false;
        // Encontrar el slot más cercano anterior al start real
        const slotsBefore = timeSlots.filter((s) => s <= a.time);
        const snappedSlot = slotsBefore[slotsBefore.length - 1];
        return snappedSlot === time;
      });
    },
    [appointments]
  );

  // Determine cell state
  // === NUEVO FLUJO DE SLOTS ===
  // - "schedule": dentro del schedule pero NO activado → muestra modalidad (naranja)
  // - "available": activado por el profesional (override type="extra") → verde "Disponible"
  // - "booked": tiene turno asignado
  // - "outside": fuera del schedule
  const getCellState = useCallback(
    (
      dateStr: string,
      time: string,
      dayOfWeek: number
    ): "schedule" | "available" | "booked" | "outside" => {
      if (getAppointmentForCell(dateStr, time)) return "booked";

      // Verificar si el slot fue activado por el profesional (override type="extra")
      const activatedSlot = overrides.find((o) => {
        if (o.date !== dateStr || o.type !== "extra") return false;
        if (!o.startTime || !o.endTime) return false;
        return time >= o.startTime && time < o.endTime;
      });
      if (activatedSlot) return "available";

      // Verificar si está dentro del schedule (pero NO activado)
      if (isSlotInSchedule(dayOfWeek, time)) return "schedule";

      return "outside";
    },
    [getAppointmentForCell, isSlotInSchedule, overrides]
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

        {/* Time rows */}
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {timeSlots.map((time) => (
            <div
              key={time}
              className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-teal-50/50 last:border-b-0"
            >
              {/* Time label */}
              <div className="p-1 text-[11px] text-teal-400 text-right pr-2 border-r border-teal-50 flex items-start justify-end pt-1.5">
                {time}
              </div>

              {/* Day cells */}
              {weekDays.map((day, i) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayOfWeek = i + 1;
                const state = getCellState(dateStr, time, dayOfWeek);
                const apt = getAppointmentForCell(dateStr, time);
                const isCurrentDay = isToday(day);
                // Verificar si el slot está en el pasado (timezone Argentina)
                const slotIsPast = isSlotInPast(dateStr, time);

                let cellClass =
                  "border-l border-teal-50/50 p-0.5 min-h-[32px] transition-colors ";

                if (state === "outside") {
                  cellClass += "bg-red-50/30 ";
                } else if (state === "schedule") {
                  // Dentro del schedule pero NO activado → fondo sutil
                  cellClass += "bg-amber-50/30 ";
                } else if (state === "available") {
                  // Activado por el profesional → verde
                  cellClass += "bg-emerald-50/60 ";
                } else if (state === "booked") {
                  cellClass += "bg-white ";
                }

                // === Slots pasados: opacidad reducida ===
                if (slotIsPast) {
                  cellClass += "opacity-50 ";
                }

                if (isCurrentDay) {
                  cellClass += "border-l-2 border-l-teal-300 ";
                }

                // Get modality for this cell
                const modality =
                  (state === "schedule" || state === "available")
                    ? getModalityForCell(dateStr, dayOfWeek, time)
                    : null;

                return (
                  <div
                    key={`${dateStr}-${time}`}
                    className={cellClass}
                    onClick={(state === "schedule" && !slotIsPast) ? () => handleActivateSlot(dateStr, time, dayOfWeek) : (state === "available" && !slotIsPast) ? () => handleDeactivateSlot(dateStr, time) : undefined}
                    style={(state === "schedule" || state === "available") && !slotIsPast ? { cursor: "pointer" } : undefined}
                  >
                    {state === "booked" && apt && renderAppointment(apt)}
                    {state === "schedule" && (
                      <div
                        className="flex items-center justify-center w-full rounded py-1 text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors"
                        title={`${MODALITY_CELL_DISPLAY[modality || "ambas"]?.label || "P|OL"} — click para activar como Disponible ${time}–${(() => { const d = schedules.find((s) => s.dayOfWeek === dayOfWeek)?.slotDuration || 45; const [h,m] = time.split(":").map(Number); const t = h*60+m+d; return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; })()} hs`}
                      >
                        {MODALITY_CELL_DISPLAY[modality || "ambas"]?.label || "P|OL"}
                      </div>
                    )}
                    {state === "available" && (
                      <div
                        className="flex items-center justify-center w-full rounded py-1 text-[10px] font-medium bg-emerald-100 border border-emerald-200 text-emerald-700 hover:bg-emerald-200 transition-colors"
                        title={`Disponible ${time}–${(() => { const d = schedules.find((s) => s.dayOfWeek === dayOfWeek)?.slotDuration || 45; const [h,m] = time.split(":").map(Number); const t = h*60+m+d; return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; })()} hs — click para desactivar`}
                      >
                        Disponible
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
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
                        className="flex items-center justify-center w-full bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg py-2 text-xs font-medium hover:bg-emerald-200 transition-colors"
                      >
                        Disponible
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
                      <div className="flex items-center justify-center w-full bg-emerald-50/50 border border-emerald-200/50 text-emerald-500 rounded-lg py-2 text-xs font-medium">
                        Disponible
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
                {rescheduleMode && fichaAppointment && (
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
                <DialogFooter className="flex justify-between gap-2 sm:justify-between flex-wrap">
                  {/* === Botones de acción (solo si NO estamos en modo reprogramar) === */}
                  {!rescheduleMode && (
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
