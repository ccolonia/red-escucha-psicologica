"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
      fetch("/api/professionals?all=true")
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

export function ProfessionalPatients() {
  const [patients, setPatients] = useState<
    { id: string; user: { name: string; email: string; phone: string } }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data) => {
        setPatients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-teal-900 mb-6">Pacientes</h2>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-teal-200 mx-auto" />
            <p className="text-teal-600 mt-2">No hay pacientes registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => (
            <Card key={patient.id} className="border-teal-100">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-medium text-teal-900">
                    {patient.user.name}
                  </p>
                  <p className="text-sm text-teal-600">{patient.user.email}</p>
                  {patient.user.phone && (
                    <p className="text-sm text-teal-500">{patient.user.phone}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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

  // === Direcciones de atención presencial ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [addresses, setAddresses] = useState<any[]>([]);
  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [newAddrAddress, setNewAddrAddress] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [togglingAddrId, setTogglingAddrId] = useState<string | null>(null);

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
            setSpecialty(prof.specialty || "");
            setBio(prof.bio || "");
            if (prof.user) {
              setPhone(prof.user.phone || "");
            }
            // Cargar direcciones del profesional
            fetch(`/api/professionals/${prof.id}/addresses`)
              .then((r) => r.json())
              .then((addrs) => {
                if (Array.isArray(addrs)) setAddresses(addrs);
              })
              .catch((err) => console.error("Error cargando direcciones:", err));
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
          isActive: addresses.length === 0, // Primera dirección → activar automáticamente
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setAddresses((prev) => [...prev, created]);
        setNewAddrLabel("");
        setNewAddrAddress("");
        toast.success("Dirección agregada");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al agregar dirección");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setAddingAddress(false);
    }
  };

  // === Toggle isActive (instantáneo) ===
  // Si se activa una dirección, el backend desactiva las demás automáticamente
  // (transaccional). Si se desactiva, simplemente queda inactiva.
  const handleToggleAddress = async (addressId: string, currentIsActive: boolean) => {
    setTogglingAddrId(addressId);
    try {
      const res = await fetch(
        `/api/professionals/${professionalId}/addresses/${addressId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !currentIsActive }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        // Update local state: si se activó esta, desactivar las demás
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === addressId) return updated;
            if (updated.isActive && a.isActive) return { ...a, isActive: false };
            return a;
          })
        );
        toast.success(
          updated.isActive
            ? "Dirección activada como dirección de atención actual"
            : "Dirección desactivada"
        );
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al cambiar estado");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setTogglingAddrId(null);
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
    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
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
      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2 text-base">
            <Stethoscope className="w-4 h-4" />
            Datos Profesionales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Especialidad</Label>
              <Select value={specialty} onValueChange={(value) => setSpecialty(value)}>
                <SelectTrigger className="border-teal-200">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Psicología Clínica">Psicología Clínica</SelectItem>
                  <SelectItem value="Terapia de Pareja y Familia">Terapia de Pareja y Familia</SelectItem>
                  <SelectItem value="Psicología Infanto-Juvenil">Psicología Infanto-Juvenil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Biografía / Presentación</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Breve descripción de tu formación y experiencia..."
              className="w-full min-h-[100px] rounded-md border border-teal-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              rows={4}
            />
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={saving} onClick={handleSaveProfile}>
            <Save className="mr-2 w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Datos Profesionales"}
          </Button>
        </CardContent>
      </Card>

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
            Agregá una o más direcciones de consultorio. Activá la dirección donde
            estás atendiendo actualmente con el interruptor — solo una puede estar
            activa a la vez y el cambio es inmediato.
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
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    addr.isActive
                      ? "border-teal-500 bg-teal-50 ring-1 ring-teal-300"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-teal-900 truncate">
                        {addr.label}
                      </p>
                      {addr.isActive && (
                        <Badge variant="outline" className="text-[9px] bg-teal-100 border-teal-300 text-teal-700 px-1.5 py-0">
                          ● Activa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 truncate">{addr.address}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Label htmlFor={`switch-${addr.id}`} className="text-[10px] text-slate-500 cursor-pointer">
                      {addr.isActive ? "Activa" : "Inactiva"}
                    </Label>
                    <Switch
                      id={`switch-${addr.id}`}
                      checked={addr.isActive}
                      disabled={togglingAddrId === addr.id}
                      onCheckedChange={() => handleToggleAddress(addr.id, addr.isActive)}
                    />
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
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Ingresá tu contraseña actual" className="border-teal-200" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="border-teal-200" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nueva contraseña</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetir nueva contraseña" className="border-teal-200" />
            </div>
          </div>
          <Button variant="outline" className="border-teal-300 text-teal-600 hover:bg-teal-50" disabled={changingPassword} onClick={handleChangePassword}>
            <Lock className="mr-2 w-4 h-4" />
            {changingPassword ? "Cambiando..." : "Cambiar Contraseña"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
