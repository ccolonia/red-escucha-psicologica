"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  UserCheck,
  Stethoscope,
  FileText,
  Lock,
  Save,
  AlertCircle,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Upload,
  Download,
  Award,
  Target,
  Layers,
  Globe,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { SPECIALTIES, THERAPY_TYPES, TARGET_AUDIENCES, THERAPY_MODALITIES } from "@/lib/professional-categories";
import { ProfessionalWeeklyAgenda } from "@/components/professional-weekly-agenda";

interface Appointment {
  id: string;
  date: string;
  time: string;
  // timeEnd calculado por el backend según slotDuration del schedule del
  // profesional para ese día de la semana. Default 45 min si no hay schedule.
  timeEnd?: string;
  status: string;
  reason: string | null;
  notes: string | null;
  patient: { user: { name: string; email: string; phone: string } };
  professional: { user: { name: string }; specialty: string };
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "default" },
  completed: { label: "Atendido", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  cancelled_by_professional: { label: "Cancelado por profesional", variant: "destructive" },
  absent: { label: "Ausente", variant: "outline" },
  rescheduled: { label: "Reprogramado", variant: "outline" },
};

// Helper de módulo: formatear rango horario "HH:MM a HH:MM hs" usando el
// timeEnd que calcula el backend según slotDuration del schedule del
// profesional para ese día. Si no viene timeEnd (fallback), 45 min default.
function formatTimeRange(time: string, timeEnd?: string): string {
  if (timeEnd) {
    return `${time} a ${timeEnd} hs`;
  }
  const [h, m] = time.split(":").map(Number);
  const duration = 45;
  const totalMinutes = h * 60 + m + duration;
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;
  const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return `${time} a ${endTime} hs`;
}

