"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  UserCheck,
  UserX,
  Filter,
  Search,
  Calendar,
  Stethoscope,
  Mail,
  Phone,
  MessageCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  X,
  Monitor,
  MapPin,
  Users,
  Zap,
  Info,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ---- Types ----

interface PatientRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  modality: string;
  reason: string;
  notes: string | null;
  // === Edad y Protocolo de Minoridad ===
  // patientAge y guardianName vienen del form público cuando el usuario
  // eligió "Solicitar Turno". El backend valida que patientAge sea
  // entero 1-120 y guardianName no vacío si < 18.
  patientAge: number | null;
  guardianName: string | null;
  status: string;
  assignedToId: string | null;
  appointmentId: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: {
    id: string;
    user: { name: string; email: string; phone: string };
    specialty: string;
  } | null;
  appointment: {
    id: string;
    date: string;
    time: string;
    modality: string | null;
    status: string;
  } | null;
}

interface Professional {
  id: string;
  userId: string;
  license: string;
  specialty: string;
  available: boolean;
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  user: { name: string; email: string; phone: string; active: boolean };
  schedules: ProfessionalScheduleItem[];
}

interface ProfessionalScheduleItem {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  modality: string;
}

interface Slot {
  time: string;
  endTime: string;
  modality: string;
  duration: number;
}

// ---- Constants ----

const REASON_LABELS: Record<string, string> = {
  ansiedad: "Ansiedad",
  vinculos: "Vínculos / Pareja",
  depresion: "Depresión",
  duelo: "Duelo / Pérdida",
  autoestima: "Autoestima",
  adicciones: "Adicciones",
  // === Motivos reestructurados (commit de hoy) ===
  // 'estres' antes era 'Estrés / Laboral' (unificado). Ahora es solo
  // 'Estrés' (clínica de la ansiedad, estrés vital, burnout). El motivo
  // 'Laboral' se separó a su propia entrada.
  estres: "Estrés",
  laboral: "Laboral",
  orientacion_padres: "Orientación a Padres",
  evaluaciones: "Evaluaciones",
  discapacidad: "Discapacidad",
  otros: "Otros",
  // === Motivos depreciados (commit de hoy) ===
  // Los dejamos mapeados por si quedan PatientRequests viejos en la DB
  // con estos valores — al menos el admin los ve con un label legible
  // en vez del string crudo. Son marcados con (obs.) para indicar que
  // ya no son opciones válidas del form público.
  infanto_juvenil: "Infanto-Juvenil (obs.)",
  consulta_general: "Consulta General (obs.)",
};

const MODALITY_LABELS: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  híbrida: "Híbrida",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: "Pendiente", variant: "outline", icon: Clock },
  assigned: { label: "Asignado", variant: "default", icon: CheckCircle2 },
  contacted: { label: "Contactado", variant: "secondary", icon: Send },
  rejected: { label: "Rechazado", variant: "destructive", icon: XCircle },
};

const DAY_LABELS: Record<number, string> = {
  1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb",
};

// ---- Main Component ----

