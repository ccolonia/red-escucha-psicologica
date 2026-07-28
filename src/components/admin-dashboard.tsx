"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Loader2,
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
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  BadgeCheck,
  MessageCircle,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { formatPhoneForWhatsApp } from "@/lib/email";
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
  // timeEnd calculado por el backend según slotDuration del schedule del
  // profesional para ese día de la semana. Default 45 min si no hay schedule.
  timeEnd?: string;
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
  // === Detalle de "Otras terapias" (nuevo campo) ===
  // Texto libre que el profesional cargó al registrar si seleccionó
  // "Otras terapias" en therapyTypes. Null si no aplica.
  otherTherapyDetails: string | null;
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  zones: string | null;
  bio: string | null;
  cvFileName: string | null;
  internalNotes: string | null;
  evaluationStatus: string | null;
  // === Campos de auditoría documental (solo admin) ===
  // El GET /api/professionals NO los devuelve por defecto para no
  // exponerlos al público. Pero el GET paginado (modo admin) sí los
  // incluye. Ver backend route.ts.
  dniVerified?: boolean;
  degreeVerified?: boolean;
  malpracticeInsuranceVerified?: boolean;
  taxRegistrationVerified?: boolean;
  nationalRegistryVerified?: boolean;
  createdAt: string;
  user: {
    name: string;
    email: string;
    phone: string;
    active: boolean;
    createdAt: string;
    // === Flags de onboarding (aprobación + contraseña + acceso) ===
    isApproved?: boolean;
    passwordSet?: boolean;
    hasAccessedPanel?: boolean;
  };
}