export function ProfessionalDashboard() {
  const { data: session } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => {
        setAppointments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const todayAppointments = appointments.filter((a) => a.date === today);
  const pendingCount = appointments.filter(
    (a) => a.status === "pending"
  ).length;
  const confirmedCount = appointments.filter(
    (a) => a.status === "confirmed" && a.date >= today
  ).length;

  const handleStatusUpdate = async (
    id: string,
    status: string,
    notes?: string,
    cancellationReason?: string
  ) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, cancellationReason }),
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status, notes: notes || a.notes } : a))
        );
        // Toast específico para cancelled_by_professional con feedback de email
        if (status === "cancelled_by_professional") {
          if (data.emailSent?.patient) {
            toast.success("Turno cancelado. Se envió email al paciente.");
          } else {
            toast.warning(
              "Turno cancelado. No se pudo enviar email al paciente — " +
              "recomendamos contactarlo por WhatsApp manualmente."
            );
          }
        } else {
          toast.success(
            status === "confirmed"
              ? "Turno confirmado"
              : status === "completed"
              ? "Turno marcado como Atendido"
              : status === "absent"
              ? "Turno marcado como Ausente"
              : status === "rescheduled"
              ? "Turno marcado como Reprogramado"
              : "Turno cancelado"
          );
        }
      } else {
        // Manejo de error: el backend devolvió 4xx o 5xx
        let errorMsg = `Error ${res.status} al actualizar el turno`;
        try {
          const data = await res.json();
          if (data.error) errorMsg = data.error;
        } catch {
          // response sin body JSON
        }
        console.error("handleStatusUpdate error:", {
          status: res.status,
          statusText: res.statusText,
          message: errorMsg,
          appointmentId: id,
          requestedStatus: status,
        });
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error("handleStatusUpdate network error:", err);
      toast.error("Error de conexión al actualizar turno");
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">
          ¡Hola, {session?.user?.name?.split(" ").slice(0, 2).join(" ")}!
        </h1>
        <p className="text-teal-100 mt-1">Panel profesional</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-teal-100">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-teal-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {todayAppointments.length}
            </p>
            <p className="text-sm text-teal-600">Turnos hoy</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {pendingCount}
            </p>
            <p className="text-sm text-teal-600">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100 col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {confirmedCount}
            </p>
            <p className="text-sm text-teal-600">Confirmados</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's appointments */}
      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Turnos de Hoy
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-teal-50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : todayAppointments.length === 0 ? (
            <p className="text-teal-600 text-center py-6">
              No tenés turnos programados para hoy
            </p>
          ) : (
            <div className="space-y-3">
              {todayAppointments
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 bg-teal-50/50 rounded-lg border border-teal-100"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-medium text-teal-900">
                            {apt.patient.user.name}
                          </p>
                          {/* Contacto rápido: WhatsApp + Email */}
                          {(apt.patient.user.phone || apt.patient.user.email) && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              {apt.patient.user.phone && (
                                <a
                                  href={`https://wa.me/${apt.patient.user.phone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 hover:underline transition-colors"
                                  title={`Enviar WhatsApp a ${apt.patient.user.name}`}
                                >
                                  <MessageCircle className="w-3 h-3 text-emerald-500" />
                                  {apt.patient.user.phone}
                                </a>
                              )}
                              {apt.patient.user.email && (
                                <a
                                  href={`mailto:${apt.patient.user.email}`}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline transition-colors"
                                  title={`Enviar email a ${apt.patient.user.name}`}
                                >
                                  <Mail className="w-3 h-3 text-teal-500" />
                                  {apt.patient.user.email}
                                </a>
                              )}
                            </div>
                          )}
                          {!apt.patient.user.phone && !apt.patient.user.email && (
                            <p className="text-xs text-teal-400 italic mt-1">
                              Sin datos de contacto
                            </p>
                          )}
                          <p className="text-sm text-teal-600">
                            {formatTimeRange(apt.time, apt.timeEnd)}
                          </p>
                          {apt.reason && (
                            <p className="text-sm text-teal-500 mt-1">
                              {apt.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={STATUS_MAP[apt.status]?.variant || "outline"}
                      >
                        {STATUS_MAP[apt.status]?.label || apt.status}
                      </Badge>
                    </div>
                    {apt.status === "pending" && (
                      <div className="flex gap-2 mt-3 ml-13">
                        <Button
                          size="sm"
                          className="bg-teal-600 hover:bg-teal-700 text-white h-8"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "confirmed")
                          }
                        >
                          <CheckCircle2 className="mr-1 w-3 h-3" />
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "cancelled_by_professional")
                          }
                        >
                          <XCircle className="mr-1 w-3 h-3" />
                          Cancelar
                        </Button>
                      </div>
                    )}
                    {apt.status === "confirmed" && (
                      <div className="mt-3 ml-13 flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "completed")
                          }
                        >
                          <CheckCircle2 className="mr-1 w-3 h-3" />
                          Atendido
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-amber-500 hover:bg-amber-600 text-white text-xs"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "absent")
                          }
                        >
                          <AlertCircle className="mr-1 w-3 h-3" />
                          Ausente
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-blue-500 hover:bg-blue-600 text-white text-xs"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "rescheduled")
                          }
                        >
                          <Calendar className="mr-1 w-3 h-3" />
                          Reprogramado
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs"
                          onClick={() => {
                            if (
                              confirm(
                                "¿Confirmar cancelación del turno?\n\n" +
                                "Se enviará un email al paciente avisándole de la cancelación, " +
                                "y el equipo de Red Escucha se encargará de reasignarlo con otro profesional."
                              )
                            ) {
                              handleStatusUpdate(apt.id, "cancelled_by_professional");
                            }
                          }}
                        >
                          <XCircle className="mr-1 w-3 h-3" />
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending appointments */}
      {pendingCount > 0 && (
        <Card className="border-amber-100 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Turnos Pendientes de Confirmación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {appointments
                .filter((a) => a.status === "pending")
                .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
                .map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 bg-white rounded-lg border border-amber-100"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-teal-900">
                          {apt.patient.user.name}
                        </p>
                        {/* Contacto rápido: WhatsApp + Email */}
                        {(apt.patient.user.phone || apt.patient.user.email) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            {apt.patient.user.phone && (
                              <a
                                href={`https://wa.me/${apt.patient.user.phone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 hover:underline transition-colors"
                                title={`Enviar WhatsApp a ${apt.patient.user.name}`}
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-500" />
                                {apt.patient.user.phone}
                              </a>
                            )}
                            {apt.patient.user.email && (
                              <a
                                href={`mailto:${apt.patient.user.email}`}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline transition-colors"
                                title={`Enviar email a ${apt.patient.user.name}`}
                              >
                                <Mail className="w-3 h-3 text-teal-500" />
                                {apt.patient.user.email}
                              </a>
                            )}
                          </div>
                        )}
                        {!apt.patient.user.phone && !apt.patient.user.email && (
                          <p className="text-xs text-teal-400 italic mt-1">
                            Sin datos de contacto
                          </p>
                        )}
                        <p className="text-sm text-teal-600">
                          {apt.date} • {formatTimeRange(apt.time, apt.timeEnd)}
                        </p>
                        {apt.reason && (
                          <p className="text-sm text-teal-500">{apt.reason}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-teal-600 hover:bg-teal-700 text-white h-8"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "confirmed")
                          }
                        >
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "cancelled_by_professional")
                          }
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ProfessionalSchedule() {
  const { data: session } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [statusChangeId, setStatusChangeId] = useState<string | null>(null);
  const [statusChangeType, setStatusChangeType] = useState<string>("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("agenda");

  // Load professional ID
  useEffect(() => {
    if (session?.user) {
      const userId = (session.user as { id: string }).id;
      fetch("/api/professionals?all=true&includeUnverified=true")
        .then((res) => res.json())
        .then((data) => {
          const profs = Array.isArray(data) ? data : [];
          const prof = profs.find((p: { userId: string }) => p.userId === userId);
          if (prof) {
            setProfessionalId(prof.id);
          }
        })
        .catch(() => {});
    }
  }, [session]);

  const loadAppointments = () => {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => {
        setAppointments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleConfirm = async (id: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "confirmed" } : a))
        );
        toast.success("Turno confirmado");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al confirmar");
      }
    } catch {
      toast.error("Error al confirmar");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled_by_professional" }),
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "cancelled_by_professional" } : a))
        );
        // Toast con feedback de email (igual que handleStatusUpdate)
        if (data.emailSent?.patient) {
          toast.success("Turno cancelado. Se envió email al paciente.");
        } else {
          toast.warning(
            "Turno cancelado. No se pudo enviar email al paciente — " +
            "recomendamos contactarlo por WhatsApp manualmente."
          );
        }
      } else {
        let errorMsg = `Error ${res.status} al cancelar el turno`;
        try {
          const data = await res.json();
          if (data.error) errorMsg = data.error;
        } catch {
          // response sin body JSON
        }
        console.error("handleCancel error:", {
          status: res.status,
          statusText: res.statusText,
          message: errorMsg,
          appointmentId: id,
        });
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error("handleCancel network error:", err);
      toast.error("Error de conexión al cancelar turno");
    }
  };

  const handleComplete = async (id: string) => {
    if (!sessionNotes.trim()) {
      toast.error("Debés completar las notas de la sesión antes de marcar como completado");
      return;
    }
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", notes: sessionNotes }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "completed", notes: sessionNotes } : a))
        );
        setCompletingId(null);
        setSessionNotes("");
        toast.success("Turno completado");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al completar turno");
      }
    } catch {
      toast.error("Error al completar turno");
    }
  };

  // Group by date — include cancelled_by_professional so admin can see them
  const grouped = appointments
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .reduce<Record<string, Appointment[]>>((acc, apt) => {
      if (!acc[apt.date]) acc[apt.date] = [];
      acc[apt.date].push(apt);
      return acc;
    }, {});

  // Helper: formatear rango horario — delega a formatTimeRange de módulo
  const getTimeRange = (time: string, timeEnd?: string): string => {
    return formatTimeRange(time, timeEnd);
  };

  // Helper: format date nicely in Spanish
  const formatDateEs = (dateStr: string): string => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
      const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      return `${dayNames[date.getDay()]} ${d} de ${monthNames[date.getMonth()]}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-teal-900">Mi Agenda</h2>
      </div>

      {/* Tabs: Agenda Visual / Lista */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-teal-50 border border-teal-100">
          <TabsTrigger
            value="agenda"
            className="data-[state=active]:bg-teal-600 data-[state=active]:text-white"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Agenda Visual
          </TabsTrigger>
          <TabsTrigger
            value="lista"
            className="data-[state=active]:bg-teal-600 data-[state=active]:text-white"
          >
            <Clock className="w-4 h-4 mr-1" />
            Lista
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-4">
          <ProfessionalWeeklyAgenda professionalId={professionalId} />
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-teal-50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <Card className="border-teal-100">
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 text-teal-200 mx-auto" />
                <p className="text-teal-600 mt-2">No hay turnos programados</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([date, apts]) => (
                <Card key={date} className="border-teal-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-teal-900 text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {date === new Date().toISOString().split("T")[0]
                        ? `Hoy — ${formatDateEs(date)}`
                        : formatDateEs(date)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {apts.map((apt) => (
                      <div
                        key={apt.id}
                        className="p-3 bg-teal-50/50 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-teal-100 rounded flex items-center justify-center">
                              <Clock className="w-4 h-4 text-teal-600" />
                            </div>
                            <div>
                              <p className="text-sm text-teal-600">
                                {getTimeRange(apt.time, apt.timeEnd)}
                              </p>
                              <p className="text-sm font-semibold text-teal-900">
                                {apt.patient.user.name}
                              </p>
                              {/* Contacto rápido: WhatsApp + Email */}
                              {(apt.patient.user.phone || apt.patient.user.email) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                  {apt.patient.user.phone && (
                                    <a
                                      href={`https://wa.me/${apt.patient.user.phone.replace(/[^0-9]/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 hover:underline transition-colors"
                                      title={`Enviar WhatsApp a ${apt.patient.user.name}`}
                                    >
                                      <MessageCircle className="w-3 h-3 text-emerald-500" />
                                      {apt.patient.user.phone}
                                    </a>
                                  )}
                                  {apt.patient.user.email && (
                                    <a
                                      href={`mailto:${apt.patient.user.email}`}
                                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline transition-colors"
                                      title={`Enviar email a ${apt.patient.user.name}`}
                                    >
                                      <Mail className="w-3 h-3 text-teal-500" />
                                      {apt.patient.user.email}
                                    </a>
                                  )}
                                </div>
                              )}
                              {!apt.patient.user.phone && !apt.patient.user.email && (
                                <p className="text-xs text-teal-400 italic mt-1">
                                  Sin datos de contacto
                                </p>
                              )}
                              {apt.reason ? (
                                <p className="text-xs text-teal-600 mt-0.5 bg-teal-100/50 px-2 py-1 rounded">
                                  <span className="font-medium">Motivo:</span> {apt.reason}
                                </p>
                              ) : (
                                <p className="text-xs text-teal-400 italic">Sin motivo especificado</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                STATUS_MAP[apt.status]?.variant || "outline"
                              }
                            >
                              {STATUS_MAP[apt.status]?.label || apt.status}
                            </Badge>
                            {apt.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs"
                                  onClick={() => handleConfirm(apt.id)}
                                >
                                  Confirmar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => handleCancel(apt.id)}
                                >
                                  Cancelar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Status change options for confirmed appointments */}
                        {apt.status === "confirmed" && (
                          <div className="mt-3 pt-3 border-t border-teal-100">
                            {statusChangeId === apt.id && statusChangeType ? (
                              <div className="space-y-3">
                                <Label className="text-sm text-teal-700">
                                  Notas {statusChangeType === "completed" ? "(obligatorio para Atendido)" : "(opcional)"}
                                </Label>
                                <textarea
                                  value={sessionNotes}
                                  onChange={(e) => setSessionNotes(e.target.value)}
                                  placeholder={
                                    statusChangeType === "completed"
                                      ? "Registre las observaciones de la sesión..."
                                      : statusChangeType === "absent"
                                      ? "Motivo de la inasistencia (opcional)..."
                                      : "Motivo de la reprogramación (opcional)..."
                                  }
                                  className="w-full min-h-[80px] rounded-md border border-teal-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                  rows={3}
                                />
                                <div className="flex gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    className={`h-7 text-xs text-white ${
                                      statusChangeType === "completed"
                                        ? "bg-emerald-600 hover:bg-emerald-700"
                                        : statusChangeType === "absent"
                                        ? "bg-amber-500 hover:bg-amber-600"
                                        : "bg-blue-500 hover:bg-blue-600"
                                    }`}
                                    disabled={statusChangeType === "completed" && !sessionNotes.trim()}
                                    onClick={async () => {
                                      const res = await fetch(`/api/appointments/${apt.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ status: statusChangeType, notes: sessionNotes || undefined }),
                                      });
                                      if (res.ok) {
                                        setAppointments((prev) =>
                                          prev.map((a) => (a.id === apt.id ? { ...a, status: statusChangeType, notes: sessionNotes || a.notes } : a))
                                        );
                                        toast.success(
                                          statusChangeType === "completed"
                                            ? "Turno marcado como Atendido"
                                            : statusChangeType === "absent"
                                            ? "Turno marcado como Ausente"
                                            : "Turno marcado como Reprogramado"
                                        );
                                      } else {
                                        const data = await res.json();
                                        toast.error(data.error || "Error al actualizar");
                                      }
                                      setStatusChangeId(null);
                                      setStatusChangeType("");
                                      setSessionNotes("");
                                    }}
                                  >
                                    {statusChangeType === "completed" && <CheckCircle2 className="mr-1 w-3 h-3" />}
                                    {statusChangeType === "absent" && <AlertCircle className="mr-1 w-3 h-3" />}
                                    {statusChangeType === "rescheduled" && <Calendar className="mr-1 w-3 h-3" />}
                                    Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-teal-200"
                                    onClick={() => {
                                      setStatusChangeId(null);
                                      setStatusChangeType("");
                                      setSessionNotes("");
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    setStatusChangeId(apt.id);
                                    setStatusChangeType("completed");
                                    setSessionNotes("");
                                  }}
                                >
                                  <CheckCircle2 className="mr-1 w-3 h-3" />
                                  Atendido
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                  onClick={() => {
                                    setStatusChangeId(apt.id);
                                    setStatusChangeType("absent");
                                    setSessionNotes("");
                                  }}
                                >
                                  <AlertCircle className="mr-1 w-3 h-3" />
                                  Ausente
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-blue-500 hover:bg-blue-600 text-white"
                                  onClick={() => {
                                    setStatusChangeId(apt.id);
                                    setStatusChangeType("rescheduled");
                                    setSessionNotes("");
                                  }}
                                >
                                  <Calendar className="mr-1 w-3 h-3" />
                                  Reprogramado
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "¿Confirmar cancelación del turno?\n\n" +
                                        "Se enviará un email al paciente avisándole de la cancelación, " +
                                        "y el equipo de Red Escucha se encargará de reasignarlo con otro profesional."
                                      )
                                    ) {
                                      handleCancel(apt.id);
                                    }
                                  }}
                                >
                                  <XCircle className="mr-1 w-3 h-3" />
                                  Cancelar
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Show notes for completed/absent/rescheduled appointments */}
                        {(apt.status === "completed" || apt.status === "absent" || apt.status === "rescheduled") && apt.notes && (
                          <div className="mt-2 pt-2 border-t border-teal-100">
                            <p className="text-xs text-teal-500">
                              <FileText className="inline w-3 h-3 mr-1" />
                              Notas: {apt.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}

// === Tipos del panel de Pacientes ===
type AppointmentForHistory = {
  id: string;
  date: string;
  time: string;
  status: string;
  modality: string | null;
  reason: string | null;
};

type PrivateNote = {
  content: string;
  updatedAt: Date;
};

type PatientWithDetails = {
  id: string;
  dni?: string | null;
  user: {
    name: string;
    email: string;
    phone: string;
    active: boolean;
    createdAt: Date;
  };
  appointments?: AppointmentForHistory[];
  professionalNotes?: PrivateNote[];
};

// === Mapa de estados de cita → { label, classes } ===
// Centralizado para mantener consistencia entre badges de la lista y del detalle.
const APPOINTMENT_STATUS_STYLES: Record<
  string,
  { label: string; classes: string }
> = {
  completed: {
    label: "Atendida",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  absent: {
    label: "Ausente",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  cancelled: {
    label: "Cancelada",
    classes: "bg-rose-50 text-rose-700 border-rose-200",
  },
  confirmed: {
    label: "Confirmada",
    classes: "bg-sky-50 text-sky-700 border-sky-200",
  },
  pending: {
    label: "Pendiente",
    classes: "bg-slate-50 text-slate-700 border-slate-200",
  },
  rescheduled: {
    label: "Reprogramada",
    classes: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

function getAppointmentStatusStyle(status: string) {
  return (
    APPOINTMENT_STATUS_STYLES[status] ?? {
      label: status || "—",
      classes: "bg-slate-50 text-slate-700 border-slate-200",
    }
  );
}

// === Formatea fecha ISO (yyyy-mm-dd) a dd/mm/yyyy ===
function formatAppointmentDate(isoDate: string): string {
  // La fecha viene como "2026-06-15" (sin TZ). La parseamos manualmente
  // para evitar que JS la interprete como UTC y la desplace un día al
  // convertirla a la zona horaria local del navegador.
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function ProfessionalPatients() {
  const [patients, setPatients] = useState<PatientWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // === Notas privadas: estado local ===
  // La nota se carga junto con el paciente (professionalNotes[0]?.content)
  // y se mantiene en un estado local separado para que el textarea sea
  // controlado y fluido. El guardado es con debounce + flag de "guardando".
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data: PatientWithDetails[]) => {
        setPatients(data);
        // Inicializar los borradores de notas con el contenido que ya tenía cada paciente
        const initialDrafts: Record<string, string> = {};
        for (const p of data) {
          initialDrafts[p.id] = p.professionalNotes?.[0]?.content ?? "";
        }
        setNoteDrafts(initialDrafts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // === Filtro en tiempo real (cliente-side) ===
  // Filtra por nombre O email, case-insensitive. Si el término está vacío,
  // muestra todos. Esto evita una llamada al server por cada tecla.
  const filteredPatients = patients.filter((p) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      p.user.name.toLowerCase().includes(term) ||
      p.user.email.toLowerCase().includes(term)
    );
  });

  // === Guardado de nota con debounce (1.2s sin escribir) ===
  // El guardado es upsert: si la nota cambió respecto del último guardado,
  // se manda PUT. Si el usuario dejó de escribir por 1.2s, se considera
  // que terminó de editar y se persiste.
  const scheduleNoteSave = (patientId: string) => {
    // Limpiar timer previo si existe
    if (debounceRef.current[patientId]) {
      clearTimeout(debounceRef.current[patientId]);
    }
    // Programar nuevo guardado
    debounceRef.current[patientId] = setTimeout(async () => {
      const content = noteDrafts[patientId] ?? "";
      setSavingNoteId(patientId);
      setSavedNoteId(null);
      try {
        const res = await fetch(`/api/patients/${patientId}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          setSavedNoteId(patientId);
          // Mantener el "Guardado" visible por 2.5s y luego limpiar
          setTimeout(() => {
            setSavedNoteId((curr) => (curr === patientId ? null : curr));
          }, 2500);
        } else {
          toast.error("No se pudo guardar la nota privada");
        }
      } catch {
        toast.error("No se pudo guardar la nota privada");
      } finally {
        setSavingNoteId(null);
      }
    }, 1200);
  };

  const handleNoteChange = (patientId: string, value: string) => {
    setNoteDrafts((prev) => ({ ...prev, [patientId]: value }));
    scheduleNoteSave(patientId);
  };

  const toggleExpand = (patientId: string) => {
    setExpandedId((curr) => (curr === patientId ? null : patientId));
  };

  return (
    <div>
      {/* === Header: título + contador === */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-teal-900">
          Pacientes
          <span className="ml-2 text-sm font-normal text-teal-500">
            ({patients.length} {patients.length === 1 ? "paciente" : "pacientes"})
          </span>
        </h2>
      </div>

      {/* === Barra de búsqueda instantánea === */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar por nombre o email…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-11 border-teal-200 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus-visible:ring-teal-100"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-700 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* === Estados: loading / vacío / lista === */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-teal-50 animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : filteredPatients.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-teal-200 mx-auto mb-2" />
            <p className="text-teal-700 font-medium">
              {searchTerm
                ? "No se encontraron pacientes con ese criterio"
                : "No hay pacientes registrados"}
            </p>
            <p className="text-teal-500 text-sm mt-1">
              {searchTerm
                ? "Probá con otro nombre o email, o limpiá la búsqueda."
                : "Cuando tengas turnos asignados, tus pacientes aparecerán acá."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPatients.map((patient) => {
            const isExpanded = expandedId === patient.id;
            const historial = patient.appointments ?? [];
            const ultimaSesion = historial[0];
            const ultimaSesionStyle = ultimaSesion
              ? getAppointmentStatusStyle(ultimaSesion.status)
              : null;

            return (
              <Card
                key={patient.id}
                className={`border-teal-100 transition-all overflow-hidden ${
                  isExpanded ? "ring-1 ring-teal-200 shadow-sm" : ""
                }`}
              >
                {/* === Header de la tarjeta (siempre visible, cliqueable) === */}
                <button
                  type="button"
                  onClick={() => toggleExpand(patient.id)}
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-teal-50/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 rounded-lg"
                  aria-expanded={isExpanded}
                >
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-teal-900 truncate">
                      {patient.user.name}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-teal-600">
                      <span className="truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" />
                        {patient.user.email}
                      </span>
                      {patient.user.phone && (
                        <span className="hidden sm:inline-flex items-center gap-1 shrink-0">
                          <Phone className="w-3 h-3" />
                          {patient.user.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* === Badge de última sesión (a la derecha) === */}
                  {ultimaSesionStyle && (
                    <span
                      className={`hidden md:inline-flex items-center text-xs px-2 py-1 rounded-full border ${ultimaSesionStyle.classes} shrink-0`}
                    >
                      Última: {ultimaSesionStyle.label}
                    </span>
                  )}
                  {/* === Indicador de expansión === */}
                  <ChevronDown
                    className={`w-5 h-5 text-teal-500 shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* === Detalle expandible === */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="border-t border-teal-100 bg-white"
                  >
                    <div className="p-4 space-y-5">
                      {/* === Datos del paciente (DNI + teléfono mobile) === */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-teal-600">
                        {patient.dni && (
                          <span className="flex items-center gap-1">
                            <span className="text-teal-400 text-xs font-medium">DNI:</span>
                            <span className="text-teal-800 font-medium">{patient.dni}</span>
                          </span>
                        )}
                        {patient.user.phone && (
                          <span className="md:hidden flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {patient.user.phone}
                          </span>
                        )}
                      </div>

                      {/* === Historial de sesiones === */}
                      <div>
                        <h3 className="text-sm font-semibold text-teal-900 mb-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-teal-500" />
                          Historial de sesiones
                          <span className="text-xs font-normal text-teal-500">
                            ({historial.length}{" "}
                            {historial.length === 1
                              ? "sesión"
                              : "sesiones"})
                          </span>
                        </h3>

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                          {historial.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-3">
                              Sin sesiones registradas todavía.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {historial.map((sesion) => {
                                const style = getAppointmentStatusStyle(
                                  sesion.status
                                );
                                return (
                                  <li
                                    key={sesion.id}
                                    className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0 last:pb-0"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                                        <Clock className="w-4 h-4 text-slate-500" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm text-slate-800 font-medium">
                                          {formatAppointmentDate(sesion.date)}{" "}
                                          · {sesion.time}
                                        </p>
                                        {sesion.reason && (
                                          <p className="text-xs text-slate-500 truncate">
                                            {sesion.reason}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <span
                                      className={`text-xs px-2 py-1 rounded-full border shrink-0 ${style.classes}`}
                                    >
                                      {style.label}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* === Notas privadas === */}
                      <div>
                        <h3 className="text-sm font-semibold text-teal-900 mb-2 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-teal-500" />
                          Notas privadas
                        </h3>

                        <div className="bg-teal-50/40 border border-teal-100 rounded-xl p-4">
                          <textarea
                            value={noteDrafts[patient.id] ?? ""}
                            onChange={(e) =>
                              handleNoteChange(patient.id, e.target.value)
                            }
                            placeholder="Espacio para tus notas clínicas privadas. Solo visible para ti."
                            rows={4}
                            className="w-full text-sm text-slate-800 bg-white border border-teal-200 rounded-lg p-3 resize-y focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 placeholder:text-slate-400"
                          />

                          {/* === Indicador de estado del guardado === */}
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-teal-600 italic">
                              (El paciente y el admin NO pueden leer esto)
                            </p>
                            <div className="text-xs text-teal-500">
                              {savingNoteId === patient.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Guardando…
                                </span>
                              ) : savedNoteId === patient.id ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Guardado
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProfessionalProfile() {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // === Direcciones de atención presencial ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [addresses, setAddresses] = useState<any[]>([]);
  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [newAddrAddress, setNewAddrAddress] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);

  // === Edición inline de direcciones ===
  // El profesional puede editar etiqueta y dirección de cualquier dirección
  // existente. No hay switch de activar/desactivar.
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [editAddrLabel, setEditAddrLabel] = useState("");
  const [editAddrAddress, setEditAddrAddress] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // === Hub de Control Profesional: datos profesionales editables ===
  const [profession, setProfession] = useState("");
  const [license, setLicense] = useState("");
  const [cuil, setCuil] = useState("");
  const [therapyTypes, setTherapyTypes] = useState<string[]>([]);
  const [otherTherapyDetails, setOtherTherapyDetails] = useState("");
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [therapyModality, setTherapyModality] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [onlineAttention, setOnlineAttention] = useState(false);
  const [presentialAttention, setPresentialAttention] = useState(false);
  const [homeAttention, setHomeAttention] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [cvMimeType, setCvMimeType] = useState<string | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [savingProfData, setSavingProfData] = useState(false);

  // === Opciones de tags (iguales que en el formulario de registro) ===
  const PROFESSIONS = [
    "Doctor en Psicología",
    "Estimulador/a Temprana",
    "Fonoaudiólogo/a",
    "Licenciado en Psicología",
    "Musicoterapeuta",
    "Neuropsicólogo",
    "Neuropsicolingüista",
    "Neuropsicomotrista",
    "Nutricionista",
    "Otra",
    "Psicólogo",
    "Psicopedagogo",
    "Psiquiatra",
    "Terapista Ocupacional",
    "Trabajador Social",
  ];
  // SPECIALTIES, THERAPY_TYPES, TARGET_AUDIENCES, THERAPY_MODALITIES
  // importados de @/lib/professional-categories (Single Source of Truth)
  const ZONES_AVAILABLE = [
    "Flores", "Versalles", "Merlo", "Moreno", "Caballito", "Palermo",
    "Belgrano", "Recoleta", "Almagro", "Villa Urquiza", "San Isidro",
    "Tigre", "Martínez", "La Plata", "Pilar", "Tres de Febrero",
    "Morón", "Ituzaingó", "Haedo", "Ramos Mejía", "Lanús", "Avellaneda",
    "Quilmes", "Banfield", "Lomas de Zamora", "San Justo", "Liniers",
    "Floresta", "Devoto", "Villa Devoto", "Saavedra", "Núñez",
  ];

  // === Helper: toggle tag en array ===
  const toggleTag = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setter((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  // === Helper: parsear JSON string a array (con fallback seguro) ===
  const parseJsonArray = (val: unknown): string[] => {
    let arr: string[] = [];
    if (Array.isArray(val)) {
      arr = val;
    } else if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {
        arr = [];
      }
    }
    // === Saneamiento defensivo ===
    // Dedup case-insensitive por si la DB ya tiene entradas duplicadas
    // por un bug previo (ej: "Psicología Clínica" y "Psicología clínica"
    // coexistiendo en el mismo array). Esto sanea la vista del profesional
    // sin necesidad de migración de datos.
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of arr) {
      const trimmed = String(item).trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
    }
    return result;
  };

  useEffect(() => {
    if (session?.user) {
      const userId = (session.user as { id: string }).id;
      fetch("/api/professionals?all=true&includeUnverified=true")
        .then((res) => res.json())
        .then((data) => {
          const profs = Array.isArray(data) ? data : [];
          const prof = profs.find((p: { userId: string }) => p.userId === userId);
          if (prof) {
            setProfessionalId(prof.id);
            setSpecialty(prof.specialty || "");
            setBio(prof.bio || "");
            // === Hub de Control Profesional ===
            setProfession(prof.profession || "");
            setLicense(prof.license || "");
            setCuil(prof.cuil || "");
            setTherapyTypes(parseJsonArray(prof.therapyTypes));
            setOtherTherapyDetails(prof.otherTherapyDetails || "");
            setTargetAudience(parseJsonArray(prof.targetAudience));
            setTherapyModality(parseJsonArray(prof.therapyModality));
            setZones(parseJsonArray(prof.zones));
            setOnlineAttention(prof.onlineAttention || false);
            setPresentialAttention(prof.presentialAttention || false);
            setHomeAttention(prof.homeAttention || false);
            setCvFileName(prof.cvFileName || null);
            setCvMimeType(prof.cvMimeType || null);
            if (prof.user) {
              setPhone(prof.user.phone || "");
            }
            // Cargar direcciones del profesional (con manejo robusto de errores)
            fetch(`/api/professionals/${prof.id}/addresses`)
              .then((r) => {
                if (!r.ok) {
                  console.error("API addresses devolvió status:", r.status);
                  return [];
                }
                // Si la respuesta está vacía (204 o sin body), devolver []
                const text = r.text();
                return text.then((t) => {
                  if (!t || t.trim() === "") return [];
                  try {
                    const parsed = JSON.parse(t);
                    return Array.isArray(parsed) ? parsed : [];
                  } catch {
                    console.error("Respuesta no es JSON válido");
                    return [];
                  }
                });
              })
              .then((addrs) => setAddresses(addrs))
              .catch((err) => {
                console.error("Error cargando direcciones:", err);
                setAddresses([]);
              });
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  // === Agregar nueva dirección ===
  const handleAddAddress = async () => {
    if (!professionalId) {
      toast.error("Primero guardá tu perfil profesional");
      return;
    }
    if (!newAddrLabel.trim() || !newAddrAddress.trim()) {
      toast.error("Completá etiqueta y dirección");
      return;
    }
    setAddingAddress(true);
    try {
      const res = await fetch(`/api/professionals/${professionalId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newAddrLabel.trim(),
          address: newAddrAddress.trim(),
          // Sin isActive: no hay switch de activar/desactivar.
          // Todas las direcciones se pueden enlazar a slots presenciales.
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setAddresses((prev) => [...prev, created]);
        setNewAddrLabel("");
        setNewAddrAddress("");
        toast.success("Dirección agregada");
      } else {
        // Manejo robusto de errores: si el body está vacío o no es JSON,
        // mostrar mensaje genérico con el status code
        let errorMsg = "Error al agregar dirección";
        try {
          const text = await res.text();
          if (text && text.trim() !== "") {
            const data = JSON.parse(text);
            errorMsg = data.error || `Error ${res.status}`;
          } else {
            errorMsg = `Error ${res.status} (respuesta vacía del servidor)`;
          }
        } catch {
          errorMsg = `Error ${res.status} (respuesta no válida)`;
        }
        toast.error(errorMsg);
        console.error("POST addresses error:", res.status, errorMsg);
      }
    } catch {
      toast.error("Error de conexión. Verificá tu conexión a internet.");
    } finally {
      setAddingAddress(false);
    }
  };

  // === Editar dirección (modo inline) ===
  // El profesional puede editar la etiqueta y la dirección de cualquier
  // dirección existente. No hay switch de "activar/desactivar" — todas las
  // direcciones son potencialmente activas y se enlazan a los slots
  // disponibles del profesional cuando la modalidad es presencial.
  const startEditAddress = (addr: { id: string; label: string; address: string }) => {
    setEditingAddrId(addr.id);
    setEditAddrLabel(addr.label);
    setEditAddrAddress(addr.address);
  };

  const cancelEditAddress = () => {
    setEditingAddrId(null);
    setEditAddrLabel("");
    setEditAddrAddress("");
  };

  const handleSaveEditAddress = async () => {
    if (!editingAddrId) return;
    if (!editAddrLabel.trim() || !editAddrAddress.trim()) {
      toast.error("Completá etiqueta y dirección");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/professionals/${professionalId}/addresses/${editingAddrId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: editAddrLabel.trim(),
            address: editAddrAddress.trim(),
          }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setAddresses((prev) =>
          prev.map((a) => (a.id === editingAddrId ? updated : a))
        );
        toast.success("Dirección actualizada");
        cancelEditAddress();
      } else {
        let errorMsg = "Error al actualizar dirección";
        try {
          const text = await res.text();
          if (text) {
            const data = JSON.parse(text);
            errorMsg = data.error || `Error ${res.status}`;
          } else {
            errorMsg = `Error ${res.status} (respuesta vacía)`;
          }
        } catch {
          errorMsg = `Error ${res.status}`;
        }
        toast.error(errorMsg);
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingEdit(false);
    }
  };

  // === Eliminar dirección ===
  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("¿Eliminar esta dirección de atención?")) return;
    try {
      const res = await fetch(
        `/api/professionals/${professionalId}/addresses/${addressId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== addressId));
        toast.success("Dirección eliminada");
      } else {
        toast.error("Error al eliminar dirección");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  // === Hub de Control Profesional: guardar datos profesionales ===
  const handleSaveProfessionalData = async () => {
    if (!professionalId) {
      toast.error("No se pudo identificar tu perfil profesional");
      return;
    }
    // Validar matrícula
    const licenseClean = license.replace(/[\s.-]/g, "");
    const licenseRegex = /^(MN|MP)(\d{4,6})$/;
    if (!licenseRegex.test(licenseClean)) {
      toast.error("La matrícula debe ser MN o MP seguido de 4-6 dígitos (ej: MN-12345)");
      return;
    }
    setSavingProfData(true);
    try {
      const res = await fetch("/api/professionals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: professionalId,
          profession,
          license,
          specialty,
          cuil: cuil || null,
          bio,
          therapyTypes,
          otherTherapyDetails: therapyTypes.includes("Otras terapias") ? otherTherapyDetails : null,
          targetAudience,
          therapyModality,
          zones,
          onlineAttention,
          presentialAttention,
          homeAttention,
        }),
      });
      if (res.ok) {
        toast.success("Datos profesionales actualizados exitosamente");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al actualizar datos profesionales");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingProfData(false);
    }
  };

  // === Cargar/actualizar CV (Dropzone premium) ===
  const handleUploadCv = async (file: File) => {
    if (!professionalId) {
      toast.error("No se pudo identificar tu perfil profesional");
      return;
    }
    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El CV no puede superar los 5 MB");
      return;
    }
    // Validar tipo (PDF, DOC, DOCX)
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) && !["pdf", "doc", "docx"].includes(ext || "")) {
      toast.error("Formato no válido. Solo PDF, DOC o DOCX");
      return;
    }
    setUploadingCv(true);
    try {
      // Convertir a base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        // Quitar el prefijo "data:application/pdf;base64,"
        const base64Data = base64.split(",")[1];
        try {
          const res = await fetch("/api/professionals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: professionalId,
              cvData: base64Data,
              cvFileName: file.name,
              cvMimeType: file.type || `application/${ext}`,
            }),
          });
          if (res.ok) {
            setCvFileName(file.name);
            setCvMimeType(file.type || `application/${ext}`);
            toast.success(`CV "${file.name}" cargado correctamente`);
          } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || "Error al cargar CV");
          }
        } catch {
          toast.error("Error de conexión al cargar CV");
        } finally {
          setUploadingCv(false);
        }
      };
      reader.onerror = () => {
        toast.error("Error al leer el archivo");
        setUploadingCv(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Error inesperado al procesar el CV");
      setUploadingCv(false);
    }
  };

  // === Descargar CV (genera un link de descarga desde el cvData guardado) ===
  const handleDownloadCv = async () => {
    if (!professionalId || !cvFileName) return;
    try {
      // Buscar el cvData del profesional
      const res = await fetch("/api/professionals?all=true&includeUnverified=true");
      const data = await res.json();
      const profs = Array.isArray(data) ? data : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prof = profs.find((p: any) => p.id === professionalId);
      // NOTA: el GET /api/professionals NO devuelve cvData (es muy grande)
      // Necesitamos un endpoint separado para descargarlo. Por ahora,
      // mostramos un mensaje informativo.
      if (!prof?.cvData) {
        toast.info("Para descargar el CV, usá el botón de descarga del panel admin");
        return;
      }
      // Si tuviéramos cvData, crear link de descarga
      const link = document.createElement("a");
      link.href = `data:${cvMimeType || "application/pdf"};base64,${prof.cvData}`;
      link.download = cvFileName;
      link.click();
    } catch {
      toast.error("Error al descargar CV");
    }
  };

  // === Eliminar CV ===
  const handleDeleteCv = async () => {
    if (!professionalId || !cvFileName) return;
    if (!confirm("¿Eliminar tu CV cargado?")) return;
    try {
      const res = await fetch("/api/professionals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: professionalId,
          cvData: null,
          cvFileName: null,
          cvMimeType: null,
        }),
      });
      if (res.ok) {
        setCvFileName(null);
        setCvMimeType(null);
        toast.success("CV eliminado");
      } else {
        toast.error("Error al eliminar CV");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const userId = (session?.user as { id: string })?.id;
      const userRes = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!userRes.ok) {
        toast.error("Error al actualizar perfil");
        setSaving(false);
        return;
      }
      if (professionalId) {
        const profRes = await fetch("/api/professionals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: professionalId, specialty, bio }),
        });
        if (profRes.ok) {
          toast.success("Perfil actualizado");
        } else {
          toast.error("Error al actualizar datos profesionales");
        }
      } else {
        toast.success("Perfil actualizado");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Completá todos los campos de contraseña");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un símbolo");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error("La nueva contraseña debe incluir al menos una letra mayúscula");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>_+\-=]/.test(newPassword)) {
      toast.error("La nueva contraseña debe incluir al menos un símbolo (!, $, #, etc.)");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast.success("Contraseña actualizada exitosamente");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al cambiar la contraseña");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setChangingPassword(false);
    }
  };

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
      <h2 className="text-2xl font-bold text-teal-900">Mi Perfil</h2>
      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2 text-base">
            <UserCheck className="w-4 h-4" />
            Datos Personales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="border-teal-200" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={session?.user?.email || ""} disabled className="border-teal-200 bg-teal-50/50" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 11 xxxx-xxxx" className="border-teal-200" />
            </div>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={saving} onClick={handleSaveProfile}>
            <Save className="mr-2 w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </CardContent>
      </Card>
      {/* ============================================== */}
      {/* HUB DE CONTROL PROFESIONAL — Diseño moderno */}
      {/* ============================================== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-600" />
          <h3 className="text-lg font-bold text-teal-900">Hub de Control Profesional</h3>
        </div>
        <p className="text-xs text-teal-600">
          Actualizá y gestioná tus datos profesionales. Los cambios se reflejan
          automáticamente en tu perfil público y en los emails a pacientes.
        </p>

        {/* === Card 1: Identidad Profesional === */}
        <Card className="border-teal-100 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50/50 rounded-t-lg">
            <CardTitle className="text-teal-900 flex items-center gap-2 text-sm">
              <Award className="w-4 h-4 text-teal-600" />
              Identidad Profesional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-teal-700 font-medium">Profesión</Label>
                <Select value={profession} onValueChange={setProfession}>
                  <SelectTrigger className="border-teal-200 h-9 text-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFESSIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-teal-700 font-medium">Especialidad</Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger className="border-teal-200 h-9 text-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-teal-700 font-medium">Matrícula (MN o MP)</Label>
                <Input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="MN-12345"
                  className="border-teal-200 h-9 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-teal-700 font-medium">CUIT / CUIL</Label>
                <Input
                  value={cuil}
                  onChange={(e) => setCuil(e.target.value)}
                  placeholder="23-12345678-9"
                  className="border-teal-200 h-9 text-sm font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === Card 2: Modalidades de Atención === */}
        <Card className="border-teal-100 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50/50 rounded-t-lg">
            <CardTitle className="text-teal-900 flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-teal-600" />
              Modalidades de Atención
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "online", label: "Online", setter: setOnlineAttention, val: onlineAttention },
                { key: "presential", label: "Presencial", setter: setPresentialAttention, val: presentialAttention },
                { key: "home", label: "A Domicilio", setter: setHomeAttention, val: homeAttention },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => m.setter(!m.val)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    m.val
                      ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                      : "bg-white text-teal-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                  }`}
                >
                  {m.val ? "✓ " : "+ "}{m.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-teal-500 italic">
              Los pacientes verán estas modalidades al buscar profesionales.
            </p>
          </CardContent>
        </Card>

        {/* === Card 3: Tipos de Terapia === */}
        <Card className="border-teal-100 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50/50 rounded-t-lg">
            <CardTitle className="text-teal-900 flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-teal-600" />
              Tipos de Terapia
              <Badge variant="outline" className="text-[9px] bg-teal-50 border-teal-200 text-teal-700 ml-1">
                {therapyTypes.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-1.5">
              {THERAPY_TYPES.map((t) => {
                const selected = therapyTypes.includes(t);
                const isOther = t === "Otras terapias";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(setTherapyTypes, t)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      selected
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "bg-white text-teal-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                    } ${isOther ? "ring-1 ring-amber-300" : ""}`}
                  >
                    {selected ? "✓ " : "+ "}{t}
                  </button>
                );
              })}
            </div>
            {therapyTypes.includes("Otras terapias") && (
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-700 font-medium">
                  Detallá el enfoque de "Otras terapias"
                </Label>
                <Input
                  value={otherTherapyDetails}
                  onChange={(e) => setOtherTherapyDetails(e.target.value)}
                  placeholder="Ej: Terapia contextual, Análisis reichiano..."
                  className="border-amber-200 h-9 text-sm focus:border-amber-400"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* === Card 4: Dirigido a (Población objetivo) === */}
        <Card className="border-teal-100 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50/50 rounded-t-lg">
            <CardTitle className="text-teal-900 flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-teal-600" />
              Dirigido a
              <Badge variant="outline" className="text-[9px] bg-teal-50 border-teal-200 text-teal-700 ml-1">
                {targetAudience.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-1.5">
              {TARGET_AUDIENCES.map((t) => {
                const selected = targetAudience.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(setTargetAudience, t)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      selected
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "bg-white text-teal-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}{t}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* === Card 5: Modalidad de Terapia === */}
        <Card className="border-teal-100 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50/50 rounded-t-lg">
            <CardTitle className="text-teal-900 flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-teal-600" />
              Modalidad de Terapia
              <Badge variant="outline" className="text-[9px] bg-teal-50 border-teal-200 text-teal-700 ml-1">
                {therapyModality.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-1.5">
              {THERAPY_MODALITIES.map((t) => {
                const selected = therapyModality.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(setTherapyModality, t)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      selected
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "bg-white text-teal-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}{t}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* === Card 6: Zonas de Atención === */}
        <Card className="border-teal-100 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50/50 rounded-t-lg">
            <CardTitle className="text-teal-900 flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-teal-600" />
              Zonas de Atención
              <Badge variant="outline" className="text-[9px] bg-teal-50 border-teal-200 text-teal-700 ml-1">
                {zones.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {(presentialAttention || homeAttention) ? (
              <>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-1">
                  {ZONES_AVAILABLE.map((z) => {
                    const selected = zones.includes(z);
                    return (
                      <button
                        key={z}
                        type="button"
                        onClick={() => toggleTag(setZones, z)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                          selected
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "bg-white text-teal-700 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                        }`}
                      >
                        {selected ? "✓ " : "+ "}{z}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-teal-500 italic">
                  Mostrá en qué zonas ofrecés atención presencial o a domicilio.
                </p>
              </>
            ) : (
              <p className="text-xs text-teal-500 italic py-2">
                Activá "Presencial" o "A Domicilio" en Modalidades de Atención para seleccionar zonas.
              </p>
            )}
          </CardContent>
        </Card>

        {/* === Card 7: Sobre tu Práctica (Bio) === */}
        <Card className="border-teal-100 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50/50 rounded-t-lg">
            <CardTitle className="text-teal-900 flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-teal-600" />
              Sobre tu Práctica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Breve descripción de tu formación, experiencia y enfoque de trabajo..."
              className="w-full min-h-[120px] rounded-md border border-teal-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
              rows={5}
            />
            <p className="text-[10px] text-teal-500">
              {bio.length} caracteres · Recomendado: 200-500 caracteres
            </p>
          </CardContent>
        </Card>

        {/* === Card 8: CV / Curriculum (Dropzone premium) === */}
        <Card className="border-teal-100 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50/50 rounded-t-lg">
            <CardTitle className="text-teal-900 flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-teal-600" />
              CV / Curriculum Vitae
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {cvFileName ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-teal-200 bg-teal-50/50">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-teal-900 truncate">{cvFileName}</p>
                    <p className="text-[10px] text-teal-500">
                      {cvMimeType?.includes("pdf") ? "PDF" : "Word"} · Cargado
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadCv}
                    className="h-8 w-8 p-0 text-teal-600 hover:bg-teal-100"
                    title="Descargar CV"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteCv}
                    className="h-8 w-8 p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar CV"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="cv-upload"
                className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-teal-200 rounded-lg cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition-all group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  uploadingCv ? "bg-teal-100" : "bg-teal-50 group-hover:bg-teal-100"
                }`}>
                  {uploadingCv ? (
                    <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-teal-600" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-teal-900">
                    {uploadingCv ? "Cargando..." : "Cargar CV"}
                  </p>
                  <p className="text-[10px] text-teal-500 mt-0.5">
                    PDF, DOC o DOCX · Máx 5 MB
                  </p>
                </div>
                <input
                  id="cv-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadCv(file);
                    e.target.value = ""; // reset para poder volver a subir el mismo
                  }}
                  disabled={uploadingCv}
                />
              </label>
            )}
            {cvFileName && (
              <label
                htmlFor="cv-replace"
                className="flex items-center justify-center gap-1.5 p-2 border border-teal-200 rounded-md cursor-pointer hover:bg-teal-50/50 transition-all text-xs text-teal-600"
              >
                <Upload className="w-3 h-3" />
                {uploadingCv ? "Cargando..." : "Reemplazar CV"}
                <input
                  id="cv-replace"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadCv(file);
                    e.target.value = "";
                  }}
                  disabled={uploadingCv}
                />
              </label>
            )}
          </CardContent>
        </Card>

        {/* === Botón Guardar todo el Hub === */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm py-3 border-t border-teal-100 -mx-4 px-4">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-md"
            disabled={savingProfData}
            onClick={handleSaveProfessionalData}
          >
            <Save className="mr-2 w-4 h-4" />
            {savingProfData ? "Guardando..." : "Guardar Datos Profesionales"}
          </Button>
        </div>
      </div>

      {/* ============================================== */}
      {/* Dirección de Atención Presencial (múltiples) */}
      {/* ============================================== */}
      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4" />
            Dirección de Atención Presencial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-teal-600">
            Agregá una o más direcciones de consultorio.
          </p>

          {/* === Lista de direcciones existentes === */}
          {addresses.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-teal-200 rounded-lg bg-teal-50/30">
              <MapPin className="w-6 h-6 text-teal-400 mx-auto mb-2" />
              <p className="text-xs text-teal-600">
                Todavía no agregaste ninguna dirección de atención presencial.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-3 rounded-lg border transition-all ${
                    editingAddrId === addr.id
                      ? "border-teal-500 bg-teal-50 ring-1 ring-teal-300"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  {/* === Modo vista (no editando) === */}
                  {editingAddrId !== addr.id ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-semibold text-teal-900 truncate">
                              {addr.label}
                            </p>
                            <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200 text-slate-500 px-1.5 py-0 font-mono" title={`ID completo: ${addr.id}`}>
                              ID: {addr.id.slice(-8)}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 truncate">{addr.address}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditAddress(addr)}
                            className="h-7 w-7 p-0 text-teal-500 hover:bg-teal-50 hover:text-teal-700"
                            title="Editar dirección"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="h-7 w-7 p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar dirección"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* === Modo edición === */
                    <div className="space-y-2">
                      <div className="grid sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-1">
                          <Input
                            value={editAddrLabel}
                            onChange={(e) => setEditAddrLabel(e.target.value)}
                            placeholder="Etiqueta"
                            className="border-teal-200 h-9 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Input
                            value={editAddrAddress}
                            onChange={(e) => setEditAddrAddress(e.target.value)}
                            placeholder="Dirección completa"
                            className="border-teal-200 h-9 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !savingEdit) {
                                e.preventDefault();
                                handleSaveEditAddress();
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveEditAddress}
                          disabled={savingEdit}
                          size="sm"
                          className="bg-teal-600 hover:bg-teal-700 text-white h-7"
                        >
                          <Save className="mr-1 w-3 h-3" />
                          {savingEdit ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          onClick={cancelEditAddress}
                          disabled={savingEdit}
                          variant="outline"
                          size="sm"
                          className="border-slate-300 text-slate-600 hover:bg-slate-50 h-7"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* === Formulario para agregar nueva dirección === */}
          <div className="border border-teal-200 rounded-lg p-3 bg-teal-50/30 space-y-2">
            <p className="text-xs font-medium text-teal-700">Agregar nueva dirección</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <Input
                  value={newAddrLabel}
                  onChange={(e) => setNewAddrLabel(e.target.value)}
                  placeholder="Etiqueta (ej: Consultorio Principal)"
                  className="border-teal-200 h-9 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  value={newAddrAddress}
                  onChange={(e) => setNewAddrAddress(e.target.value)}
                  placeholder="Dirección completa (ej: Av. Cabildo 1234, Piso 3, Belgrano, CABA)"
                  className="border-teal-200 h-9 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !addingAddress) {
                      e.preventDefault();
                      handleAddAddress();
                    }
                  }}
                />
              </div>
            </div>
            <Button
              onClick={handleAddAddress}
              disabled={addingAddress}
              variant="outline"
              size="sm"
              className="border-teal-300 text-teal-600 hover:bg-teal-50"
            >
              <Plus className="mr-1 w-3.5 h-3.5" />
              {addingAddress ? "Agregando..." : "Agregar Dirección"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2 text-base">
            <Lock className="w-4 h-4" />
            Cambiar Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Contraseña actual</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Ingresá tu contraseña actual"
                className="border-teal-200 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingresá tu nueva contraseña"
                  className="border-teal-200 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* === Micro-badges de validación en tiempo real === */}
              {(() => {
                const hasMinLength = newPassword.length >= 8;
                const hasUppercase = /[A-Z]/.test(newPassword);
                const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_+\-=]/.test(newPassword);
                return (
                  <div className={`flex flex-col gap-0.5 pt-1 transition-opacity ${newPassword ? "opacity-100" : "opacity-0"}`}>
                    <span className={`text-[10px] flex items-center gap-1 transition-colors ${hasMinLength ? "text-emerald-600" : "text-slate-400"}`}>
                      {hasMinLength ? "✓" : "•"} Mínimo 8 caracteres
                    </span>
                    <span className={`text-[10px] flex items-center gap-1 transition-colors ${hasUppercase ? "text-emerald-600" : "text-slate-400"}`}>
                      {hasUppercase ? "✓" : "•"} Una mayúscula
                    </span>
                    <span className={`text-[10px] flex items-center gap-1 transition-colors ${hasSpecialChar ? "text-emerald-600" : "text-slate-400"}`}>
                      {hasSpecialChar ? "✓" : "•"} Un símbolo (!, $, #...)
                    </span>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label>Confirmar nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetir nueva contraseña"
                  className={`pr-10 transition-colors ${
                    confirmPassword && confirmPassword === newPassword
                      ? "border-emerald-400 focus:ring-emerald-300/20"
                      : confirmPassword
                        ? "border-red-400 focus:ring-red-300/20"
                        : "border-teal-200"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* === Indicador de coincidencia === */}
              {confirmPassword && (
                <div className={`text-[10px] flex items-center gap-1 transition-colors ${
                  confirmPassword === newPassword ? "text-emerald-600" : "text-red-500"
                }`}>
                  {confirmPassword === newPassword
                    ? <>✓ Las contraseñas coinciden</>
                    : <>✗ Las contraseñas no coinciden</>
                  }
                </div>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="border-teal-300 text-teal-600 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              changingPassword ||
              !(
                newPassword.length >= 8 &&
                /[A-Z]/.test(newPassword) &&
                /[!@#$%^&*(),.?":{}|<>_+\-=]/.test(newPassword) &&
                newPassword === confirmPassword
              )
            }
            onClick={handleChangePassword}
          >
            <Lock className="mr-2 w-4 h-4" />
            {changingPassword ? "Cambiando..." : "Cambiar Contraseña"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
