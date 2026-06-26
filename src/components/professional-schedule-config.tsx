"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  MapPin,
  Monitor,
  CheckCircle2,
  XCircle,
  Edit3,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

// ===== Types =====
interface ScheduleEntry {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  modality: string;
  // === direccionId: enlace a ProfessionalAddress ===
  // Opcional. Solo se setea cuando la modalidad es presencial ("P" o "ambas").
  // Permite al profesional asignar una dirección específica a cada bloque horario.
  direccionId?: string | null;
}

interface OverrideEntry {
  id?: string;
  date: string;
  type: "block" | "extra";
  startTime?: string | null;
  endTime?: string | null;
  slotDuration?: number | null;
  modality?: string | null;
  direccionId?: string | null;
  reason?: string | null;
}

// === Dirección del profesional (para el selector) ===
interface ProfessionalAddressOption {
  id: string;
  label: string;
  address: string;
}

const DAYS_MAP: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

const DAYS_SHORT: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

const MODALITY_MAP: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  P: { label: "Presencial", icon: MapPin },
  OL: { label: "Online", icon: Monitor },
  H: { label: "Híbrida (lo que suceda primero)", icon: CheckCircle2 },
  ambas: { label: "Presencial y Online", icon: CheckCircle2 },
};

const DURATION_OPTIONS = [40, 45, 60];

// Opciones horarias de 06:00 a 24:00 (medianoche) en intervalos de 30 min.
// Ampliado desde el rango anterior (07:00-22:00) para soportar jornadas
// extendidas. 24:00 se representa como "24:00" (cierre de jornada).
const TIME_OPTIONS = (() => {
  const options: string[] = [];
  for (let h = 6; h <= 24; h++) {
    options.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 24) {
      options.push(`${h.toString().padStart(2, "0")}:30`);
    }
  }
  return options;
})();

