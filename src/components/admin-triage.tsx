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
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  X,
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
}

interface Slot {
  time: string;
  modality: string;
}

// ---- Constants ----

const REASON_LABELS: Record<string, string> = {
  ansiedad: "Ansiedad",
  vinculos: "Vínculos / Pareja",
  depresion: "Depresión",
  duelo: "Duelo / Pérdida",
  autoestima: "Autoestima",
  estres: "Estrés / Laboral",
  infanto_juvenil: "Infanto-Juvenil",
  adicciones: "Adicciones",
  consulta_general: "Consulta General",
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
    fetch("/api/professionals")
      .then((res) => res.json())
      .then((data) => {
        // Only show active, available professionals
        setProfessionals(
          data.filter(
            (p: Professional) => p.user.active && p.available
          )
        );
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

  // Filter professionals by specialty matching the request's reason
  const getMatchingProfessionals = (request: PatientRequest) => {
    if (!request.reason) return professionals;

    const reasonSpecialtyMap: Record<string, string[]> = {
      infanto_juvenil: ["Psicología Infanto-Juvenil"],
      vinculos: ["Terapia de Pareja y Familia", "Psicología Clínica"],
      ansiedad: ["Psicología Clínica"],
      depresion: ["Psicología Clínica"],
      duelo: ["Psicología Clínica"],
      autoestima: ["Psicología Clínica"],
      estres: ["Psicología Clínica"],
      adicciones: ["Psicología Clínica"],
      consulta_general: [],
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

      toast.success(
        `Solicitud asignada a ${professional?.user.name || "profesional"}`
      );
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

  const openAssignDialog = (request: PatientRequest) => {
    setSelectedRequest(request);
    setSelectedProfessionalId("");
    setSelectedDate("");
    setSelectedTime("");
    setAssignDialogOpen(true);
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
      dates.push({
        value: d.toISOString().split("T")[0],
        label: d.toLocaleDateString("es-AR", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      });
    }
    return dates;
  };

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

      {/* Search and Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-teal-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 border-teal-200">
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

      {/* Requests List */}
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
        <div className="space-y-3 max-h-[calc(100vh-440px)] overflow-y-auto custom-scrollbar">
          {filtered.map((req) => {
            const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedId === req.id;
            const matchedProfs = getMatchingProfessionals(req);

            return (
              <Card
                key={req.id}
                className={`border-teal-100 ${
                  req.status === "pending"
                    ? "border-l-4 border-l-amber-400"
                    : req.status === "assigned"
                    ? "border-l-4 border-l-teal-400"
                    : ""
                }`}
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
                      <div className="flex items-center gap-4 mt-1 text-sm text-teal-600">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {req.email}
                        </span>
                        {req.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {req.phone}
                          </span>
                        )}
                      </div>
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
                    <div className="flex items-center gap-2 shrink-0">
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
                        className="h-8 text-teal-400 hover:text-teal-600"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : req.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
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
                <p className="text-sm text-teal-600">{selectedRequest.email}</p>
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

              {/* Date Selection */}
              {selectedProfessionalId && (
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
              {selectedDate && (
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
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                            selectedTime === slot.time
                              ? "bg-teal-600 text-white border-teal-600"
                              : "border-teal-200 text-teal-700 hover:bg-teal-50"
                          }`}
                        >
                          {slot.time}
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
                    assigning || !selectedProfessionalId
                  }
                  onClick={handleAssign}
                >
                  {assigning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Asignando...
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-2 w-4 h-4" />
                      Asignar
                      {selectedTime
                        ? ` — ${selectedDate.slice(5)} ${selectedTime}`
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