export function AdminTriage() {
  const [requests, setRequests] = useState<PatientRequest[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Assignment dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PatientRequest | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [assigning, setAssigning] = useState(false);
  // Buscando primer slot disponible (botón "Primer turno disponible")
  const [findingNextSlot, setFindingNextSlot] = useState(false);
  // Modo "asignar sin turno" — el profesional va a coordinar el turno
  // directamente con el paciente. Deshabilita la validación de fecha/hora.
  const [noSlotMode, setNoSlotMode] = useState(false);

  // Stats
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const assignedCount = requests.filter((r) => r.status === "assigned").length;
  const contactedCount = requests.filter((r) => r.status === "contacted").length;

  const loadRequests = useCallback(() => {
    fetch("/api/patient-requests")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar solicitudes");
        return res.json();
      })
      .then((data) => {
        setRequests(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Error al cargar solicitudes");
        setLoading(false);
      });
  }, []);

  const loadProfessionals = useCallback(() => {
    // ?all=true returns flat array of active+licenseVerified professionals only
    fetch("/api/professionals?all=true")
      .then((res) => res.json())
      .then((data) => {
        // all=true always returns a flat array, but guard just in case
        const profs = Array.isArray(data) ? data : [];
        // Further filter to only available professionals for Triage assignment
        const availableProfs = profs.filter(
          (p: Professional) => p.available
        );
        // Load schedules for each professional
        return Promise.all(
          availableProfs.map(async (prof: Professional) => {
            try {
              const schedRes = await fetch(`/api/professionals/${prof.id}/schedule`);
              if (schedRes.ok) {
                const schedData = await schedRes.json();
                return { ...prof, schedules: Array.isArray(schedData) ? schedData : [] };
              }
            } catch {}
            return { ...prof, schedules: [] };
          })
        );
      })
      .then((profsWithSchedules) => {
        setProfessionals(profsWithSchedules || []);
      })
      .catch(() => {
        toast.error("Error al cargar profesionales");
      });
  }, []);

  useEffect(() => {
    loadRequests();
    loadProfessionals();
  }, [loadRequests, loadProfessionals]);

  // Load available slots when professional and date are selected
  useEffect(() => {
    if (selectedProfessionalId && selectedDate) {
      setLoadingSlots(true);
      setAvailableSlots([]);
      setSelectedTime("");
      fetch(
        `/api/professionals/${selectedProfessionalId}/slots?date=${selectedDate}`
      )
        .then((res) => res.json())
        .then((data) => {
          setAvailableSlots(data);
          setLoadingSlots(false);
        })
        .catch(() => {
          setAvailableSlots([]);
          setLoadingSlots(false);
        });
    } else {
      setAvailableSlots([]);
      setSelectedTime("");
    }
  }, [selectedProfessionalId, selectedDate]);

  // Busca el primer slot disponible en los próximos 14 días para el
  // profesional seleccionado. Si lo encuentra, setea la fecha y hora
  // automáticamente. Útil cuando el admin quiere asignar rápido sin
  // tener que revisar día por día.
  const findNextAvailableSlot = async () => {
    if (!selectedProfessionalId) return;
    setFindingNextSlot(true);
    try {
      const res = await fetch(
        `/api/professionals/${selectedProfessionalId}/next-available-slot`
      );
      const data = await res.json();
      if (data.date) {
        // Setear la fecha primero — el useEffect de arriba va a cargar
        // los slots de ese día. Después de que carguen, seteamos la hora.
        setSelectedDate(data.date);
        // Pequeño timeout para que el useEffect corra primero
        setTimeout(() => {
          setSelectedTime(data.time);
          setNoSlotMode(false);
        }, 200);
        toast.success(
          `Primer turno disponible: ${data.date} ${data.time}-${data.endTime} hs`
        );
      } else {
        toast.info(
          "El profesional no tiene turnos disponibles en los próximos 14 días. " +
          "Probá asignar sin turno inicial (el profesional coordinará con el paciente)."
        );
      }
    } catch {
      toast.error("Error al buscar próximo turno disponible");
    } finally {
      setFindingNextSlot(false);
    }
  };

  // Filter professionals by specialty matching the request's reason
  const getMatchingProfessionals = (request: PatientRequest) => {
    if (!request.reason) return professionals;

    const reasonSpecialtyMap: Record<string, string[]> = {
      // === Motivos tradicionales ===
      vinculos: ["Terapia de Pareja y Familia", "Psicología Clínica"],
      ansiedad: ["Psicología Clínica"],
      depresion: ["Psicología Clínica"],
      duelo: ["Psicología Clínica"],
      autoestima: ["Psicología Clínica"],
      adicciones: ["Psicología Clínica"],
      // === Motivos nuevos (reestructuración) ===
      // estrés: clínica de la ansiedad, estrés vital, burnout → clínica
      estres: ["Psicología Clínica"],
      // laboral: orientación vocacional, problemáticas del entorno de
      // trabajo, desarrollo profesional, inserción → clínica (en
      // Argentina suele caer en Psicología Clínica; si en el futuro
      // agregan specialty "Psicología Laboral" se suma acá)
      laboral: ["Psicología Clínica"],
      // orientación a padres: consultas de crianza y dinámicas
      // familiares → Terapia de Pareja y Familia + Clínica
      orientacion_padres: ["Terapia de Pareja y Familia", "Psicología Clínica"],
      // evaluaciones: psicodiagnósticos, aptos psicológicos,
      // evaluaciones neurocognitivas → Clínica (cualquier profesional
      // clínico puede hacerlas)
      evaluaciones: ["Psicología Clínica"],
      // discapacidad: abordajes específicos y acompañamiento
      // integrador → Clínica
      discapacidad: ["Psicología Clínica"],
      // === Motivos sin derivación específica ===
      // 'otros' y los depreciados no filtran profesionales
      otros: [],
      infanto_juvenil: ["Psicología Infanto-Juvenil"], // obs.
      consulta_general: [], // obs.
    };

    const matchingSpecialties = reasonSpecialtyMap[request.reason];
    if (!matchingSpecialties || matchingSpecialties.length === 0) {
      return professionals;
    }

    const matched = professionals.filter((p) =>
      matchingSpecialties.includes(p.specialty)
    );
    return matched.length > 0 ? matched : professionals;
  };

  // Get schedule summary for a professional
  const getScheduleSummary = (prof: Professional) => {
    if (!prof.schedules || prof.schedules.length === 0) {
      return "Sin horario configurado";
    }
    const days = prof.schedules
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((s) => DAY_LABELS[s.dayOfWeek] || `D${s.dayOfWeek}`);
    
    if (days.length >= 5) {
      const firstTime = prof.schedules[0]?.startTime;
      const lastEndTime = prof.schedules.reduce((max, s) => 
        s.endTime > max ? s.endTime : max, prof.schedules[0]?.endTime || ""
      );
      return `Lun-Vie ${firstTime?.slice(0,5)}-${lastEndTime?.slice(0,5)}`;
    }
    return `${days.join(", ")} ${prof.schedules[0]?.startTime?.slice(0,5)}-${prof.schedules[0]?.endTime?.slice(0,5)}`;
  };

  // Get modality badges for professional
  const getModalityBadges = (prof: Professional) => {
    const badges: string[] = [];
    if (prof.onlineAttention) badges.push("Online");
    if (prof.presentialAttention) badges.push("Presencial");
    if (prof.homeAttention) badges.push("Domicilio");
    if (badges.length === 0) badges.push("Sin modalidad");
    return badges;
  };

  const handleAssign = async () => {
    if (!selectedRequest || !selectedProfessionalId) return;

    setAssigning(true);
    try {
      const professional = professionals.find(
        (p) => p.id === selectedProfessionalId
      );

      const res = await fetch(`/api/patient-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          professionalId: selectedProfessionalId,
          date: selectedDate || undefined,
          time: selectedTime || undefined,
          appointmentModality: selectedRequest.modality === "online" ? "OL" : "P",
          patientName: selectedRequest.name,
          patientEmail: selectedRequest.email,
          patientReason: selectedRequest.reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al asignar");
      }

      const data = await res.json();
      toast.success(
        `Solicitud asignada a ${professional?.user.name || "profesional"}`
      );

      // Aviso al admin si algún email de notificación falló (no es error,
      // la asignación se completó OK). Las causas más comunes son:
      //   - EMAIL_FROM no configurada en Vercel → Resend cae al sandbox y
      //     descarta los emails a pacientes/profesionales
      //   - RESEND_API_KEY inválida o expirada
      //   - Dominio no verificado en Resend
      if (data.emailSent) {
        const failed: string[] = [];
        if (!data.emailSent.professional) failed.push("al profesional");
        if (!data.emailSent.patient) failed.push("al paciente");
        if (failed.length > 0) {
          toast.warning(
            `Asignación OK, pero no se pudo enviar email ${failed.join(" ni ")}. ` +
            "Revisá EMAIL_FROM y RESEND_API_KEY en Vercel."
          );
        }
      }

      setAssignDialogOpen(false);
      setSelectedRequest(null);
      setSelectedProfessionalId("");
      setSelectedDate("");
      setSelectedTime("");
      loadRequests();
    } catch (error: any) {
      toast.error(error.message || "Error al asignar profesional");
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/patient-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Error al actualizar estado");

      toast.success("Estado actualizado");
      loadRequests();
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que querés eliminar esta solicitud?"))
      return;
    try {
      const res = await fetch(`/api/patient-requests/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Solicitud eliminada");
        loadRequests();
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const openAssignDialog = (request: PatientRequest, professionalId?: string) => {
    setSelectedRequest(request);
    setSelectedProfessionalId(professionalId || "");
    setSelectedDate("");
    setSelectedTime("");
    setNoSlotMode(false);
    setAssignDialogOpen(true);
  };

  // Click-to-assign: when admin clicks on a professional while a request is selected
  const handleProfessionalClick = (prof: Professional) => {
    if (selectedRequest) {
      openAssignDialog(selectedRequest, prof.id);
    }
  };

  // Filter requests
  const filtered = requests.filter((r) => {
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Get today and next 14 days for date selection
  const getAvailableDates = () => {
    const dates: { value: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0) continue; // Skip Sundays
      // Use sv-SE locale for YYYY-MM-DD — evaluates in local timezone, not UTC
      // toISOString() would shift date after 21:00 in Argentina (UTC-3)
      dates.push({
        value: d.toLocaleDateString("sv-SE"),
        label: d.toLocaleDateString("es-AR", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      });
    }
    return dates;
  };

  // Get matched professionals for the selected request
  const matchedProfs = selectedRequest ? getMatchingProfessionals(selectedRequest) : professionals;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-teal-900">Triage</h2>
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full animate-pulse">
              {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card
          className={`border-teal-100 cursor-pointer transition-all ${
            statusFilter === "pending" ? "ring-2 ring-amber-400" : ""
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === "pending" ? "all" : "pending")
          }
        >
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-2xl font-bold text-amber-700 mt-1">
              {pendingCount}
            </p>
            <p className="text-sm text-amber-600">Pendientes</p>
          </CardContent>
        </Card>
        <Card
          className={`border-teal-100 cursor-pointer transition-all ${
            statusFilter === "assigned" ? "ring-2 ring-teal-400" : ""
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === "assigned" ? "all" : "assigned")
          }
        >
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-teal-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-700 mt-1">
              {assignedCount}
            </p>
            <p className="text-sm text-teal-600">Asignados</p>
          </CardContent>
        </Card>
        <Card
          className={`border-teal-100 cursor-pointer transition-all ${
            statusFilter === "contacted" ? "ring-2 ring-blue-400" : ""
          }`}
          onClick={() =>
            setStatusFilter(
              statusFilter === "contacted" ? "all" : "contacted"
            )
          }
        >
          <CardContent className="p-4 text-center">
            <Send className="w-6 h-6 text-blue-500 mx-auto" />
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {contactedCount}
            </p>
            <p className="text-sm text-blue-600">Contactados</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Patient Requests */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-teal-900">Solicitudes de Pacientes</h3>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-teal-200 w-48"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 border-teal-200">
                  <Filter className="w-4 h-4 mr-2 text-teal-400" />
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="assigned">Asignados</SelectItem>
                  <SelectItem value="contacted">Contactados</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-teal-50 animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-teal-100">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-teal-200 mx-auto" />
                <p className="text-teal-600 mt-2">
                  No hay solicitudes{" "}
                  {statusFilter !== "all"
                    ? `con estado "${STATUS_CONFIG[statusFilter]?.label || statusFilter}"`
                    : ""}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar">
              {filtered.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const isExpanded = expandedId === req.id;
                const isSelected = selectedRequest?.id === req.id;

                return (
                  <Card
                    key={req.id}
                    className={`border-teal-100 cursor-pointer transition-all ${
                      req.status === "pending"
                        ? "border-l-4 border-l-amber-400"
                        : req.status === "assigned"
                        ? "border-l-4 border-l-teal-400"
                        : ""
                    } ${isSelected ? "ring-2 ring-teal-300" : ""}`}
                    onClick={() => {
                      setSelectedRequest(isSelected ? null : req);
                      setExpandedId(isExpanded ? null : req.id);
                    }}
                  >
                    <CardContent className="p-4">
                      {/* Main Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-teal-900">{req.name}</p>
                            <Badge variant={statusCfg.variant}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusCfg.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {MODALITY_LABELS[req.modality] || req.modality}
                            </Badge>
                          </div>
                          {/* Contacto rápido: WhatsApp + Email */}
                          {(req.phone || req.email) && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              {req.phone && (
                                <a
                                  href={`https://wa.me/${req.phone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 hover:underline transition-colors"
                                  title={`Enviar WhatsApp a ${req.name}`}
                                >
                                  <MessageCircle className="w-3 h-3 text-emerald-500" />
                                  {req.phone}
                                </a>
                              )}
                              {req.email && (
                                <a
                                  href={`mailto:${req.email}`}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline transition-colors"
                                  title={`Enviar email a ${req.name}`}
                                >
                                  <Mail className="w-3 h-3 text-teal-500" />
                                  {req.email}
                                </a>
                              )}
                            </div>
                          )}
                          {!req.phone && !req.email && (
                            <p className="text-xs text-teal-400 italic mt-1">
                              Sin datos de contacto
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-sm">
                            <span className="text-teal-500">
                              {REASON_LABELS[req.reason] || req.reason}
                            </span>
                            <span className="text-teal-300">•</span>
                            <span className="text-teal-400 text-xs">
                              {new Date(req.createdAt).toLocaleDateString("es-AR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {/* === Edad del paciente + Protocolo de Minoridad === */}
                          {/* Visible para admin/super_admin en la tarjeta de triage
                              para que pueda asignar al profesional adecuado (ej:
                              infanto-juvenil para menores). */}
                          {req.patientAge != null && (
                            <div className="mt-1 flex items-center gap-2 text-xs flex-wrap">
                              <Badge variant="outline" className="text-xs bg-teal-50 border-teal-200 text-teal-700">
                                Edad: {req.patientAge}
                              </Badge>
                              {(() => {
                                const age = req.patientAge!;
                                let label = "";
                                let colorClass = "";
                                if (age <= 11) { label = "Niñez"; colorClass = "bg-teal-50 text-teal-700 border-teal-200"; }
                                else if (age <= 17) { label = "Adolescencia"; colorClass = "bg-amber-50 text-amber-700 border-amber-200"; }
                                else if (age <= 26) { label = "Joven Adulto"; colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200"; }
                                else if (age <= 59) { label = "Adulto"; colorClass = "bg-blue-50 text-blue-700 border-blue-200"; }
                                else { label = "Adulto Mayor"; colorClass = "bg-purple-50 text-purple-700 border-purple-200"; }
                                return (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                                    {label}
                                  </span>
                                );
                              })()}
                              {req.patientAge < 18 && req.guardianName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-800 border-amber-300">
                                  <ShieldAlert className="w-3 h-3" />
                                  Tutor: {req.guardianName}
                                </span>
                              )}
                            </div>
                          )}
                          {req.assignedTo && (
                            <div className="mt-2 flex items-center gap-2 text-sm bg-teal-50 px-3 py-1.5 rounded-lg w-fit">
                              <Stethoscope className="w-4 h-4 text-teal-500" />
                              <span className="text-teal-700 font-medium">
                                {req.assignedTo.user.name}
                              </span>
                              <span className="text-teal-400">•</span>
                              <span className="text-teal-500">
                                {req.assignedTo.specialty}
                              </span>
                              {req.appointment && (
                                <>
                                  <span className="text-teal-400">•</span>
                                  <span className="text-teal-600">
                                    {req.appointment.date} {req.appointment.time} hs
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {req.status === "pending" && (
                            <Button
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs"
                              onClick={() => openAssignDialog(req)}
                            >
                              <UserCheck className="mr-1 w-3.5 h-3.5" />
                              Asignar
                            </Button>
                          )}
                          {req.status === "assigned" && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                              onClick={() =>
                                handleStatusChange(req.id, "contacted")
                              }
                            >
                              <Send className="mr-1 w-3.5 h-3.5" />
                              Contactado
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-red-400 hover:text-red-600"
                            onClick={() => handleDelete(req.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-teal-100 space-y-2 text-sm">
                          {req.notes && (
                            <div>
                              <span className="text-teal-500 font-medium">
                                Notas del paciente:
                              </span>
                              <p className="text-teal-700 mt-0.5 bg-teal-50 p-2 rounded">
                                {req.notes}
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-teal-500">Modalidad preferida:</span>{" "}
                              <span className="text-teal-700 font-medium">
                                {MODALITY_LABELS[req.modality] || req.modality}
                              </span>
                            </div>
                            <div>
                              <span className="text-teal-500">Motivo:</span>{" "}
                              <span className="text-teal-700 font-medium">
                                {REASON_LABELS[req.reason] || req.reason}
                              </span>
                            </div>
                          </div>
                          {req.status === "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-teal-200"
                              onClick={() =>
                                handleStatusChange(req.id, "pending")
                              }
                            >
                              Reabrir solicitud
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Professional Availability */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-teal-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Profesionales
            </h3>
            <Badge variant="outline" className="text-xs">
              {professionals.length} disponibles
            </Badge>
          </div>

          {selectedRequest && (
            <div className="mb-4 p-3 bg-teal-50 rounded-lg border border-teal-200">
              <p className="text-xs text-teal-600 font-medium">
                Hacé clic en un profesional para asignar a:
              </p>
              <p className="text-sm text-teal-900 font-semibold mt-1">
                {selectedRequest.name}
              </p>
              <p className="text-xs text-teal-500">
                {REASON_LABELS[selectedRequest.reason] || selectedRequest.reason} • {MODALITY_LABELS[selectedRequest.modality] || selectedRequest.modality}
              </p>
            </div>
          )}

          <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar">
            {professionals.map((prof) => {
              const modalityBadges = getModalityBadges(prof);
              const scheduleSummary = getScheduleSummary(prof);
              const isMatch = selectedRequest
                ? getMatchingProfessionals(selectedRequest).some((p) => p.id === prof.id)
                : true;

              return (
                <Card
                  key={prof.id}
                  className={`border-teal-100 cursor-pointer transition-all hover:shadow-md ${
                    isMatch && selectedRequest ? "border-l-4 border-l-teal-400" : ""
                  } ${!isMatch && selectedRequest ? "opacity-50" : ""}`}
                  onClick={() => handleProfessionalClick(prof)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-teal-900 text-sm truncate">
                          {prof.user.name}
                        </p>
                        <p className="text-xs text-teal-500">
                          {prof.specialty}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0 text-teal-500 hover:text-teal-700 hover:bg-teal-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssignDialog(
                            selectedRequest || requests.find((r) => r.status === "pending")!,
                            prof.id
                          );
                        }}
                        disabled={!selectedRequest && !requests.some((r) => r.status === "pending")}
                      >
                        <UserCheck className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Modality badges */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {modalityBadges.map((badge) => (
                        <Badge
                          key={badge}
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            badge === "Online"
                              ? "bg-blue-50 border-blue-200 text-blue-600"
                              : badge === "Presencial"
                              ? "bg-teal-50 border-teal-200 text-teal-600"
                              : "bg-purple-50 border-purple-200 text-purple-600"
                          }`}
                        >
                          {badge === "Online" && <Monitor className="w-2.5 h-2.5 mr-0.5" />}
                          {badge === "Presencial" && <MapPin className="w-2.5 h-2.5 mr-0.5" />}
                          {badge}
                        </Badge>
                      ))}
                    </div>

                    {/* Schedule summary */}
                    <p className="text-[10px] text-teal-400 mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {scheduleSummary}
                    </p>
                  </CardContent>
                </Card>
              );
            })}

            {professionals.length === 0 && (
              <Card className="border-teal-100">
                <CardContent className="py-8 text-center">
                  <Stethoscope className="w-8 h-8 text-teal-200 mx-auto" />
                  <p className="text-teal-500 text-sm mt-2">No hay profesionales disponibles</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-teal-900">
              Asignar Profesional
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Patient Info */}
              <div className="bg-teal-50 p-3 rounded-lg">
                <p className="font-medium text-teal-900">
                  {selectedRequest.name}
                </p>
                {/* Contacto rápido: WhatsApp + Email */}
                {(selectedRequest.phone || selectedRequest.email) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {selectedRequest.phone && (
                      <a
                        href={`https://wa.me/${selectedRequest.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 hover:underline transition-colors"
                        title={`Enviar WhatsApp a ${selectedRequest.name}`}
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-500" />
                        {selectedRequest.phone}
                      </a>
                    )}
                    {selectedRequest.email && (
                      <a
                        href={`mailto:${selectedRequest.email}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-700 hover:underline transition-colors"
                        title={`Enviar email a ${selectedRequest.name}`}
                      >
                        <Mail className="w-3 h-3 text-teal-500" />
                        {selectedRequest.email}
                      </a>
                    )}
                  </div>
                )}
                {!selectedRequest.phone && !selectedRequest.email && (
                  <p className="text-xs text-teal-400 italic mt-1">
                    Sin datos de contacto
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {MODALITY_LABELS[selectedRequest.modality] ||
                      selectedRequest.modality}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {REASON_LABELS[selectedRequest.reason] ||
                      selectedRequest.reason}
                  </Badge>
                </div>
              </div>

              {/* Professional Selection */}
              <div className="space-y-2">
                <Label className="text-teal-700">
                  Profesional recomendado
                </Label>
                <Select
                  value={selectedProfessionalId}
                  onValueChange={(value) => {
                    setSelectedProfessionalId(value);
                    setSelectedDate("");
                    setSelectedTime("");
                  }}
                >
                  <SelectTrigger className="border-teal-200">
                    <SelectValue placeholder="Seleccionar profesional" />
                  </SelectTrigger>
                  <SelectContent>
                    {matchedProfs.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.user.name} — {prof.specialty}
                        {prof.onlineAttention ? " 🟢 Online" : ""}
                        {prof.presentialAttention ? " 🏠 Presencial" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-teal-400">
                  {matchedProfs.length} profesional
                  {matchedProfs.length !== 1 ? "es" : ""} disponible
                  {matchedProfs.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Quick action: Primer turno disponible */}
              {selectedProfessionalId && !noSlotMode && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-teal-300 text-teal-700 hover:bg-teal-50"
                    disabled={findingNextSlot}
                    onClick={findNextAvailableSlot}
                  >
                    {findingNextSlot ? (
                      <>
                        <div className="w-3 h-3 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin mr-1" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-1 w-3.5 h-3.5" />
                        Primer turno disponible
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-teal-600 hover:bg-teal-50"
                    onClick={() => {
                      setNoSlotMode(true);
                      setSelectedDate("");
                      setSelectedTime("");
                      setAvailableSlots([]);
                    }}
                  >
                    <Info className="mr-1 w-3.5 h-3.5" />
                    Asignar sin turno
                  </Button>
                </div>
              )}

              {/* Aviso cuando noSlotMode está activo */}
              {noSlotMode && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-900 font-medium mb-1">
                        Asignación sin turno inicial
                      </p>
                      <p className="text-xs text-amber-800">
                        El paciente queda asociado al profesional, pero sin fecha ni hora.
                        El profesional deberá coordinar el turno directamente con el paciente
                        (por WhatsApp o email).
                      </p>
                      <button
                        type="button"
                        onClick={() => setNoSlotMode(false)}
                        className="text-xs text-amber-700 underline hover:text-amber-900 mt-2"
                      >
                        Cancelar y elegir fecha
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Selection */}
              {selectedProfessionalId && !noSlotMode && (
                <div className="space-y-2">
                  <Label className="text-teal-700">Fecha</Label>
                  <Select
                    value={selectedDate}
                    onValueChange={(value) => {
                      setSelectedDate(value);
                      setSelectedTime("");
                    }}
                  >
                    <SelectTrigger className="border-teal-200">
                      <SelectValue placeholder="Seleccionar fecha" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableDates().map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Time Selection */}
              {selectedDate && !noSlotMode && (
                <div className="space-y-2">
                  <Label className="text-teal-700">Horario disponible</Label>
                  {loadingSlots ? (
                    <div className="flex items-center gap-2 text-teal-500 text-sm">
                      <div className="w-4 h-4 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin" />
                      Cargando horarios...
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-amber-600 text-sm">
                      No hay horarios disponibles para esta fecha
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`px-2 py-2 text-xs rounded-lg border transition-all font-mono ${
                            selectedTime === slot.time
                              ? "bg-teal-600 text-white border-teal-600"
                              : "border-teal-200 text-teal-700 hover:bg-teal-50"
                          }`}
                        >
                          {slot.time}-{slot.endTime}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={
                    assigning ||
                    !selectedProfessionalId ||
                    (!noSlotMode && (!selectedDate || !selectedTime))
                  }
                  onClick={handleAssign}
                >
                  {assigning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Asignando...
                    </>
                  ) : noSlotMode ? (
                    <>
                      <UserCheck className="mr-2 w-4 h-4" />
                      Asignar sin turno
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-2 w-4 h-4" />
                      Asignar
                      {selectedTime
                        ? ` — ${selectedDate.slice(5)} ${selectedTime}-${availableSlots.find(s => s.time === selectedTime)?.endTime || ""}`
                        : ""}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-teal-300"
                  onClick={() => setAssignDialogOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
