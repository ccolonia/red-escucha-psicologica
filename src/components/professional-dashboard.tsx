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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

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
  completed: { label: "Completado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
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
    status: string
  ) => {
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
          status === "confirmed"
            ? "Turno confirmado"
            : status === "completed"
            ? "Turno completado"
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
                      <div className="mt-3 ml-13">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "completed")
                          }
                        >
                          <CheckCircle2 className="mr-1 w-3 h-3" />
                          Marcar Completado
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

  const handleStatusUpdate = async (id: string, status: string) => {
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
        toast.success("Estado actualizado");
      }
    } catch {
      toast.error("Error al actualizar");
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
      <h2 className="text-2xl font-bold text-teal-900 mb-6">Mi Agenda</h2>
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
                    className="flex items-center justify-between p-3 bg-teal-50/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-100 rounded flex items-center justify-center">
                        <Clock className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-teal-900">
                          {apt.time} hs — {apt.patient.user.name}
                        </p>
                        {apt.reason && (
                          <p className="text-xs text-teal-500">{apt.reason}</p>
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
                      {apt.status === "confirmed" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() =>
                            handleStatusUpdate(apt.id, "completed")
                          }
                        >
                          Completar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
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
