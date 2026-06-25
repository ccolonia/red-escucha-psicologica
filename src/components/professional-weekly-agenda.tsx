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
  OL: { icon: Monitor, label: "Online", colorClass: "bg-blue-50 border border-blue-200 text-blue-600 rounded-lg py-2 text-xs font-medium hover:bg-blue-100 transition-colors" },
  P: { icon: MapPin, label: "Presencial", colorClass: "bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg py-2 text-xs font-medium hover:bg-emerald-100 transition-colors" },
  ambas: { icon: MapPin, label: "Ambas", colorClass: "bg-amber-50 border border-amber-200 text-amber-600 rounded-lg py-2 text-xs font-medium hover:bg-amber-100 transition-colors" },
  H: { icon: MapPin, label: "Híbrido", colorClass: "bg-purple-50 border border-purple-200 text-purple-600 rounded-lg py-2 text-xs font-medium hover:bg-purple-100 transition-colors" },
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
  ambas: { icon: MapPin, label: "Ambas", color: "bg-indigo-50 text-indigo-600 border-indigo-200" },
  H: { icon: MapPin, label: "H", color: "bg-violet-50 text-violet-600 border-violet-200" },
};

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

  // === Bloqueo/desbloqueo de slots individuales ===
  const [slotBlockDialog, setSlotBlockDialog] = useState<{
    open: boolean;
    date: string;
    time: string;
    endTime: string;
    dayLabel: string;
    overrideId: string | null;
  }>({ open: false, date: "", time: "", endTime: "", dayLabel: "", overrideId: null });
  const [slotBlocking, setSlotBlocking] = useState(false);

  const openFichaDialog = (apt: Appointment) => {
    setFichaAppointment(apt);
    setFichaDialogOpen(true);
  };

  // === Cancelar turno desde la ficha rápida ===
  // Usa 'cancelled_by_professional' que dispara email automático al paciente
  // (sendCancellationByProfessionalEmail en el backend PATCH /api/appointments/[id])
  const handleCancelFromFicha = async () => {
    if (!fichaAppointment) return;
    if (!confirm(`¿Confirmar cancelación del turno de ${fichaAppointment.patient?.user?.name || "paciente"}?\n\nSe enviará un email al paciente avisando de la cancelación.`)) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/appointments/${fichaAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled_by_professional" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al cancelar el turno");
        return;
      }
      // Feedback según si se envió email al paciente
      if (data.emailSent?.patient) {
        toast.success(`Turno cancelado. Se envió email al paciente.`);
      } else {
        toast.warning(`Turno cancelado. No se pudo enviar email al paciente — recomendamos contactarlo por WhatsApp.`);
      }
      // Actualizar estado local del appointment
      setAppointments((prev) =>
        prev.map((a) => (a.id === fichaAppointment.id ? { ...a, status: "cancelled_by_professional" } : a))
      );
      setFichaDialogOpen(false);
    } catch (err) {
      console.error("Error cancelling from ficha:", err);
      toast.error("Error de conexión al cancelar el turno");
    } finally {
      setCancelling(false);
    }
  };

  // === Bloquear/desbloquear slot individual ===
  const openSlotBlockDialog = (date: string, time: string, endTime: string, dayLabel: string) => {
    // Verificar si ya existe un override de bloqueo para este slot
    const existing = overrides.find((o) =>
      o.date === date && o.type === "block" && o.startTime === time && o.endTime === endTime
    );
    setSlotBlockDialog({
      open: true,
      date,
      time,
      endTime,
      dayLabel,
      overrideId: existing?.id || null,
    });
  };

  const handleBlockSlot = async () => {
    if (!professionalId || !slotBlockDialog.date) return;
    setSlotBlocking(true);
    try {
      const res = await fetch(`/api/professionals/${professionalId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: slotBlockDialog.date,
          type: "block",
          startTime: slotBlockDialog.time,
          endTime: slotBlockDialog.endTime,
          reason: "Bloqueado desde grilla",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al bloquear slot");
        return;
      }
      toast.success(`Slot ${slotBlockDialog.time} bloqueado correctamente`);
      setSlotBlockDialog((prev) => ({ ...prev, open: false }));
      // Recargar overrides
      const overRes = await fetch(`/api/professionals/${professionalId}/overrides`).then((r) => r.json());
      setOverrides(Array.isArray(overRes) ? overRes : []);
    } catch (err) {
      console.error("Error blocking slot:", err);
      toast.error("Error de conexión al bloquear slot");
    } finally {
      setSlotBlocking(false);
    }
  };

  const handleUnblockSlot = async () => {
    if (!professionalId || !slotBlockDialog.overrideId) return;
    setSlotBlocking(true);
    try {
      const res = await fetch(
        `/api/professionals/${professionalId}/overrides?overrideId=${slotBlockDialog.overrideId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al desbloquear slot");
        return;
      }
      toast.success(`Slot ${slotBlockDialog.time} desbloqueado correctamente`);
      setSlotBlockDialog((prev) => ({ ...prev, open: false }));
      // Recargar overrides
      const overRes = await fetch(`/api/professionals/${professionalId}/overrides`).then((r) => r.json());
      setOverrides(Array.isArray(overRes) ? overRes : []);
    } catch (err) {
      console.error("Error unblocking slot:", err);
      toast.error("Error de conexión al desbloquear slot");
    } finally {
      setSlotBlocking(false);
    }
  };

  // Use prop professionalId if provided, otherwise use fetched one
  const professionalId = propProfessionalId || fetchedProfessionalId;

  // === TIME_SLOTS dinámico según slotDuration del profesional ===
  // Calcula el slotDuration más común de los schedules cargados.
  // Si no hay schedules, usa 45 min por defecto.
  const timeSlots = useMemo(() => {
    if (schedules.length === 0) return generateTimeSlotsDynamic(45);
    // Encontrar el slotDuration más frecuente
    const counts: Record<number, number> = {};
    for (const s of schedules) {
      counts[s.slotDuration] = (counts[s.slotDuration] || 0) + 1;
    }
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const slotDuration = mostCommon ? parseInt(mostCommon[0], 10) : 45;
    return generateTimeSlotsDynamic(slotDuration);
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
      fetch("/api/professionals?all=true")
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
  const getCellState = useCallback(
    (
      dateStr: string,
      time: string,
      dayOfWeek: number
    ): "available" | "booked" | "outside" | "blocked" => {
      if (isDateBlocked(dateStr)) return "blocked";
      if (isTimeSlotBlocked(dateStr, time)) return "blocked";
      if (getAppointmentForCell(dateStr, time)) return "booked";
      if (isSlotInSchedule(dayOfWeek, time)) return "available";

      // Check if extra override adds this slot
      const extraSlot = overrides.find((o) => {
        if (o.date !== dateStr || o.type !== "extra") return false;
        if (!o.startTime || !o.endTime) return false;
        return time >= o.startTime && time < o.endTime;
      });
      if (extraSlot) return "available";

      return "outside";
    },
    [isDateBlocked, isTimeSlotBlocked, getAppointmentForCell, isSlotInSchedule, overrides]
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
        {apt.status === "confirmed" && apt.date <= new Date().toLocaleDateString("sv-SE") && (
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

                let cellClass =
                  "border-l border-teal-50/50 p-0.5 min-h-[32px] transition-colors ";

                if (state === "outside" || state === "blocked") {
                  cellClass += "bg-gray-50/50 ";
                } else if (state === "available") {
                  // Soft green background for availability
                  cellClass += "bg-emerald-50/60 ";
                } else if (state === "booked") {
                  cellClass += "bg-white ";
                }

                if (isCurrentDay) {
                  cellClass += "border-l-2 border-l-teal-300 ";
                }

                // Get modality for this cell
                const modality =
                  state === "available"
                    ? getModalityForCell(dateStr, dayOfWeek, time)
                    : null;

                return (
                  <div
                    key={`${dateStr}-${time}`}
                    className={cellClass}
                    onClick={(state === "available" || state === "blocked") ? () => {
                      const dur = schedules.find((s) => s.dayOfWeek === dayOfWeek)?.slotDuration || 45;
                      const [h, m] = time.split(":").map(Number);
                      const total = h * 60 + m + dur;
                      const endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                      const dayLabel = format(parseISO(dateStr), "EEEE d 'de' MMMM", { locale: es });
                      openSlotBlockDialog(dateStr, time, endTime, dayLabel);
                    } : undefined}
                    style={(state === "available" || state === "blocked") ? { cursor: "pointer" } : undefined}
                  >
                    {state === "booked" && apt && renderAppointment(apt)}
                    {state === "available" && renderModalityIndicator(modality)}
                    {state === "blocked" && (
                      <div
                        className="flex items-center justify-center w-full bg-slate-200 border border-slate-400 text-slate-700 rounded-md py-1.5 text-[10px] font-bold select-none"
                        title="Slot bloqueado por el profesional (click para desbloquear)"
                      >
                        🔒 Ocupado
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
              state === "available"
                ? getModalityForCell(dateStr, dayOfWeek, time)
                : null;
            const modalityDisplay = modality
              ? MODALITY_CELL_DISPLAY[modality]
              : null;
            const ModIcon = modalityDisplay?.icon;

            let rowClass =
              "flex items-start min-h-[36px] rounded-md px-2 py-1 transition-colors ";

            if (state === "outside" || state === "blocked") {
              rowClass += "bg-gray-50/30 ";
            } else if (state === "available") {
              rowClass += "bg-emerald-50/50 ";
            } else if (state === "booked") {
              rowClass += "bg-white ";
            }

            return (
              <div
                key={time}
                className={rowClass}
              >
                <span className="text-[11px] text-teal-400 w-12 flex-shrink-0 pt-0.5">
                  {time}
                </span>
                <div className="flex-1">
                  {state === "booked" && apt && (
                    <div className="ml-2">{renderAppointment(apt)}</div>
                  )}
                  {(state === "available" || state === "blocked") && (
                    <div className="ml-2 flex-1">
                      <button
                        onClick={() => openSlotBlockDialog(dateStr, time, (() => {
                          // Calcular endTime según slotDuration del profesional
                          const dur = schedules.find((s) => s.dayOfWeek === dayOfWeek)?.slotDuration || 45;
                          const [h, m] = time.split(":").map(Number);
                          const total = h * 60 + m + dur;
                          return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                        })(), format(parseISO(dateStr), "EEEE d 'de' MMMM", { locale: es }))}
                        className={`flex items-center justify-center w-full ${
                          state === "blocked"
                            ? "bg-slate-100 border border-slate-300 text-slate-500 rounded-lg py-2 text-xs font-medium"
                            : modalityDisplay?.colorClass || "bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg py-2 text-xs font-medium"
                        }`}
                      >
                        {state === "blocked" ? "🔒 Ocupado" : (modalityDisplay?.label || "Disponible")}
                      </button>
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
            const modalityLabel = apt.modality === "P" ? "Presencial"
              : apt.modality === "OL" ? "Online"
              : apt.modality === "H" ? "Híbrido"
              : apt.modality === "ambas" ? "Ambas"
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
                <DialogFooter className="flex justify-between gap-2 sm:justify-between">
                  {fichaAppointment && fichaAppointment.status !== "cancelled" && fichaAppointment.status !== "cancelled_by_professional" && (
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
                  <Button variant="outline" onClick={() => setFichaDialogOpen(false)} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cerrar</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* === Dialog: Bloquear/Desbloquear slot individual === */}
      <Dialog open={slotBlockDialog.open} onOpenChange={(open) => setSlotBlockDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-teal-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              Gestionar Slot
            </DialogTitle>
            <DialogDescription className="text-teal-600 capitalize">
              {slotBlockDialog.dayLabel} — {slotBlockDialog.time} a {slotBlockDialog.endTime} hs
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-slate-600">
              {slotBlockDialog.overrideId
                ? "Este slot está actualmente bloqueado. Podés desbloquearlo para que vuelva a estar disponible para asignación."
                : "Este slot está disponible. Podés bloquearlo para que ni el admin ni los pacientes puedan asignar turnos en este horario."}
            </p>
          </div>
          <DialogFooter className="flex justify-between gap-2 sm:justify-between">
            {slotBlockDialog.overrideId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnblockSlot}
                disabled={slotBlocking}
                className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                {slotBlocking ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Desbloqueando...</> : <>🔓 Desbloquear horario</>}
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBlockSlot}
                disabled={slotBlocking}
                className="text-xs"
              >
                {slotBlocking ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Bloqueando...</> : <>🛑 Bloquear este horario</>}
              </Button>
            )}
            <Button variant="outline" onClick={() => setSlotBlockDialog((prev) => ({ ...prev, open: false }))} className="border-teal-200 text-teal-600 hover:bg-teal-50">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