export function ProfessionalScheduleConfig() {
  const { data: session } = useSession();
  const [professionalId, setProfessionalId] = useState<string>("");
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [overrides, setOverrides] = useState<OverrideEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"weekly" | "overrides">("weekly");

  // New schedule form
  const [newDay, setNewDay] = useState<number>(1);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("18:00");
  const [newDuration, setNewDuration] = useState(45);
  const [newModality, setNewModality] = useState("ambas");
  // === direccionId para el bloque de schedule que se está creando/editando ===
  // Solo se habilita cuando newModality es "P" o "ambas" (presencial).
  const [newDireccionId, setNewDireccionId] = useState<string>("");
  const [editingScheduleIdx, setEditingScheduleIdx] = useState<number | null>(null);

  // New override form
  const [overrideDate, setOverrideDate] = useState<Date>();
  const [overrideType, setOverrideType] = useState<"block" | "extra">("block");
  const [overrideStart, setOverrideStart] = useState("09:00");
  const [overrideEnd, setOverrideEnd] = useState("13:00");
  const [overrideDuration, setOverrideDuration] = useState(45);
  const [overrideModality, setOverrideModality] = useState("ambas");
  const [overrideDireccionId, setOverrideDireccionId] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);
  const [overrideDatePickerOpen, setOverrideDatePickerOpen] = useState(false);

  // === Direcciones del profesional (para el selector) ===
  // Se cargan al montar el componente. Si no hay direcciones cargadas,
  // el selector aparece vacío y el profesional puede guardar el schedule
  // sin dirección (el sistema le avisará que falta).
  const [addresses, setAddresses] = useState<ProfessionalAddressOption[]>([]);

  // Load professional ID and data
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
            loadData(prof.id);
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  const loadData = async (profId: string) => {
    try {
      const [scheduleRes, overridesRes, addressesRes] = await Promise.all([
        fetch(`/api/professionals/${profId}/schedule`),
        fetch(`/api/professionals/${profId}/overrides`),
        fetch(`/api/professionals/${profId}/addresses`),
      ]);
      const scheduleData = await scheduleRes.json();
      const overridesData = await overridesRes.json();
      const addressesData = await addressesRes.json();
      setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
      setOverrides(Array.isArray(overridesData) ? overridesData : []);
      setAddresses(Array.isArray(addressesData) ? addressesData : []);
    } catch {
      toast.error("Error al cargar agenda");
    } finally {
      setLoading(false);
    }
  };

  // Add or update schedule entry
  const handleAddSchedule = () => {
    if (newStart >= newEnd) {
      toast.error("La hora de inicio debe ser anterior a la de fin");
      return;
    }

    // Check for overlap on same day (excluding the entry being edited)
    const overlap = schedules.find(
      (s, i) => i !== editingScheduleIdx && s.dayOfWeek === newDay && newStart < s.endTime && newEnd > s.startTime
    );
    if (overlap) {
      toast.error(`Ya existe un horario el ${DAYS_MAP[newDay]} que se superpone (${overlap.startTime} - ${overlap.endTime})`);
      return;
    }

    // === Validar que si la modalidad es presencial, tenga dirección ===
    // Solo si el profesional tiene direcciones cargadas. Si no tiene ninguna,
    // le permitimos guardar sin dirección pero le avisamos.
    const isPresencial = newModality === "P" || newModality === "ambas";
    if (isPresencial && addresses.length > 0 && !newDireccionId) {
      const confirmar = confirm(
        "Estás creando un bloque presencial sin asignar una dirección.\n\n" +
        "El paciente NO recibirá la dirección en el email de confirmación.\n\n" +
        "¿Querés continuar de todas formas?"
      );
      if (!confirmar) return;
    }

    const newEntry: ScheduleEntry = {
      dayOfWeek: newDay,
      startTime: newStart,
      endTime: newEnd,
      slotDuration: newDuration,
      modality: newModality,
      direccionId: newDireccionId || null,
    };

    if (editingScheduleIdx !== null) {
      // Update existing entry
      setSchedules((prev) =>
        prev
          .map((s, i) => (i === editingScheduleIdx ? newEntry : s))
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
      );
      setEditingScheduleIdx(null);
      toast.success("Horario modificado. Recordá guardar los cambios.");
    } else {
      // Add new entry
      setSchedules((prev) => [...prev, newEntry].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    }
  };

  // Remove schedule entry
  const handleRemoveSchedule = (index: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
    if (editingScheduleIdx === index) {
      setEditingScheduleIdx(null);
      resetScheduleForm();
    } else if (editingScheduleIdx !== null && editingScheduleIdx > index) {
      setEditingScheduleIdx(editingScheduleIdx - 1);
    }
  };

  // Edit schedule entry - populate form with existing values
  const handleEditSchedule = (index: number) => {
    const entry = schedules[index];
    if (!entry) return;
    setNewDay(entry.dayOfWeek);
    setNewStart(entry.startTime);
    setNewEnd(entry.endTime);
    setNewDuration(entry.slotDuration);
    setNewModality(entry.modality);
    setNewDireccionId(entry.direccionId || "");
    setEditingScheduleIdx(index);
  };

  // Reset schedule form to defaults
  const resetScheduleForm = () => {
    setNewDay(1);
    setNewStart("09:00");
    setNewEnd("18:00");
    setNewDuration(45);
    setNewModality("ambas");
    setNewDireccionId("");
    setEditingScheduleIdx(null);
  };

  // Save all schedules
  const handleSaveSchedules = async () => {
    if (!professionalId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/professionals/${professionalId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules }),
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
        toast.success("Agenda semanal guardada exitosamente");
      } else {
        const error = await res.json();
        toast.error(error.error || "Error al guardar agenda");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  // Add or update override
  const handleAddOverride = async () => {
    if (!professionalId || !overrideDate) {
      toast.error("Seleccioná una fecha");
      return;
    }

    const dateStr = format(overrideDate, "yyyy-MM-dd");

    try {
      const body: Record<string, unknown> = {
        date: dateStr,
        type: overrideType,
        reason: overrideReason || null,
      };

      if (overrideType === "extra") {
        body.startTime = overrideStart;
        body.endTime = overrideEnd;
        body.slotDuration = overrideDuration;
        body.modality = overrideModality;
        body.direccionId = overrideDireccionId || null;
      }

      const isEditing = editingOverrideId !== null;
      const url = isEditing
        ? `/api/professionals/${professionalId}/overrides?overrideId=${editingOverrideId}`
        : `/api/professionals/${professionalId}/overrides`;
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const savedOverride = await res.json();
        if (isEditing) {
          setOverrides((prev) =>
            prev
          .map((o) => (o.id === editingOverrideId ? savedOverride : o))
          .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""))
        );
        toast.success("Excepción actualizada");
        } else {
          setOverrides((prev) =>
          [...prev, savedOverride].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""))
        );
        toast.success(overrideType === "block" ? "Día bloqueado" : "Horario extra agregado");
        }
        resetOverrideForm();
      } else {
        const error = await res.json();
        toast.error(error.error || "Error al agregar excepción");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  // Edit override - populate form with existing values
  const handleEditOverride = (override: OverrideEntry) => {
    if (!override.id) return;
    setEditingOverrideId(override.id);
    setOverrideType(override.type);
    setOverrideReason(override.reason || "");
    if (override.date) {
      setOverrideDate(new Date(override.date + "T00:00:00"));
    }
    if (override.type === "extra") {
      setOverrideStart(override.startTime || "09:00");
      setOverrideEnd(override.endTime || "13:00");
      setOverrideDuration(override.slotDuration || 45);
      setOverrideModality(override.modality || "ambas");
      setOverrideDireccionId(override.direccionId || "");
    }
  };

  // Reset override form
  const resetOverrideForm = () => {
    setOverrideDate(undefined);
    setOverrideType("block");
    setOverrideStart("09:00");
    setOverrideEnd("13:00");
    setOverrideDuration(45);
    setOverrideModality("ambas");
    setOverrideDireccionId("");
    setOverrideReason("");
    setEditingOverrideId(null);
    setOverrideDatePickerOpen(false);
  };

  // Delete override
  const handleDeleteOverride = async (overrideId: string) => {
    if (!professionalId) return;
    try {
      const res = await fetch(
        `/api/professionals/${professionalId}/overrides?overrideId=${overrideId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
        toast.success("Excepción eliminada");
        if (editingOverrideId === overrideId) {
          resetOverrideForm();
        }
      }
    } catch {
      toast.error("Error al eliminar excepción");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-teal-50 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-teal-900">Mi Agenda</h2>
        {activeTab === "weekly" && (
          <Button
            onClick={handleSaveSchedules}
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Save className="mr-2 w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Agenda"}
          </Button>
        )}
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 border-b border-teal-100 pb-2">
        <button
          onClick={() => setActiveTab("weekly")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "weekly"
              ? "bg-teal-600 text-white"
              : "bg-teal-50 text-teal-600 hover:bg-teal-100"
          }`}
        >
          <Calendar className="inline w-4 h-4 mr-1" />
          Agenda Semanal
        </button>
        <button
          onClick={() => setActiveTab("overrides")}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            activeTab === "overrides"
              ? "bg-teal-600 text-white"
              : "bg-teal-50 text-teal-600 hover:bg-teal-100"
          }`}
        >
          <AlertTriangle className="inline w-4 h-4 mr-1" />
          Excepciones ({overrides.length})
        </button>
      </div>

      {/* ===== WEEKLY SCHEDULE TAB ===== */}
      {activeTab === "weekly" && (
        <div className="space-y-6">
          {/* Add new schedule entry */}
          <Card className={`border-teal-100 ${editingScheduleIdx !== null ? "ring-2 ring-amber-300 border-amber-200" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-teal-900 text-base flex items-center gap-2">
                {editingScheduleIdx !== null ? (
                  <>
                    <Edit3 className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700">Editar Horario</span>
                    <Badge variant="outline" className="ml-2 text-xs border-amber-300 text-amber-600">Modificando</Badge>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Agregar Horario
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-teal-600">Día</Label>
                  <Select value={newDay.toString()} onValueChange={(v) => setNewDay(Number(v))}>
                    <SelectTrigger className="border-teal-200 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DAYS_MAP).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-teal-600">Desde</Label>
                  <Select value={newStart} onValueChange={setNewStart}>
                    <SelectTrigger className="border-teal-200 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-teal-600">Hasta</Label>
                  <Select value={newEnd} onValueChange={setNewEnd}>
                    <SelectTrigger className="border-teal-200 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-teal-600">Duración</Label>
                  <Select value={newDuration.toString()} onValueChange={(v) => setNewDuration(Number(v))}>
                    <SelectTrigger className="border-teal-200 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1 items-end">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs text-teal-600">Modalidad</Label>
                    <Select value={newModality} onValueChange={(v) => {
                      setNewModality(v);
                      // Si cambia a Online, limpiar la dirección (no aplica)
                      if (v === "OL") {
                        setNewDireccionId("");
                      }
                    }}>
                      <SelectTrigger className="border-teal-200 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="P">Presencial</SelectItem>
                        <SelectItem value="OL">Online</SelectItem>
                        <SelectItem value="H">Híbrida</SelectItem>
                        <SelectItem value="ambas">Ambas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-1">
                    {editingScheduleIdx !== null && (
                      <Button
                        onClick={resetScheduleForm}
                        size="sm"
                        variant="outline"
                        className="border-teal-200 text-teal-600 hover:bg-teal-50 h-9"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      onClick={handleAddSchedule}
                      size="sm"
                      className={editingScheduleIdx !== null ? "bg-amber-500 hover:bg-amber-600 text-white h-9" : "bg-teal-600 hover:bg-teal-700 text-white h-9"}
                    >
                      {editingScheduleIdx !== null ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {/* === Selector de Dirección (solo si la modalidad es presencial) === */}
                {(newModality === "P" || newModality === "ambas") && (
                  <div className="space-y-1">
                    <Label className="text-xs text-teal-600">
                      Dirección de Atención Presencial
                      {addresses.length === 0 && (
                        <span className="text-amber-600 ml-1 italic">(sin direcciones cargadas — agregá una en tu Perfil)</span>
                      )}
                    </Label>
                    <Select value={newDireccionId} onValueChange={setNewDireccionId}>
                      <SelectTrigger className="border-teal-200 h-9 text-sm">
                        <SelectValue placeholder={addresses.length === 0 ? "Sin direcciones disponibles" : "Seleccionar dirección..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {addresses.map((addr) => (
                          <SelectItem key={addr.id} value={addr.id}>
                            {addr.label} — {addr.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Current schedule - visual weekly view */}
          {schedules.length === 0 ? (
            <Card className="border-teal-100 bg-teal-50/30">
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 text-teal-200 mx-auto" />
                <p className="text-teal-600 mt-2 font-medium">No tenés agenda configurada</p>
                <p className="text-teal-500 text-sm mt-1">
                  Agregá tus días y horarios de atención para que los pacientes puedan solicitar turnos
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Group by day */}
              {[1, 2, 3, 4, 5, 6].map((day) => {
                const daySchedules = schedules.filter((s) => s.dayOfWeek === day);
                if (daySchedules.length === 0) return null;

                return (
                  <Card key={day} className="border-teal-100">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-teal-900">{DAYS_MAP[day]}</p>
                          <p className="text-xs text-teal-500">{daySchedules.length} {daySchedules.length === 1 ? "franja" : "franjas"} horaria{daySchedules.length > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {daySchedules.map((s, idx) => {
                          const origIdx = schedules.findIndex((os) => os === s);
                          const ModIcon = MODALITY_MAP[s.modality]?.icon || CheckCircle2;
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-teal-50/50 rounded-lg border border-teal-100"
                            >
                              <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4 text-teal-500" />
                                <span className="text-sm font-medium text-teal-900">
                                  {s.startTime} - {s.endTime}
                                </span>
                                <Badge variant="outline" className="text-xs border-teal-200 text-teal-600">
                                  {s.slotDuration} min
                                </Badge>
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  <ModIcon className="w-3 h-3" />
                                  {MODALITY_MAP[s.modality]?.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-8 ${
                                    editingScheduleIdx === origIdx
                                      ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
                                      : "text-teal-400 hover:text-teal-600 hover:bg-teal-50"
                                  }`}
                                  onClick={() => handleEditSchedule(origIdx)}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8"
                                  onClick={() => handleRemoveSchedule(origIdx)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Quick summary */}
          {schedules.length > 0 && (
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
              <p className="text-sm text-teal-700 font-medium mb-2">Resumen de tu agenda semanal</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map((day) => {
                  const daySchedules = schedules.filter((s) => s.dayOfWeek === day);
                  if (daySchedules.length === 0) return null;
                  return (
                    <div key={day} className="bg-white rounded-md px-3 py-1.5 border border-teal-100 text-xs">
                      <span className="font-medium text-teal-900">{DAYS_SHORT[day]}:</span>{" "}
                      <span className="text-teal-600">
                        {daySchedules.map((s) => `${s.startTime}-${s.endTime}`).join(" / ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== OVERRIDES TAB ===== */}
      {activeTab === "overrides" && (
        <div className="space-y-6">
          {/* Add override */}
          <Card className={`border-teal-100 ${editingOverrideId !== null ? "ring-2 ring-amber-300 border-amber-200" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-teal-900 text-base flex items-center gap-2">
                {editingOverrideId !== null ? (
                  <>
                    <Edit3 className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700">Editar Excepción</span>
                    <Badge variant="outline" className="ml-2 text-xs border-amber-300 text-amber-600">Modificando</Badge>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Agregar Excepción
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Type selector */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setOverrideType("block")}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all text-center ${
                      overrideType === "block"
                        ? "border-red-400 bg-red-50"
                        : "border-teal-100 hover:border-teal-300"
                    }`}
                  >
                    <XCircle className={`w-6 h-6 mx-auto ${overrideType === "block" ? "text-red-500" : "text-teal-300"}`} />
                    <p className={`text-sm font-medium mt-1 ${overrideType === "block" ? "text-red-700" : "text-teal-600"}`}>
                      Bloquear día
                    </p>
                    <p className="text-xs text-teal-500 mt-0.5">No atenderé este día</p>
                  </button>
                  <button
                    onClick={() => setOverrideType("extra")}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all text-center ${
                      overrideType === "extra"
                        ? "border-teal-500 bg-teal-50"
                        : "border-teal-100 hover:border-teal-300"
                    }`}
                  >
                    <Plus className={`w-6 h-6 mx-auto ${overrideType === "extra" ? "text-teal-600" : "text-teal-300"}`} />
                    <p className={`text-sm font-medium mt-1 ${overrideType === "extra" ? "text-teal-900" : "text-teal-600"}`}>
                      Horario extra
                    </p>
                    <p className="text-xs text-teal-500 mt-0.5">Atenderé en un día/horario diferente</p>
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {/* Date picker */}
                  <div className="space-y-1">
                    <Label className="text-xs text-teal-600">Fecha</Label>
                    <Popover open={overrideDatePickerOpen} onOpenChange={setOverrideDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full border-teal-200 justify-start text-left h-9 text-sm font-normal"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {overrideDate ? format(overrideDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={overrideDate}
                          onSelect={(date) => {
                            setOverrideDate(date);
                            setOverrideDatePickerOpen(false);
                          }}
                          disabled={(date) => date < new Date()}
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Reason */}
                  <div className="space-y-1">
                    <Label className="text-xs text-teal-600">Motivo (opcional)</Label>
                    <Input
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Ej: Vacaciones, Feriado, Guardia..."
                      className="border-teal-200 h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Extra-specific fields */}
                {overrideType === "extra" && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-teal-600">Desde</Label>
                      <Select value={overrideStart} onValueChange={setOverrideStart}>
                        <SelectTrigger className="border-teal-200 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-teal-600">Hasta</Label>
                      <Select value={overrideEnd} onValueChange={setOverrideEnd}>
                        <SelectTrigger className="border-teal-200 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-teal-600">Duración</Label>
                      <Select value={overrideDuration.toString()} onValueChange={(v) => setOverrideDuration(Number(v))}>
                        <SelectTrigger className="border-teal-200 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((d) => (
                            <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-teal-600">Modalidad</Label>
                      <Select value={overrideModality} onValueChange={setOverrideModality}>
                        <SelectTrigger className="border-teal-200 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="P">Presencial</SelectItem>
                          <SelectItem value="OL">Online</SelectItem>
                          <SelectItem value="H">Híbrida</SelectItem>
                          <SelectItem value="ambas">Ambas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddOverride}
                    className={`text-white ${
                      editingOverrideId !== null
                        ? "bg-amber-500 hover:bg-amber-600"
                        : overrideType === "block"
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-teal-600 hover:bg-teal-700"
                    }`}
                    disabled={!overrideDate}
                  >
                    {editingOverrideId !== null ? (
                      <>
                        <Edit3 className="mr-2 w-4 h-4" />
                        Actualizar Excepción
                      </>
                    ) : overrideType === "block" ? (
                      <>
                        <XCircle className="mr-2 w-4 h-4" />
                        Bloquear Fecha
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 w-4 h-4" />
                        Agregar Horario Extra
                      </>
                    )}
                  </Button>
                  {editingOverrideId !== null && (
                    <Button
                      onClick={resetOverrideForm}
                      variant="outline"
                      className="border-teal-200 text-teal-600 hover:bg-teal-50"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current overrides list */}
          {overrides.length > 0 && (
            <Card className="border-teal-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-teal-900 text-base">
                  Excepciones Configuradas ({overrides.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {overrides.map((o) => {
                    const oDate = new Date(o.date + "T00:00:00");
                    return (
                      <div
                        key={o.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          o.type === "block"
                            ? "bg-red-50/50 border-red-100"
                            : "bg-teal-50/50 border-teal-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded flex items-center justify-center ${
                              o.type === "block"
                                ? "bg-red-100"
                                : "bg-teal-100"
                            }`}
                          >
                            {o.type === "block" ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <Plus className="w-4 h-4 text-teal-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-teal-900">
                              {format(oDate, "EEEE dd/MM/yyyy", { locale: es })}
                            </p>
                            {o.type === "block" ? (
                              <p className="text-xs text-red-500">Día bloqueado</p>
                            ) : (
                              <p className="text-xs text-teal-600">
                                {o.startTime} - {o.endTime} · {o.slotDuration} min · {MODALITY_MAP[o.modality || "ambas"]?.label}
                              </p>
                            )}
                            {o.reason && (
                              <p className="text-xs text-teal-500 italic">{o.reason}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 ${
                              editingOverrideId === o.id
                                ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
                                : "text-teal-400 hover:text-teal-600 hover:bg-teal-50"
                            }`}
                            onClick={() => handleEditOverride(o)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8"
                            onClick={() => o.id && handleDeleteOverride(o.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