interface ContactRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  reason: string | null;
  modality?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "default" },
  completed: { label: "Atendido", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  cancelled_by_professional: { label: "Cancelado por el Profesional", variant: "destructive" },
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
              <SelectItem value="cancelled_by_professional">Cancelados por Profesional</SelectItem>
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
                      {apt.date} • {apt.timeEnd ? `${apt.time} a ${apt.timeEnd} hs` : `${apt.time} hs`}
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
  const [exporting, setExporting] = useState(false);
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

  // ── Search, Pagination & Filter state ──
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState(""); // "", "approved", "pending", "unverified"
  const [approvedCount, setApprovedCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAGE_SIZE = 10;

  const loadProfessionals = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", currentPage.toString());
    params.set("limit", PAGE_SIZE.toString());

    fetch(`/api/professionals?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        // API now returns { professionals, pagination, approvedCount }
        if (data.professionals) {
          setProfessionals(data.professionals);
          setTotalCount(data.pagination.totalCount);
          setTotalPages(data.pagination.totalPages);
          setApprovedCount(data.approvedCount ?? 0);
        } else {
          // Backward compatibility: if API returns plain array
          setProfessionals(Array.isArray(data) ? data : []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [searchQuery, statusFilter, currentPage]);

  useEffect(() => {
    loadProfessionals();
  }, [loadProfessionals]);

  // ── Debounced search handler (300ms) ──
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
  };

  const pendingCount = professionals.filter((p) => !p.user.active).length;
  const unverifiedLicenseCount = professionals.filter((p) => !p.licenseVerified).length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/professionals/export");
      if (!res.ok) {
        toast.error("Error al exportar profesionales");
        setExporting(false);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Nombre dinámico con fecha
      const today = new Date().toISOString().split("T")[0];
      a.download = `profesionales_REP_${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Excel descargado exitosamente");
    } catch {
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

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

        // If approving (activating), call the new approval endpoint which:
        //   1. Marks isApproved = true on the user
        //   2. Invalidates the current password (forces set-password flow)
        //   3. Sends the approval email with the password setup link
        // After this, passwordSet and hasAccessedPanel stay false until
        // the professional completes their part of the onboarding.
        if (!currentActive) {
          toast.success("Cuenta activada. Enviando email de bienvenida...");
          try {
            const emailRes = await fetch("/api/admin/professionals/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            });
            if (emailRes.ok) {
              const emailData = await emailRes.json().catch(() => ({}));
              // Actualizar estado local con los flags nuevos
              setProfessionals((prev) =>
                prev.map((p) =>
                  p.userId === userId
                    ? {
                        ...p,
                        user: {
                          ...p.user,
                          isApproved: true,
                          passwordSet: false,
                          hasAccessedPanel: false,
                        },
                      }
                    : p
                )
              );
              if (emailData.warning) {
                toast.warning(emailData.warning);
              } else {
                toast.success("Profesional aprobado. Email de bienvenida enviado.");
              }
            } else {
              const emailData = await emailRes.json().catch(() => ({}));
              toast.error(emailData.error || "Error al aprobar al profesional");
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
    // No permitir verificar matrículas con formato inválido
    if (!currentVerified) {
      const prof = professionals.find((p) => p.id === id);
      if (prof) {
        const licenseClean = prof.license.replace(/[\s.-]/g, "");
        const licenseRegex = /^(MN|MP)(\d{4,6})$/;
        if (!licenseRegex.test(licenseClean)) {
          toast.error("No se puede verificar una matrícula con formato inválido. Corregí la matrícula primero (MN o MP + 4-6 dígitos).");
          return;
        }
      }
    }
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
    // Validar formato de matrícula
    const addLicenseClean = addForm.license.replace(/[\s.-]/g, "");
    const addLicenseRegex = /^(MN|MP)(\d{4,6})$/;
    if (!addLicenseRegex.test(addLicenseClean)) {
      toast.error("La matrícula debe ser MN o MP seguido de 4 a 6 dígitos (ej: MN-12345 o MP-5432)");
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
    // Validar formato de matrícula
    const editLicenseClean = editForm.license.replace(/[\s.-]/g, "");
    const editLicenseRegex = /^(MN|MP)(\d{4,6})$/;
    if (!editLicenseRegex.test(editLicenseClean)) {
      toast.error("La matrícula debe ser MN o MP seguido de 4 a 6 dígitos (ej: MN-12345 o MP-5432)");
      return;
    }
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

  // ── Pagination helpers ──
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div>
      {/* ── Header with title, badges and actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 flex-wrap">
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-sage-300 text-forest-600 hover:bg-sage-50"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <RefreshCw className="mr-2 w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 w-4 h-4" />
            )}
            {exporting ? "Exportando..." : "Exportar Datos"}
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setShowAdd(!showAdd)}
          >
            <UserPlus className="mr-2 w-4 h-4" />
            Agregar
          </Button>
        </div>
      </div>

      {/* ── Search bar + Approved filter ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        {/* Search input with debounce */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
          <Input
            placeholder="Buscar por nombre, email, matrícula, especialidad o zona..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 border-teal-200 focus:border-teal-400"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status filter buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={statusFilter === "approved" ? "default" : "outline"}
            size="sm"
            className={
              statusFilter === "approved"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }
            onClick={() => {
              setStatusFilter(statusFilter === "approved" ? "" : "approved");
              setCurrentPage(1);
            }}
          >
            <BadgeCheck className="mr-1.5 w-4 h-4" />
            Aprobados ({approvedCount})
          </Button>
          <Button
            variant={statusFilter === "pending" ? "default" : "outline"}
            size="sm"
            className={
              statusFilter === "pending"
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "border-amber-200 text-amber-700 hover:bg-amber-50"
            }
            onClick={() => {
              setStatusFilter(statusFilter === "pending" ? "" : "pending");
              setCurrentPage(1);
            }}
          >
            <Clock className="mr-1.5 w-4 h-4" />
            Pendientes
          </Button>
          <Button
            variant={statusFilter === "unverified" ? "default" : "outline"}
            size="sm"
            className={
              statusFilter === "unverified"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "border-red-200 text-red-600 hover:bg-red-50"
            }
            onClick={() => {
              setStatusFilter(statusFilter === "unverified" ? "" : "unverified");
              setCurrentPage(1);
            }}
          >
            <ShieldAlert className="mr-1.5 w-4 h-4" />
            Sin verificar
          </Button>
          {statusFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="text-teal-500 hover:text-teal-700"
              onClick={() => {
                setStatusFilter("");
                setCurrentPage(1);
              }}
            >
              <Filter className="mr-1 w-3.5 h-3.5" />
              Ver todos
            </Button>
          )}
        </div>
      </div>

      {/* ── Result count indicator ── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-teal-500">
          {loading ? "Buscando..." : `${totalCount} profesional${totalCount !== 1 ? "es" : ""} encontrado${totalCount !== 1 ? "s" : ""}`}
          {searchQuery && <span> para &quot;{searchQuery}&quot;</span>}
          {statusFilter === "approved" && " (Aprobados)"}
          {statusFilter === "pending" && " (Pendientes)"}
          {statusFilter === "unverified" && " (Sin verificar)"}
        </p>
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
                        setAddForm({ ...addForm, license: e.target.value.replace(/[^0-9MNMPmnmp.\-\s]/g, "").toUpperCase() })
                      }
                      placeholder="MN-12345 o MP-5432"
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
      ) : professionals.length === 0 ? (
        <div className="text-center py-12">
          <Stethoscope className="w-12 h-12 text-teal-300 mx-auto mb-3" />
          <p className="text-teal-600 font-medium">No se encontraron profesionales</p>
          <p className="text-teal-400 text-sm mt-1">
            {searchQuery || statusFilter
              ? "Probá con otros filtros de búsqueda"
              : "Agregá el primer profesional haciendo clic en el botón Agregar"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {professionals.map((prof) => {
              const isActive = prof.user.active;
              const isExpanded = expandedId === prof.id;
              // === Saneamiento defensivo al renderizar ===
              // Dedup case-insensitive por si la DB ya tiene entradas
              // duplicadas por un bug previo (ej: "Psicología Clínica" y
              // "Psicología clínica" coexistiendo en el mismo array).
              // Esto sanea la UI sin necesidad de migración de datos.
              const dedupCaseInsensitive = (arr: string[]): string[] => {
                const seen = new Set<string>();
                const result: string[] = [];
                for (const item of arr) {
                  const key = String(item).trim().toLowerCase();
                  if (!key || seen.has(key)) continue;
                  seen.add(key);
                  result.push(item);
                }
                return result;
              };
              const parsedTherapyTypes = dedupCaseInsensitive(
                prof.therapyTypes ? JSON.parse(prof.therapyTypes) : []
              );
              const parsedTargetAudience = dedupCaseInsensitive(
                prof.targetAudience ? JSON.parse(prof.targetAudience) : []
              );
              const parsedTherapyModality = dedupCaseInsensitive(
                prof.therapyModality ? JSON.parse(prof.therapyModality) : []
              );
              const parsedZones = dedupCaseInsensitive(
                prof.zones ? JSON.parse(prof.zones) : []
              );
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
                              onChange={(e) => setEditForm({ ...editForm, license: e.target.value.replace(/[^0-9MNMPmnmp.\-\s]/g, "").toUpperCase() })}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* === Badge de estado de aprobación === */}
                            {/* Si está aprobado, mostrar badge verde. Si no, botón Aprobar. */}
                            {prof.user.isApproved ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs h-7"
                                title="Profesional aprobado por el administrador"
                              >
                                <CheckCircle2 className="mr-1 w-3 h-3" />
                                Aprobado
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs"
                                onClick={() => handleToggleActive(prof.userId, false)}
                                title="Aprobar al profesional y enviar email de bienvenida"
                              >
                                <CheckCircle2 className="mr-1 w-3.5 h-3.5" />
                                Aprobar
                              </Button>
                            )}

                            {/* === Micro-badge: estado de contraseña === */}
                            {/* Indica si el profesional ya seteó su contraseña definitiva */}
                            {prof.user.isApproved && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-6 ${
                                  prof.user.passwordSet
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                }`}
                                title={
                                  prof.user.passwordSet
                                    ? "El profesional ya configuró su contraseña definitiva"
                                    : "El profesional todavía no configuró su contraseña"
                                }
                              >
                                {prof.user.passwordSet ? "✓ Contraseña" : "• Contraseña"}
                              </Badge>
                            )}

                            {/* === Micro-badge: acceso al panel === */}
                            {/* Indica si el profesional ya inició sesión al menos una vez */}
                            {prof.user.isApproved && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-6 ${
                                  prof.user.hasAccessedPanel
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                }`}
                                title={
                                  prof.user.hasAccessedPanel
                                    ? "El profesional ya ingresó al panel al menos una vez"
                                    : "El profesional todavía no ingresó al panel"
                                }
                              >
                                {prof.user.hasAccessedPanel ? "✓ Ingresó" : "• Sin accesos"}
                              </Badge>
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
                            {/* === Botón WhatsApp (acceso rápido sin expandir ficha) === */}
                            {prof.user.phone && (() => {
                              const waPhone = formatPhoneForWhatsApp(prof.user.phone);
                              const waMsg = encodeURIComponent(`Hola ${prof.user.name}, te contacto desde Red Escucha Psicológica`);
                              return (
                                <a
                                  href={`https://wa.me/${waPhone}?text=${waMsg}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center h-8 px-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium rounded-md transition-colors"
                                  title={`Enviar WhatsApp a ${prof.user.name}`}
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              );
                            })()}
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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div>
                                    <span className="text-teal-500">Teléfono:</span>{" "}
                                    <span className="text-teal-800">{prof.user.phone}</span>
                                  </div>
                                  {(() => {
                                    const waPhone = formatPhoneForWhatsApp(prof.user.phone);
                                    const waMsg = encodeURIComponent(`Hola ${prof.user.name}, te contacto desde Red Escucha Psicológica`);
                                    return (
                                      <a
                                        href={`https://wa.me/${waPhone}?text=${waMsg}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium rounded-full transition-colors"
                                        title={`Enviar WhatsApp a ${prof.user.name}`}
                                      >
                                        <MessageCircle className="w-3 h-3" />
                                        WhatsApp
                                      </a>
                                    );
                                  })()}
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

                            {/* === Detalle de "Otras terapias" === */}
                            {/* Si el profesional seleccionó "Otras terapias" y
                                cargó un detalle, se muestra acá para que el
                                coordinador lo lea durante el triage. */}
                            {prof.otherTherapyDetails && (
                              <div>
                                <p className="text-teal-500 text-sm mb-1">Detalle de otras terapias:</p>
                                <p className="text-teal-700 text-sm bg-amber-50 border border-amber-200 p-2 rounded">
                                  {prof.otherTherapyDetails}
                                </p>
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

                            {/* Observaciones Internas y Estado de Evaluación */}
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <p className="text-teal-500 text-sm mb-1">Observaciones Internas:</p>
                                <textarea
                                  rows={2}
                                  className="w-full border border-red-200 bg-red-50 rounded-lg p-2 text-sm text-red-800 placeholder-red-300 focus:ring-red-200 focus:border-red-300"
                                  placeholder="Notas internas del administrador..."
                                  value={prof.internalNotes || ""}
                                  onChange={(e) => {
                                    setProfessionals((prev) =>
                                      prev.map((p) =>
                                        p.id === prof.id ? { ...p, internalNotes: e.target.value } : p
                                      )
                                    );
                                  }}
                                  onBlur={(e) => {
                                    fetch("/api/professionals", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ id: prof.id, internalNotes: e.target.value || null }),
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <p className="text-teal-500 text-sm mb-1">Estado de Evaluación:</p>
                                <Input
                                  className="border-amber-200 bg-amber-50 text-amber-800 placeholder-amber-300"
                                  placeholder="✓, CV, ?, observaciones..."
                                  value={prof.evaluationStatus || ""}
                                  onChange={(e) => {
                                    setProfessionals((prev) =>
                                      prev.map((p) =>
                                        p.id === prof.id ? { ...p, evaluationStatus: e.target.value } : p
                                      )
                                    );
                                  }}
                                  onBlur={(e) => {
                                    fetch("/api/professionals", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ id: prof.id, evaluationStatus: e.target.value || null }),
                                    });
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-teal-400 pt-1">
                              <span>Cuenta: {isActive ? "Activada" : "Pendiente"}</span>
                              <span>•</span>
                              <span>Disponibilidad: {prof.available ? "Disponible" : "No disponible"}</span>
                              <span>•</span>
                              <span>Registrado: {new Date(prof.user.createdAt || "").toLocaleDateString("es-AR")}</span>
                            </div>

                            {/* === Sección de Auditoría y Verificación de Documentación === */}
                            {/* Solo visible para admin/super_admin (este panel entero ya está
                                detrás de un guard de rol en el frontend store, pero los campos
                                también están protegidos en el backend: PATCH /api/professionals
                                valida role antes de mutarlos). */}
                            <Separator className="my-3 bg-teal-100" />
                            <div>
                              <p className="text-sm font-medium text-teal-900 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-teal-600" />
                                Auditoría y Verificación de Documentación
                              </p>
                              <p className="text-xs text-teal-500 mt-0.5">
                                Tildá los documentos que verificaste. Los cambios se guardan automáticamente.
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                {/* Helper para renderizar cada checkbox con auto-save */}
                                {([
                                  { key: "dniVerified", label: "DNI", desc: "Copia de documento de identidad" },
                                  { key: "degreeVerified", label: "Título", desc: "Título universitario habilitante" },
                                  { key: "licenseVerified", label: "Matrícula", desc: "Matrícula provincial/nacional" },
                                  { key: "malpracticeInsuranceVerified", label: "Seguro de Mala Praxis", desc: "Póliza vigente" },
                                  { key: "taxRegistrationVerified", label: "Constancia de Monotributo", desc: "Inscripción fiscal" },
                                  { key: "nationalRegistryVerified", label: "Registro Nacional de Prestadores", desc: "RNP" },
                                ] as const).map(({ key, label, desc }) => {
                                  const checked = Boolean(prof[key]);
                                  return (
                                    <label
                                      key={key}
                                      htmlFor={`doc-${prof.id}-${key}`}
                                      className="flex items-start gap-3 p-2 rounded-lg border border-teal-100 bg-white hover:bg-teal-50/50 transition-colors cursor-pointer"
                                    >
                                      <Checkbox
                                        id={`doc-${prof.id}-${key}`}
                                        checked={checked}
                                        onCheckedChange={(value) => {
                                          const newValue = Boolean(value);
                                          // Update local state immediately for responsiveness
                                          setProfessionals((prev) =>
                                            prev.map((p) =>
                                              p.id === prof.id ? { ...p, [key]: newValue } : p
                                            )
                                          );
                                          // Persist to backend (admin-only field; backend
                                          // silently ignores if caller is not admin)
                                          fetch("/api/professionals", {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ id: prof.id, [key]: newValue }),
                                          }).catch((err) => {
                                            console.error(`Error saving ${key}:`, err);
                                            toast.error(`Error al actualizar ${label}`);
                                            // Revert on error
                                            setProfessionals((prev) =>
                                              prev.map((p) =>
                                                p.id === prof.id ? { ...p, [key]: !newValue } : p
                                              )
                                            );
                                          });
                                        }}
                                        className="mt-0.5 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-teal-900 block">
                                          {label}
                                        </span>
                                        <span className="text-xs text-teal-500 block">
                                          {desc}
                                        </span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                              {/* Summary badge */}
                              <div className="mt-3 flex items-center gap-2 text-xs">
                                {(() => {
                                  const verifiedCount = [
                                    prof.dniVerified,
                                    prof.degreeVerified,
                                    prof.licenseVerified,
                                    prof.malpracticeInsuranceVerified,
                                    prof.taxRegistrationVerified,
                                    prof.nationalRegistryVerified,
                                  ].filter(Boolean).length;
                                  const allVerified = verifiedCount === 6;
                                  return (
                                    <Badge
                                      variant="outline"
                                      className={
                                        allVerified
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                          : verifiedCount > 0
                                          ? "bg-amber-50 border-amber-200 text-amber-700"
                                          : "bg-red-50 border-red-200 text-red-700"
                                      }
                                    >
                                      {allVerified ? (
                                        <><CheckCircle2 className="w-3 h-3 mr-1" /> Documentación completa</>
                                      ) : (
                                        <>{verifiedCount}/6 documentos verificados</>
                                      )}
                                    </Badge>
                                  );
                                })()}
                              </div>
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

          {/* ── Pagination bar ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6 pb-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-teal-200 text-teal-600 hover:bg-teal-50"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`dots-${idx}`} className="px-1 text-teal-400 text-sm">...</span>
                ) : (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 p-0 text-sm ${
                      currentPage === page
                        ? "bg-teal-600 hover:bg-teal-700 text-white"
                        : "border-teal-200 text-teal-600 hover:bg-teal-50"
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-teal-200 text-teal-600 hover:bg-teal-50"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Admin Patients ----

export function AdminPatients() {
  const [patients, setPatients] = useState<
    {
      id: string;
      dni: string | null;
      dateOfBirth: string | null;
      emergencyContact: string | null;
      notes: string | null;
      user: { name: string; email: string; phone: string; active: boolean; createdAt: string };
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    dni: "",
    dateOfBirth: "",
    emergencyContact: "",
    notes: "",
  });
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    dni: "",
    password: "",
    dateOfBirth: "",
    emergencyContact: "",
    notes: "",
    enableTriage: true,
    modality: "presencial",
    reason: "otros",
  });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadPatients = useCallback(() => {
    const url = searchQuery
      ? `/api/patients?search=${encodeURIComponent(searchQuery)}`
      : "/api/patients";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setPatients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [searchQuery]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Paciente creado exitosamente");
        setShowAdd(false);
        setAddForm({ name: "", email: "", phone: "", dni: "", password: "", dateOfBirth: "", emergencyContact: "", notes: "", enableTriage: true, modality: "presencial", reason: "otros" });
        loadPatients();
      } else {
        toast.error(data.error || "Error al crear paciente");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (patient: typeof patients[0]) => {
    setEditingId(patient.id);
    setEditForm({
      name: patient.user.name,
      email: patient.user.email,
      phone: patient.user.phone || "",
      dni: patient.dni || "",
      dateOfBirth: patient.dateOfBirth || "",
      emergencyContact: patient.emergencyContact || "",
      notes: patient.notes || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/patients/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Paciente actualizado");
        setEditingId(null);
        loadPatients();
      } else {
        toast.error(data.error || "Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(null);
    try {
      const res = await fetch(`/api/admin/patients/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Paciente eliminado exitosamente");
        loadPatients();
      } else {
        // Show specific business-rule error (e.g. has appointments)
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
          <h2 className="text-2xl font-bold text-teal-900">Pacientes</h2>
          <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-700">
            {patients.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              placeholder="Buscar paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-48 border-teal-200"
            />
            <Users className="w-4 h-4 text-teal-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setShowAdd(true)}
          >
            <UserPlus className="mr-2 w-4 h-4" /> Nuevo Paciente
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-teal-200 mx-auto" />
            <p className="text-teal-600 mt-2">
              {searchQuery ? "No se encontraron pacientes con esa búsqueda" : "No hay pacientes registrados"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
          {patients.map((patient) => (
            <Card
              key={patient.id}
              className={`border-teal-100 ${!patient.user.active ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-teal-900">
                          {patient.user.name}
                        </p>
                        {!patient.user.active && (
                          <Badge variant="outline" className="text-xs bg-red-50 border-red-200 text-red-600">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-teal-600">{patient.user.email}</p>
                      {patient.user.phone && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-teal-500">{patient.user.phone}</p>
                          {(() => {
                            const waPhone = formatPhoneForWhatsApp(patient.user.phone);
                            const waMsg = encodeURIComponent(`Hola ${patient.user.name}, te contacto desde Red Escucha Psicológica`);
                            return (
                              <a
                                href={`https://wa.me/${waPhone}?text=${waMsg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium rounded-full transition-colors"
                                title={`Enviar WhatsApp a ${patient.user.name}`}
                              >
                                <MessageCircle className="w-3 h-3" />
                                WhatsApp
                              </a>
                            );
                          })()}
                        </div>
                      )}
                      {(patient.dni || patient.dateOfBirth || patient.emergencyContact || patient.notes) && (
                        <div className="mt-1 text-xs text-teal-400 space-y-0.5">
                          {patient.dni && <p>DNI: {patient.dni}</p>}
                          {patient.dateOfBirth && <p>Fecha nac.: {patient.dateOfBirth}</p>}
                          {patient.emergencyContact && <p>Contacto emerg.: {patient.emergencyContact}</p>}
                          {patient.notes && <p className="truncate max-w-xs">Notas: {patient.notes}</p>}
                        </div>
                      )}
                      <p className="text-xs text-teal-300 mt-1">
                        Registrado: {new Date(patient.user.createdAt).toLocaleDateString("es-AR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-teal-200 text-teal-600"
                      onClick={() => handleEdit(patient)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-red-200 text-red-500"
                      onClick={() => setDeletingId(patient.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Add Patient Dialog ── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-teal-900">Nuevo Paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre y Apellido *</Label>
                <Input
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="border-teal-200"
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="border-teal-200"
                  placeholder="juan@email.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="border-teal-200"
                  placeholder="3515551234"
                />
              </div>
              <div className="space-y-2">
                <Label>DNI</Label>
                <Input
                  value={addForm.dni}
                  onChange={(e) => {
                    // Sanitizar: solo permitir dígitos mientras el admin escribe
                    const cleaned = e.target.value.replace(/[^0-9]/g, "");
                    setAddForm({ ...addForm, dni: cleaned });
                  }}
                  className="border-teal-200"
                  placeholder="12345678"
                  maxLength={8}
                  inputMode="numeric"
                />
                <p className="text-xs text-teal-400">7-8 dígitos (sin puntos ni guiones)</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                type="text"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="border-teal-200"
                placeholder="Se autogenera si queda vacía"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Nacimiento</Label>
                <Input
                  type="date"
                  value={addForm.dateOfBirth}
                  onChange={(e) => setAddForm({ ...addForm, dateOfBirth: e.target.value })}
                  className="border-teal-200"
                />
              </div>
              <div className="space-y-2">
                <Label>Contacto de Emergencia</Label>
                <Input
                  value={addForm.emergencyContact}
                  onChange={(e) => setAddForm({ ...addForm, emergencyContact: e.target.value })}
                  className="border-teal-200"
                  placeholder="María Pérez - 3515559999"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                className="border-teal-200"
                rows={2}
                placeholder="Observaciones adicionales..."
              />
            </div>

            {/* ── Triage Integration ── */}
            <div className="border border-teal-200 rounded-xl p-4 bg-teal-50/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-teal-900 font-medium cursor-pointer" htmlFor="enable-triage">
                    Habilitar ingreso a Triage y Solicitud de Turno
                  </Label>
                  <p className="text-xs text-teal-500 mt-0.5">
                    El paciente aparecerá en el panel de Triage para asignarle un profesional
                  </p>
                </div>
                <Switch
                  id="enable-triage"
                  checked={addForm.enableTriage}
                  onCheckedChange={(checked) => setAddForm({ ...addForm, enableTriage: checked })}
                />
              </div>

              {addForm.enableTriage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="space-y-2">
                    <Label className="text-teal-700 text-sm">Modalidad preferida</Label>
                    <Select
                      value={addForm.modality}
                      onValueChange={(value) => setAddForm({ ...addForm, modality: value })}
                    >
                      <SelectTrigger className="border-teal-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presencial">Presencial</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="híbrida">Híbrida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-teal-700 text-sm">Motivo de consulta</Label>
                    <Select
                      value={addForm.reason}
                      onValueChange={(value) => setAddForm({ ...addForm, reason: value })}
                    >
                      <SelectTrigger className="border-teal-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ansiedad">Ansiedad</SelectItem>
                        <SelectItem value="depresion">Depresión</SelectItem>
                        <SelectItem value="vinculos">Vínculos</SelectItem>
                        <SelectItem value="duelo">Duelo</SelectItem>
                        <SelectItem value="autoestima">Autoestima</SelectItem>
                        <SelectItem value="adicciones">Adicciones</SelectItem>
                        <SelectItem value="estres">Estrés</SelectItem>
                        <SelectItem value="laboral">Laboral</SelectItem>
                        <SelectItem value="orientacion_padres">Orientación a Padres</SelectItem>
                        <SelectItem value="evaluaciones">Evaluaciones</SelectItem>
                        <SelectItem value="discapacidad">Discapacidad</SelectItem>
                        <SelectItem value="otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-teal-300">
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={adding}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {adding ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
              Crear Paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Patient Dialog ── */}
      <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-teal-900">Editar Paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre y Apellido</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="border-teal-200"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="border-teal-200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="border-teal-200"
                />
              </div>
              <div className="space-y-2">
                <Label>DNI</Label>
                <Input
                  value={editForm.dni}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, "");
                    setEditForm({ ...editForm, dni: cleaned });
                  }}
                  className="border-teal-200"
                  placeholder="12345678"
                  maxLength={8}
                  inputMode="numeric"
                />
                <p className="text-xs text-teal-400">7-8 dígitos (sin puntos ni guiones)</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fecha de Nacimiento</Label>
              <Input
                type="date"
                value={editForm.dateOfBirth}
                onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                className="border-teal-200"
              />
            </div>
            <div className="space-y-2">
              <Label>Contacto de Emergencia</Label>
              <Input
                value={editForm.emergencyContact}
                onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                className="border-teal-200"
                placeholder="María Pérez - 3515559999"
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="border-teal-200"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)} className="border-teal-300">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation AlertDialog ── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">
              ¿Eliminar este paciente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el paciente tiene turnos o profesionales asociados, el sistema no permitirá la eliminación y se le informará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-teal-300">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deletingId) handleDelete(deletingId);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  // === Map de modalidades de atención ===
  // Se muestra solo cuando la consulta tiene modality seteada
  // (viene del form de contacto con reason="solicitar_turno").
  const MODALITY_LABEL_MAP: Record<string, { label: string; bgColor: string; color: string }> = {
    online: { label: "Online", bgColor: "bg-blue-50", color: "text-blue-700" },
    presencial: { label: "Presencial", bgColor: "bg-emerald-50", color: "text-emerald-700" },
    "híbrida": { label: "Híbrida", bgColor: "bg-violet-50", color: "text-violet-700" },
    hibrida: { label: "Híbrida", bgColor: "bg-violet-50", color: "text-violet-700" },
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
            const modalityInfo = contact.modality ? MODALITY_LABEL_MAP[contact.modality] : null;
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
                        {modalityInfo && (
                          <Badge variant="outline" className={`text-xs ${modalityInfo.bgColor} ${modalityInfo.color} border`}>
                            {modalityInfo.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-teal-600">{contact.email}</p>
                      {contact.phone && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-sm text-teal-500">{contact.phone}</p>
                          {(() => {
                            const waPhone = formatPhoneForWhatsApp(contact.phone);
                            if (!waPhone) return null;
                            // Mensaje pre-cargado con el nombre del consultante
                            const waMessage = encodeURIComponent(
                              `Hola ${contact.name}, te contactamos desde Red Escucha Psicológica respecto a tu consulta. 😊`
                            );
                            return (
                              <a
                                href={`https://wa.me/${waPhone}?text=${waMessage}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-medium rounded-md transition-colors"
                                title={`Enviar WhatsApp a ${contact.name}`}
                              >
                                <MessageCircle className="w-3 h-3" />
                                Enviar WhatsApp
                              </a>
                            );
                          })()}
                        </div>
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    if (passwordForm.newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un símbolo");
      return;
    }
    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      toast.error("La nueva contraseña debe incluir al menos una letra mayúscula");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>_+\-=]/.test(passwordForm.newPassword)) {
      toast.error("La nueva contraseña debe incluir al menos un símbolo (!, $, #, etc.)");
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
                    placeholder="Ingresá tu nueva contraseña"
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
                {/* === Micro-badges de validación en tiempo real === */}
                {(() => {
                  const hasMinLength = passwordForm.newPassword.length >= 8;
                  const hasUppercase = /[A-Z]/.test(passwordForm.newPassword);
                  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_+\-=]/.test(passwordForm.newPassword);
                  return (
                    <div className={`flex flex-col gap-0.5 pt-1 transition-opacity ${passwordForm.newPassword ? "opacity-100" : "opacity-0"}`}>
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
                <Label htmlFor="confirm-pass">Confirmar contraseña *</Label>
                <div className="relative">
                  <Input
                    id="confirm-pass"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    className={`pr-10 transition-colors ${
                      passwordForm.confirmPassword && passwordForm.confirmPassword === passwordForm.newPassword
                        ? "border-emerald-400"
                        : passwordForm.confirmPassword
                          ? "border-red-400"
                          : "border-teal-200"
                    }`}
                    placeholder="Repetir nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {/* === Indicador de coincidencia === */}
                {passwordForm.confirmPassword && (
                  <div className={`text-[10px] flex items-center gap-1 transition-colors ${
                    passwordForm.confirmPassword === passwordForm.newPassword ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {passwordForm.confirmPassword === passwordForm.newPassword
                      ? <>✓ Las contraseñas coinciden</>
                      : <>✗ Las contraseñas no coinciden</>
                    }
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  savingPassword ||
                  !(
                    passwordForm.newPassword.length >= 8 &&
                    /[A-Z]/.test(passwordForm.newPassword) &&
                    /[!@#$%^&*(),.?":{}|<>_+\-=]/.test(passwordForm.newPassword) &&
                    passwordForm.newPassword === passwordForm.confirmPassword &&
                    passwordForm.currentPassword
                  )
                }
                className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
