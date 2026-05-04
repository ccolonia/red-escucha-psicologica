"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Stethoscope,
  Calendar,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Phone,
  UserPlus,
  AlertCircle,
  FileText,
  MessageSquare,
  Pencil,
  Trash2,
  Lock,
  Save,
  X,
  Eye,
  EyeOff,
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
  specialty: string;
  available: boolean;
  user: { name: string; email: string; phone: string };
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
  completed: { label: "Completado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-teal-100">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-lg font-bold text-teal-900">
                {stats.completedAppointments}
              </p>
              <p className="text-xs text-teal-600">Completados</p>
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
      </div>
    </div>
  );
}

// ---- Admin Appointments ----

export function AdminAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 border-teal-200">
            <SelectValue placeholder="Filtrar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
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
        <h2 className="text-2xl font-bold text-teal-900">Profesionales</h2>
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
          {professionals.map((prof) => (
            <Card key={prof.id} className="border-teal-100">
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          prof.available ? "bg-teal-100" : "bg-gray-100"
                        }`}
                      >
                        <Stethoscope
                          className={`w-5 h-5 ${
                            prof.available ? "text-teal-600" : "text-gray-400"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-teal-900">{prof.user.name}</p>
                        <p className="text-sm text-teal-600">
                          {prof.specialty} • MP: {prof.license}
                        </p>
                        <p className="text-sm text-teal-500">{prof.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={prof.available ? "default" : "secondary"}
                        className={
                          prof.available
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                            : ""
                        }
                      >
                        {prof.available ? "Activo" : "Inactivo"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-teal-200"
                        onClick={() => handleToggleAvailable(prof.id, prof.available)}
                      >
                        {prof.available ? "Desactivar" : "Activar"}
                      </Button>
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
                )}
              </CardContent>
            </Card>
          ))}
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
