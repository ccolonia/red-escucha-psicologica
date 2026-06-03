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
  Plus,
  AlertCircle,
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
import { ProfessionalWeeklyAgenda } from "@/components/professional-weekly-agenda";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";

interface Appointment {
  id: string;
  date: string;
  time: string;
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
  absent: { label: "Ausente", variant: "outline" },
  rescheduled: { label: "Reprogramado", variant: "outline" },
};

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
    notes?: string
  ) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status, notes: notes || a.notes } : a))
        );
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
    } catch {
      toast.error("Error al actualizar turno");
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
                          <p className="text-sm text-teal-600">
                            {apt.time} hs
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
                            handleStatusUpdate(apt.id, "cancelled")
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
                        <p className="text-sm text-teal-600">
                          {apt.date} • {apt.time} hs
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
                            handleStatusUpdate(apt.id, "cancelled")
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
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [activeTab, setActiveTab] = useState("agenda");

  // Load professional ID
  useEffect(() => {
    if (session?.user) {
      const userId = (session.user as { id: string }).id;
      fetch("/api/professionals")
        .then((res) => res.json())
        .then((data) => {
          const prof = Array.isArray(data)
            ? data.find((p: { userId: string }) => p.userId === userId)
            : null;
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
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a))
        );
        toast.success("Turno cancelado");
      }
    } catch {
      toast.error("Error al cancelar");
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

  // Group by date
  const grouped = appointments
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .reduce<Record<string, Appointment[]>>((acc, apt) => {
      if (!acc[apt.date]) acc[apt.date] = [];
      acc[apt.date].push(apt);
      return acc;
    }, {});

  return (
    <div>
      {/* Header with title and new appointment button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-teal-900">Mi Agenda</h2>
        <Button
          onClick={() => setShowNewAppointment(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="mr-2 w-4 h-4" />
          Nuevo Turno
        </Button>
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
                        ? "Hoy"
                        : date}
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
                                {apt.time} hs
                              </p>
                              <p className="text-sm font-semibold text-teal-900">
                                {apt.patient.user.name}
                              </p>
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

      {/* New appointment dialog */}
      {professionalId && (
        <NewAppointmentDialog
          open={showNewAppointment}
          onOpenChange={setShowNewAppointment}
          professionalId={professionalId}
          onSuccess={loadAppointments}
        />
      )}
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

  useEffect(() => {
    if (session?.user) {
      const userId = (session.user as { id: string }).id;
      fetch("/api/professionals")
        .then((res) => res.json())
        .then((data) => {
          const prof = Array.isArray(data)
            ? data.find((p: { userId: string }) => p.userId === userId)
            : null;
          if (prof) {
            setProfessionalId(prof.id);
            setSpecialty(prof.specialty || "");
            setBio(prof.bio || "");
            if (prof.user) {
              setPhone(prof.user.phone || "");
            }
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

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
