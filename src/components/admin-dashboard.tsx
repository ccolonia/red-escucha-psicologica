"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Stethoscope,
  Calendar,
  CalendarPlus,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Phone,
  UserPlus,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Download,
  MessageSquare,
  Pencil,
  Trash2,
  Lock,
  Save,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";

// ---- Admin Stats / Dashboard ----

interface Stats {
  totalPatients: number;
  totalProfessionals: number;
  activeProfessionals: number;
  appointmentsToday: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  absentAppointments: number;
  rescheduledAppointments: number;
  last7Days: { date: string; count: number }[];
  totalContactRequests: number;
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  reason: string | null;
  createdAt: string;
  patient: { user: { name: string; email: string } };
  professional: { user: { name: string }; specialty: string };
}

interface Professional {
  id: string;
  userId: string;
  license: string;
  licenseVerified: boolean;
  specialty: string;
  available: boolean;
  title: string | null;
  profession: string | null;
  cuil: string | null;
  gender: string | null;
  therapyTypes: string | null;
  targetAudience: string | null;
  therapyModality: string | null;
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  zones: string | null;
  bio: string | null;
  cvFileName: string | null;
  createdAt: string;
  user: { name: string; email: string; phone: string; active: boolean; createdAt: string };
}

interface ContactRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  reason: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "default" },
  completed: { label: "Atendido", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  absent: { label: "Ausente", variant: "outline" },
  rescheduled: { label: "Reprogramado", variant: "outline" },
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar estadísticas");
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-teal-50 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const chartData = stats.last7Days.map((d) => ({
    fecha: d.date.slice(5), // MM-DD
    turnos: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Panel de Administración</h1>
        <p className="text-teal-100 mt-1">
          Resumen general de la red
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-teal-100">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-teal-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {stats.totalPatients}
            </p>
            <p className="text-sm text-teal-600">Pacientes</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 text-center">
            <Stethoscope className="w-6 h-6 text-teal-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {stats.totalProfessionals}
            </p>
            <p className="text-sm text-teal-600">Profesionales</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {stats.appointmentsToday}
            </p>
            <p className="text-sm text-teal-600">Turnos hoy</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-orange-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {stats.pendingAppointments}
            </p>
            <p className="text-sm text-teal-600">Pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Turnos - Últimos 7 días
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0f2f1" />
                <XAxis dataKey="fecha" stroke="#0d9488" fontSize={12} />
                <YAxis stroke="#0d9488" fontSize={12} />
                <Tooltip />
                <Bar dataKey="turnos" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-teal-100">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-lg font-bold text-teal-900">
                {stats.completedAppointments}
              </p>
              <p className="text-xs text-teal-600">Atendidos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-teal-500" />
            <div>
              <p className="text-lg font-bold text-teal-900">
                {stats.confirmedAppointments}
              </p>
              <p className="text-xs text-teal-600">Confirmados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-lg font-bold text-teal-900">
                {stats.pendingAppointments}
              </p>
              <p className="text-xs text-teal-600">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-lg font-bold text-teal-900">
                {stats.cancelledAppointments}
              </p>
              <p className="text-xs text-teal-600">Cancelados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-lg font-bold text-teal-900">
                {stats.absentAppointments}
              </p>
              <p className="text-xs text-teal-600">Ausentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-lg font-bold text-teal-900">
                {stats.rescheduledAppointments}
              </p>
              <p className="text-xs text-teal-600">Reprogramados</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---- Admin Appointments ----

export function AdminAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewAppointment, setShowNewAppointment] = useState(false);

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

  const filtered =
    statusFilter === "all"
      ? appointments
      : appointments.filter((a) => a.status === statusFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-teal-900">Turnos</h2>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowNewAppointment(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <CalendarPlus className="mr-2 w-4 h-4" />
            Nuevo Turno
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 border-teal-200">
              <SelectValue placeholder="Filtrar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
              <SelectItem value="completed">Atendidos</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
              <SelectItem value="absent">Ausentes</SelectItem>
              <SelectItem value="rescheduled">Reprogramados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 text-teal-200 mx-auto" />
            <p className="text-teal-600 mt-2">No hay turnos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
          {filtered.map((apt) => (
            <Card key={apt.id} className="border-teal-100">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-teal-900">
                      {apt.patient.user.name}
                    </p>
                    <p className="text-sm text-teal-600">
                      con {apt.professional.user.name} •{" "}
                      {apt.professional.specialty}
                    </p>
                    <p className="text-sm text-teal-500">
                      {apt.date} • {apt.time} hs
                    </p>
                    {apt.createdAt && (
                      <p className="text-xs text-teal-400 mt-0.5">
                        Solicitado: {new Date(apt.createdAt).toLocaleDateString("es-AR")}
                      </p>
                    )}
                    {apt.reason && (
                      <p className="text-xs text-teal-400 mt-1">
                        {apt.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant={
                        STATUS_MAP[apt.status]?.variant || "outline"
                      }
                    >
                      {STATUS_MAP[apt.status]?.label || apt.status}
                    </Badge>
                    {apt.status === "pending" && (
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs"
                        onClick={() =>
                          handleStatusUpdate(apt.id, "confirmed")
                        }
                      >
                        Confirmar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewAppointmentDialog
        open={showNewAppointment}
        onOpenChange={setShowNewAppointment}
        professionalId=""
        isAdmin={true}
        onCreated={() => {
          // Refresh appointments list
          fetch("/api/appointments")
            .then((res) => res.json())
            .then((data) => setAppointments(data))
            .catch(() => {});
        }}
      />
    </div>
  );
}

// ---- Admin Professionals ----

export function AdminProfessionals() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    license: "",
    specialty: "",
    bio: "",
    password: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    license: "",
    specialty: "",
    bio: "",
  });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfessionals = () => {
    fetch("/api/professionals")
      .then((res) => res.json())
      .then((data) => {
        setProfessionals(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadProfessionals();
  }, []);

  const pendingCount = professionals.filter((p) => !p.user.active).length;
  const unverifiedLicenseCount = professionals.filter((p) => !p.licenseVerified).length;

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) {
        setProfessionals((prev) =>
          prev.map((p) =>
            p.userId === userId
              ? { ...p, user: { ...p.user, active: !currentActive } }
              : p
          )
        );

        // If approving (activating), send approval email with password setup link
        if (!currentActive) {
          toast.success("Cuenta activada. Enviando email de bienvenida...");
          try {
            const emailRes = await fetch("/api/auth/approve-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            });
            if (emailRes.ok) {
              toast.success("Email de bienvenida enviado exitosamente");
            } else {
              const emailData = await emailRes.json();
              toast.error(emailData.error || "Error al enviar el email de bienvenida");
            }
          } catch {
            toast.error("Error al enviar el email de bienvenida");
          }
        } else {
          toast.success("Cuenta desactivada");
        }
      } else {
        toast.error("Error al actualizar cuenta");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleToggleAvailable = async (id: string, available: boolean) => {
    try {
      const res = await fetch("/api/professionals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, available: !available }),
      });
      if (res.ok) {
        setProfessionals((prev) =>
          prev.map((p) => (p.id === id ? { ...p, available: !available } : p))
        );
        toast.success(available ? "Profesional desactivado" : "Profesional activado");
      } else {
        toast.error("Error al actualizar");
      }
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleToggleLicenseVerified = async (id: string, currentVerified: boolean) => {
    try {
      const res = await fetch("/api/professionals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, licenseVerified: !currentVerified }),
      });
      if (res.ok) {
        setProfessionals((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, licenseVerified: !currentVerified } : p
          )
        );
        toast.success(
          currentVerified
            ? "Matrícula desmarcada como verificada"
            : "Matrícula verificada exitosamente"
        );
      } else {
        toast.error("Error al verificar matrícula");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleAddProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.password || addForm.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!addForm.license || !addForm.specialty) {
      toast.error("Matrícula y especialidad son obligatorias");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          email: addForm.email,
          phone: addForm.phone,
          password: addForm.password,
          role: "professional",
          license: addForm.license,
          specialty: addForm.specialty,
          bio: addForm.bio,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Error al crear profesional");
        setAdding(false);
        return;
      }

      toast.success("Profesional agregado exitosamente");
      setShowAdd(false);
      setAddForm({
        name: "",
        email: "",
        phone: "",
        license: "",
        specialty: "",
        bio: "",
        password: "",
      });
      setTimeout(() => loadProfessionals(), 500);
    } catch {
      toast.error("Error al agregar profesional");
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (prof: Professional) => {
    setEditingId(prof.id);
    setEditForm({
      name: prof.user.name,
      email: prof.user.email,
      phone: prof.user.phone || "",
      license: prof.license,
      specialty: prof.specialty,
      bio: "",
    });
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      // Find the professional to get userId
      const prof = professionals.find((p) => p.id === id);

      const res = await fetch("/api/professionals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          license: editForm.license,
          specialty: editForm.specialty,
          bio: editForm.bio || null,
        }),
      });
      if (res.ok) {
        // Also update user name/phone
        if (prof?.userId) {
          await fetch(`/api/users/${prof.userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: editForm.name, phone: editForm.phone }),
          });
        }
        toast.success("Profesional actualizado");
        setEditingId(null);
        loadProfessionals();
      } else {
        toast.error("Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que querés eliminar este profesional?")) return;
    try {
      const res = await fetch(`/api/professionals?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Profesional eliminado");
        loadProfessionals();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-teal-900">Profesionales</h2>
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
          {unverifiedLicenseCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              {unverifiedLicenseCount} sin verificar
            </span>
          )}
        </div>
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => setShowAdd(!showAdd)}
        >
          <UserPlus className="mr-2 w-4 h-4" />
          Agregar
        </Button>
      </div>

      {showAdd && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card className="border-teal-200 mb-6">
            <CardHeader>
              <CardTitle className="text-teal-900">
                Nuevo Profesional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddProfessional} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre completo *</Label>
                    <Input
                      required
                      value={addForm.name}
                      onChange={(e) =>
                        setAddForm({ ...addForm, name: e.target.value })
                      }
                      className="border-teal-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      required
                      value={addForm.email}
                      onChange={(e) =>
                        setAddForm({ ...addForm, email: e.target.value })
                      }
                      className="border-teal-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={addForm.phone}
                      onChange={(e) =>
                        setAddForm({ ...addForm, phone: e.target.value })
                      }
                      placeholder="+54 11 xxxx-xxxx"
                      className="border-teal-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Matrícula *</Label>
                    <Input
                      required
                      value={addForm.license}
                      onChange={(e) =>
                        setAddForm({ ...addForm, license: e.target.value })
                      }
                      placeholder="MN-XXXXX"
                      className="border-teal-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Especialidad *</Label>
                    <Select
                      value={addForm.specialty}
                      onValueChange={(value) =>
                        setAddForm({ ...addForm, specialty: value })
                      }
                    >
                      <SelectTrigger className="border-teal-200">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Psicología Clínica">
                          Psicología Clínica
                        </SelectItem>
                        <SelectItem value="Terapia de Pareja y Familia">
                          Terapia de Pareja y Familia
                        </SelectItem>
                        <SelectItem value="Psicología Infanto-Juvenil">
                          Psicología Infanto-Juvenil
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contraseña *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        required
                        value={addForm.password}
                        onChange={(e) =>
                          setAddForm({ ...addForm, password: e.target.value })
                        }
                        placeholder="Mínimo 6 caracteres"
                        className="border-teal-200 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-teal-400">El profesional podrá cambiarla después</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={adding}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {adding ? "Agregando..." : "Agregar Profesional"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAdd(false)}
                    className="border-teal-300"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {professionals.map((prof) => {
            const isActive = prof.user.active;
            const isExpanded = expandedId === prof.id;
            const parsedTherapyTypes = prof.therapyTypes ? JSON.parse(prof.therapyTypes) : [];
            const parsedTargetAudience = prof.targetAudience ? JSON.parse(prof.targetAudience) : [];
            const parsedTherapyModality = prof.therapyModality ? JSON.parse(prof.therapyModality) : [];
            const parsedZones = prof.zones ? JSON.parse(prof.zones) : [];
            return (
              <Card key={prof.id} className={`border-teal-100 ${!isActive ? "border-l-4 border-l-amber-400" : ""}`}>
                <CardContent className="p-4">
                  {editingId === prof.id ? (
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre completo</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="border-teal-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={editForm.email}
                            disabled
                            className="border-teal-200 bg-teal-50/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Teléfono</Label>
                          <Input
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="border-teal-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Matrícula</Label>
                          <Input
                            value={editForm.license}
                            onChange={(e) => setEditForm({ ...editForm, license: e.target.value })}
                            className="border-teal-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Especialidad</Label>
                          <Select
                            value={editForm.specialty}
                            onValueChange={(value) => setEditForm({ ...editForm, specialty: value })}
                          >
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-teal-600 hover:bg-teal-700 text-white h-8"
                          disabled={saving}
                          onClick={() => handleSaveEdit(prof.id)}
                        >
                          <Save className="mr-1 w-3 h-3" />
                          {saving ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-teal-200"
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isActive ? "bg-teal-100" : "bg-amber-100"
                            }`}
                          >
                            <Stethoscope
                              className={`w-5 h-5 ${
                                isActive ? "text-teal-600" : "text-amber-500"
                              }`}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-teal-900">{prof.user.name}</p>
                              {!isActive && (
                                <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                                  Pendiente de aprobación
                                </Badge>
                              )}
                              {prof.licenseVerified ? (
                                <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700">
                                  <ShieldCheck className="w-3 h-3 mr-0.5" />
                                  Matrícula verificada
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-600">
                                  <ShieldAlert className="w-3 h-3 mr-0.5" />
                                  Matrícula sin verificar
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-teal-600">
                              {prof.specialty} • MP: {prof.license}
                            </p>
                            <p className="text-sm text-teal-500">{prof.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isActive && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                              onClick={() => handleToggleActive(prof.userId, false)}
                            >
                              <CheckCircle2 className="mr-1 w-3.5 h-3.5" />
                              Aprobar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 text-xs ${
                              prof.licenseVerified
                                ? "border-emerald-200 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                : "border-red-200 text-red-600 hover:text-red-800 hover:bg-red-50"
                            }`}
                            onClick={() => handleToggleLicenseVerified(prof.id, prof.licenseVerified)}
                            title={prof.licenseVerified ? "Desmarcar verificación de matrícula" : "Verificar matrícula"}
                          >
                            {prof.licenseVerified ? (
                              <><ShieldCheck className="mr-1 w-3.5 h-3.5" /> Verificada</>
                            ) : (
                              <><ShieldAlert className="mr-1 w-3.5 h-3.5" /> Verificar</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-teal-200 text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                            onClick={() => setExpandedId(isExpanded ? null : prof.id)}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                          {isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-teal-200"
                              onClick={() => handleToggleAvailable(prof.id, prof.available)}
                            >
                              {prof.available ? "Desactivar" : "Activar"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-teal-200 text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                            onClick={() => handleEdit(prof)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-red-200 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(prof.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 pt-4 border-t border-teal-100 space-y-3"
                        >
                          <div className="grid sm:grid-cols-2 gap-3 text-sm">
                            {prof.profession && (
                              <div>
                                <span className="text-teal-500">Profesión:</span>{" "}
                                <span className="text-teal-800">{prof.profession}</span>
                              </div>
                            )}
                            {prof.cuil && (
                              <div>
                                <span className="text-teal-500">CUIT/CUIL:</span>{" "}
                                <span className="text-teal-800">{prof.cuil}</span>
                              </div>
                            )}
                            {prof.gender && (
                              <div>
                                <span className="text-teal-500">Sexo:</span>{" "}
                                <span className="text-teal-800">{prof.gender}</span>
                              </div>
                            )}
                            {prof.user.phone && (
                              <div>
                                <span className="text-teal-500">Teléfono:</span>{" "}
                                <span className="text-teal-800">{prof.user.phone}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 text-sm">
                            <span className="text-teal-500">Modalidad de atención:</span>
                            {prof.onlineAttention && (
                              <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">Online</Badge>
                            )}
                            {prof.presentialAttention && (
                              <Badge variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-700">Presencial</Badge>
                            )}
                            {prof.homeAttention && (
                              <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">Domicilio</Badge>
                            )}
                          </div>

                          {parsedTherapyTypes.length > 0 && (
                            <div>
                              <p className="text-teal-500 text-sm mb-1">Tipos de terapia:</p>
                              <div className="flex flex-wrap gap-1">
                                {parsedTherapyTypes.map((t: string) => (
                                  <Badge key={t} variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-700">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {parsedTargetAudience.length > 0 && (
                            <div>
                              <p className="text-teal-500 text-sm mb-1">Dirigido a:</p>
                              <div className="flex flex-wrap gap-1">
                                {parsedTargetAudience.map((t: string) => (
                                  <Badge key={t} variant="outline" className="text-xs bg-sage-50 border-sage-200 text-sage-700">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {parsedTherapyModality.length > 0 && (
                            <div>
                              <p className="text-teal-500 text-sm mb-1">Modalidad de terapia:</p>
                              <div className="flex flex-wrap gap-1">
                                {parsedTherapyModality.map((m: string) => (
                                  <Badge key={m} variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700">{m}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {parsedZones.length > 0 && (
                            <div>
                              <p className="text-teal-500 text-sm mb-1">Zonas de atención:</p>
                              <div className="flex flex-wrap gap-1">
                                {parsedZones.map((z: string) => (
                                  <Badge key={z} variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">{z}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {prof.bio && (
                            <div>
                              <p className="text-teal-500 text-sm mb-1">Sobre su práctica:</p>
                              <p className="text-teal-700 text-sm bg-teal-50 p-2 rounded">{prof.bio}</p>
                            </div>
                          )}

                          {prof.cvFileName && (
                            <div>
                              <p className="text-teal-500 text-sm mb-1">CV / Curriculum:</p>
                              <a
                                href={`/api/professionals/cv?id=${prof.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                                <span className="font-medium">{prof.cvFileName}</span>
                                <span className="text-blue-400 text-xs">(Ver / Descargar)</span>
                              </a>
                            </div>
                          )}

                          {/* Planilla de Atención */}
                          <div>
                            <p className="text-teal-500 text-sm mb-2">Planilla de Atención:</p>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={`/api/attendance-sheets?professionalId=${prof.id}&csv=1&month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                <span className="font-medium">Descargar Planilla Mes Actual (CSV)</span>
                              </a>
                              <a
                                href={`/api/attendance-sheets?professionalId=${prof.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-700 hover:bg-teal-100 transition-colors"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                                <span className="font-medium">Ver todas las planillas</span>
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-teal-400 pt-1">
                            <span>Cuenta: {isActive ? "Activada" : "Pendiente"}</span>
                            <span>•</span>
                            <span>Disponibilidad: {prof.available ? "Disponible" : "No disponible"}</span>
                            <span>•</span>
                            <span>Registrado: {new Date(prof.user.createdAt || "").toLocaleDateString("es-AR")}</span>
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Admin Patients ----

export function AdminPatients() {
  const [patients, setPatients] = useState<
    {
      id: string;
      user: { name: string; email: string; phone: string };
    }[]
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
        <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
          {patients.map((patient) => (
            <Card key={patient.id} className="border-teal-100">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-teal-600" />
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

// ---- Admin Contact Requests ----

const CONTACT_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  nuevo: { label: "Nuevo", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
  leido: { label: "Leído", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  respondido: { label: "Respondido", color: "text-teal-700", bgColor: "bg-teal-50 border-teal-200" },
  resuelto: { label: "Resuelto", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
};

const NEXT_STATUS: Record<string, string> = {
  nuevo: "leido",
  leido: "respondido",
  respondido: "resuelto",
};

export function AdminContacts() {
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const loadContacts = () => {
    fetch("/api/contact")
      .then((res) => res.json())
      .then((data) => {
        setContacts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const REASON_MAP: Record<string, string> = {
    solicitar_turno: "Solicitar Turno",
    consulta_general: "Consulta General",
    informacion: "Información",
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setContacts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
        );
        toast.success(`Estado actualizado a "${CONTACT_STATUS_MAP[newStatus]?.label || newStatus}"`);
      } else {
        toast.error("Error al actualizar estado");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que querés eliminar esta consulta?")) return;
    try {
      const res = await fetch(`/api/contact/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Consulta eliminada");
        loadContacts();
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const filtered =
    statusFilter === "all"
      ? contacts
      : contacts.filter((c) => c.status === statusFilter);

  const newCount = contacts.filter((c) => c.status === "nuevo").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-teal-900">Consultas de Contacto</h2>
          {newCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {newCount} {newCount === 1 ? "nueva" : "nuevas"}
            </span>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 border-teal-200">
            <SelectValue placeholder="Filtrar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ({contacts.length})</SelectItem>
            <SelectItem value="nuevo">Nuevos</SelectItem>
            <SelectItem value="leido">Leídos</SelectItem>
            <SelectItem value="respondido">Respondidos</SelectItem>
            <SelectItem value="resuelto">Resueltos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 text-teal-200 mx-auto" />
            <p className="text-teal-600 mt-2">No hay consultas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
          {filtered.map((contact) => {
            const statusInfo = CONTACT_STATUS_MAP[contact.status] || CONTACT_STATUS_MAP.nuevo;
            const nextStatus = NEXT_STATUS[contact.status];
            return (
              <Card key={contact.id} className="border-teal-100">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-teal-900">{contact.name}</p>
                        <Badge variant="outline" className={`text-xs ${statusInfo.bgColor} ${statusInfo.color} border`}>
                          {statusInfo.label}
                        </Badge>
                        {contact.reason && (
                          <Badge variant="outline" className="text-xs">
                            {REASON_MAP[contact.reason] || contact.reason}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-teal-600">{contact.email}</p>
                      {contact.phone && (
                        <p className="text-sm text-teal-500">{contact.phone}</p>
                      )}
                      <p className="text-sm text-teal-700 mt-2 bg-teal-50 p-2 rounded">
                        {contact.message}
                      </p>
                      <p className="text-xs text-teal-400 mt-1">
                        {new Date(contact.createdAt).toLocaleString("es-AR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      {nextStatus && (
                        <Button
                          size="sm"
                          className="bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs"
                          onClick={() => handleStatusUpdate(contact.id, nextStatus)}
                        >
                          {contact.status === "nuevo" && "Marcar leído"}
                          {contact.status === "leido" && "Respondido"}
                          {contact.status === "respondido" && "Resolver"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 border-red-200 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(contact.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Admin Profile ----

export function AdminProfile() {
  const { data: session, update: updateSession } = useSession();
  const userId = (session?.user as { id?: string })?.id;

  const [profileForm, setProfileForm] = useState({
    name: session?.user?.name || "",
    email: (session?.user as { email?: string })?.email || "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Load current phone from DB
  useEffect(() => {
    if (userId) {
      fetch(`/api/users/${userId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.phone !== undefined) {
            setProfileForm((prev) => ({
              ...prev,
              phone: data.phone || "",
              name: data.name || prev.name,
              email: data.email || prev.email,
            }));
          }
        })
        .catch(() => {});
    }
  }, [userId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!profileForm.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!profileForm.email.trim() || !profileForm.email.includes("@")) {
      toast.error("Ingresá un email válido");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone || null,
        }),
      });

      if (res.ok) {
        toast.success("Datos actualizados exitosamente");
        // Update session so the sidebar shows the new name
        await updateSession();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar datos");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordForm.currentPassword) {
      toast.error("Ingresá tu contraseña actual");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error("La nueva contraseña debe ser diferente a la actual");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (res.ok) {
        toast.success("Contraseña actualizada exitosamente");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al cambiar la contraseña");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-teal-900">Mi Perfil</h2>

      {/* Profile Info Card */}
      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Datos del Administrador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Nombre completo *</Label>
                <Input
                  id="admin-name"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, name: e.target.value })
                  }
                  className="border-teal-200"
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email *</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, email: e.target.value })
                  }
                  className="border-teal-200"
                  placeholder="tu@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-phone">Teléfono</Label>
                <Input
                  id="admin-phone"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                  className="border-teal-200"
                  placeholder="+54 11 xxxx-xxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Input
                  value="Administrador"
                  disabled
                  className="border-teal-200 bg-teal-50/50 text-teal-700"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={savingProfile}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Save className="mr-2 w-4 h-4" />
                {savingProfile ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Cambiar Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current-pass">Contraseña actual *</Label>
                <div className="relative">
                  <Input
                    id="current-pass"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: e.target.value,
                      })
                    }
                    className="border-teal-200 pr-10"
                    placeholder="Contraseña actual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pass">Nueva contraseña *</Label>
                <div className="relative">
                  <Input
                    id="new-pass"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value,
                      })
                    }
                    className="border-teal-200 pr-10"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pass">Confirmar contraseña *</Label>
                <Input
                  id="confirm-pass"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="border-teal-200"
                  placeholder="Repetir nueva contraseña"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={savingPassword}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Lock className="mr-2 w-4 h-4" />
                {savingPassword ? "Cambiando..." : "Cambiar Contraseña"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
