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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  status: string;
  reason: string | null;
  modality: string | null;
  patient: { user: { name: string } };
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
  absent: "Ausente",
  rescheduled: "Reprogramado",
};

// Modality display for available cells (grid background)
const MODALITY_CELL_DISPLAY: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  OL: { icon: Monitor, label: "Online" },
  P: { icon: MapPin, label: "Presencial" },
  ambas: { icon: MapPin, label: "Presencial y Online" },
  H: { icon: MapPin, label: "Híbrida" },
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

// Generate time slots from 07:00 to 22:00 in 30-min blocks
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 22; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 22) {
      slots.push(`${h.toString().padStart(2, "0")}:30`);
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

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

  // Use prop professionalId if provided, otherwise use fetched one
  const professionalId = propProfessionalId || fetchedProfessionalId;

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
      fetch("/api/professionals")
        .then((res) => res.json())
        .then((data) => {
          const prof = Array.isArray(data)
            ? data.find((p: { userId: string }) => p.userId === userId)
            : null;
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
  const getAppointmentForCell = useCallback(
    (dateStr: string, time: string): Appointment | undefined => {
      return appointments.find((a) => a.date === dateStr && a.time === time);
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
    const Icon = display.icon;
    return (
      <div
        className="flex items-center justify-center w-full h-full"
        title={display.label}
      >
        <Icon className="w-3 h-3 text-emerald-500/70" />
      </div>
    );
  };

  // Render a single appointment block
  const renderAppointment = (apt: Appointment) => {
    const colors = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
    const modalityInfo = apt.modality ? MODALITY_BADGE[apt.modality] : null;
    const ModIcon = modalityInfo?.icon;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className={`${colors.bg} ${colors.text} ${colors.border} border rounded-md px-2 py-1 text-xs cursor-default overflow-hidden`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium truncate">{apt.patient.user.name}</span>
          {ModIcon && <ModIcon className="w-3 h-3 flex-shrink-0 opacity-60" />}
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
        {apt.status === "confirmed" && (
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
          {TIME_SLOTS.map((time) => (
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
                  >
                    {state === "booked" && apt && renderAppointment(apt)}
                    {state === "available" && renderModalityIndicator(modality)}
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
          {TIME_SLOTS.map((time) => {
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
                  {state === "available" && (
                    <div className="ml-2 flex items-center gap-1 text-emerald-600">
                      {ModIcon && <ModIcon className="w-3 h-3" />}
                      <span className="text-[11px] font-medium">
                        {modalityDisplay?.label || "Disponible"}
                      </span>
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
        </div>
      </div>

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
    </div>
  );
}
