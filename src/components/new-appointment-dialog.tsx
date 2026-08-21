"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarPlus,
  Search,
  User,
  Calendar,
  Clock,
  MapPin,
  Monitor,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Stethoscope,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ---- Types ----

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string;
  isAdmin?: boolean;
  onCreated?: () => void;
  onSuccess?: () => void;
  prefillDate?: string;
  prefillTime?: string;
}

interface PatientItem {
  id: string;
  userId: string;
  user: { name: string; email: string; phone: string | null };
}

interface ProfessionalItem {
  id: string;
  specialty: string;
  bio: string | null;
  available: boolean;
  user: { name: string; email: string };
}

interface SlotItem {
  time: string;
  modality: string;
}

// ---- Component ----

export function NewAppointmentDialog({
  open,
  onOpenChange,
  professionalId,
  isAdmin = false,
  onCreated,
  onSuccess,
  prefillDate,
  prefillTime,
}: NewAppointmentDialogProps) {
  const { data: session } = useSession();

  // Steps: admin has 4 steps (professional → patient → date/time → confirm)
  //        professional has 3 steps (patient → date/time → confirm)
  const totalSteps = isAdmin ? 4 : 3;
  const [step, setStep] = useState(1);

  // Data states
  const [professionals, setProfessionals] = useState<ProfessionalItem[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<PatientItem[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedModality, setSelectedModality] = useState("");
  const [reason, setReason] = useState("");

  // UI States
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  // Derived: the effective professional ID
  const effectiveProfessionalId = isAdmin
    ? selectedProfessionalId
    : professionalId;

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedProfessionalId("");
      setPatientSearch("");
      setSelectedPatientId("");
      setSelectedDate(prefillDate || "");
      setAvailableSlots([]);
      setSelectedTime(prefillTime || "");
      setSelectedModality("");
      setReason("");
      setSubmitting(false);
      setCreated(false);

      // If prefill data is provided, skip to the appropriate step
      if (prefillDate && prefillTime && !isAdmin) {
        // Professional with prefill: skip to step 1 (select patient)
        // Date/time are already set, they just need to pick a patient
      }
    }
  }, [open, prefillDate, prefillTime]);

  // Load professionals for admin (all=true returns flat array of active+licenseVerified)
  useEffect(() => {
    if (open && isAdmin) {
      fetch("/api/professionals?all=true&available=true")
        .then((res) => res.json())
        .then((data) => {
          const profs = Array.isArray(data) ? data : [];
          setProfessionals(profs);
        })
        .catch(() => {});
    }
  }, [open, isAdmin]);

  // Load patients
  useEffect(() => {
    if (open) {
      fetch("/api/patients")
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setPatients(list);
          setFilteredPatients(list);
        })
        .catch(() => {});
    }
  }, [open]);

  // Filter patients on search
  useEffect(() => {
    if (!patientSearch.trim()) {
      setFilteredPatients(patients);
    } else {
      const term = patientSearch.toLowerCase();
      setFilteredPatients(
        patients.filter(
          (p) =>
            p.user.name.toLowerCase().includes(term) ||
            p.user.email.toLowerCase().includes(term)
        )
      );
    }
  }, [patientSearch, patients]);

  // Load slots when professional and date are selected
  const loadSlots = useCallback(() => {
    if (effectiveProfessionalId && selectedDate) {
      setLoadingSlots(true);
      fetch(
        `/api/professionals/${effectiveProfessionalId}/slots?date=${selectedDate}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAvailableSlots(data);
          } else {
            setAvailableSlots([]);
          }
          setSelectedTime("");
          setSelectedModality("");
        })
        .catch(() => setAvailableSlots([]))
        .finally(() => setLoadingSlots(false));
    }
  }, [effectiveProfessionalId, selectedDate]);

  useEffect(() => {
    if (effectiveProfessionalId && selectedDate) {
      loadSlots();
    }
  }, [effectiveProfessionalId, selectedDate, loadSlots]);

  // Handle slot selection
  const handleSlotSelect = (slot: SlotItem) => {
    setSelectedTime(slot.time);
    if (slot.modality === "P" || slot.modality === "OL") {
      setSelectedModality(slot.modality);
    } else if (slot.modality === "ambas") {
      // Default to P, user can change in confirm step
      setSelectedModality("P");
    }
  };

  // Submit appointment
  const handleSubmit = async () => {
    if (!selectedPatientId || !effectiveProfessionalId || !selectedDate || !selectedTime || !selectedModality) {
      toast.error("Faltan datos obligatorios");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          professionalId: effectiveProfessionalId,
          date: selectedDate,
          time: selectedTime,
          modality: selectedModality,
          reason: reason || undefined,
          status: "confirmed", // Professional/admin creates confirmed appointments
        }),
      });

      if (res.ok) {
        setCreated(true);
        toast.success("Turno creado exitosamente");
        onCreated?.();
        onSuccess?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear el turno");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  // Close dialog after creation with brief delay
  const handleCloseAfterCreate = () => {
    onOpenChange(false);
  };

  // Get selected patient name
  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const selectedProfessional = professionals.find(
    (p) => p.id === selectedProfessionalId
  );

  // Compute step offset: for admin, step 1 = select professional
  // Step labels for display
  const getStepLabel = (s: number) => {
    if (isAdmin) {
      switch (s) {
        case 1:
          return "Profesional";
        case 2:
          return "Paciente";
        case 3:
          return "Fecha y Hora";
        case 4:
          return "Confirmar";
        default:
          return "";
      }
    } else {
      switch (s) {
        case 1:
          return "Paciente";
        case 2:
          return "Fecha y Hora";
        case 3:
          return "Confirmar";
        default:
          return "";
      }
    }
  };

  // Can proceed from current step?
  const canProceed = () => {
    if (isAdmin) {
      switch (step) {
        case 1:
          return !!selectedProfessionalId;
        case 2:
          return !!selectedPatientId;
        case 3:
          return !!selectedTime && !!selectedModality;
        case 4:
          return true;
        default:
          return false;
      }
    } else {
      switch (step) {
        case 1:
          return !!selectedPatientId;
        case 2:
          return !!selectedTime && !!selectedModality;
        case 3:
          return true;
        default:
          return false;
      }
    }
  };

  // Success screen
  if (created) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h3 className="mt-4 text-xl font-bold text-teal-900">
              ¡Turno Creado!
            </h3>
            <p className="mt-2 text-teal-600">
              El turno fue confirmado exitosamente.
            </p>
            <Button
              className="mt-6 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleCloseAfterCreate}
            >
              Cerrar
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-teal-900">
            <CalendarPlus className="w-5 h-5 text-teal-600" />
            Nuevo Turno
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center mb-6 gap-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step >= s
                    ? "bg-teal-600 text-white"
                    : "bg-teal-100 text-teal-400"
                }`}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < totalSteps && (
                <div
                  className={`w-6 sm:w-12 h-0.5 mx-0.5 ${
                    step > s ? "bg-teal-600" : "bg-teal-100"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* === ADMIN: Step 1 - Select Professional === */}
          {isAdmin && step === 1 && (
            <motion.div
              key="admin-professional"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold text-teal-900 mb-4">
                <Stethoscope className="inline mr-2 w-5 h-5" />
                Seleccionar Profesional
              </h3>
              {professionals.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-10 h-10 text-teal-300 mx-auto" />
                  <p className="text-teal-600 mt-2">
                    No hay profesionales disponibles.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {professionals.map((prof) => (
                    <button
                      key={prof.id}
                      onClick={() => {
                        setSelectedProfessionalId(prof.id);
                        // Reset downstream selections
                        setSelectedDate("");
                        setAvailableSlots([]);
                        setSelectedTime("");
                        setSelectedModality("");
                      }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        selectedProfessionalId === prof.id
                          ? "border-teal-500 bg-teal-50"
                          : "border-teal-100 hover:border-teal-300"
                      }`}
                    >
                      <p className="font-semibold text-teal-900">
                        {prof.user.name}
                      </p>
                      <p className="text-sm text-teal-600">{prof.specialty}</p>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <Button
                  disabled={!canProceed()}
                  onClick={() => setStep(2)}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Siguiente
                  <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* === Step: Select Patient === */}
          {((isAdmin && step === 2) || (!isAdmin && step === 1)) && (
            <motion.div
              key="patient"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold text-teal-900 mb-4">
                <User className="inline mr-2 w-5 h-5" />
                Seleccionar Paciente
              </h3>

              {/* Search input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-10 border-teal-200"
                />
              </div>

              {filteredPatients.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-10 h-10 text-teal-300 mx-auto" />
                  <p className="text-teal-600 mt-2">
                    {patientSearch
                      ? "No se encontraron pacientes con esa búsqueda."
                      : "No hay pacientes registrados."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        selectedPatientId === patient.id
                          ? "border-teal-500 bg-teal-50"
                          : "border-teal-100 hover:border-teal-300"
                      }`}
                    >
                      <p className="font-semibold text-teal-900">
                        {patient.user.name}
                      </p>
                      <p className="text-sm text-teal-600">
                        {patient.user.email}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-6 flex justify-between">
                {isAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="border-teal-300"
                  >
                    <ChevronLeft className="mr-1 w-4 h-4" />
                    Anterior
                  </Button>
                )}
                <Button
                  disabled={!canProceed()}
                  onClick={() => setStep(isAdmin ? 3 : 2)}
                  className="bg-teal-600 hover:bg-teal-700 text-white ml-auto"
                >
                  Siguiente
                  <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* === Step: Select Date & Time === */}
          {((isAdmin && step === 3) || (!isAdmin && step === 2)) && (
            <motion.div
              key="datetime"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold text-teal-900 mb-4">
                <Calendar className="inline mr-2 w-5 h-5" />
                Fecha y Horario
              </h3>

              <div className="space-y-4">
                {/* Date picker */}
                {/* === Admin puede elegir fechas pasadas (registro retroactivo) ===
                    Si isAdmin=true, no restringimos min. Si es paciente/profesional,
                    mantenemos min=hoy para evitar turnos pasados por error. */}
                <div className="space-y-2">
                  <Label className="text-teal-700">
                    Fecha {isAdmin && <span className="text-xs text-orange-600 ml-1">(podés elegir fechas pasadas para registro retroactivo)</span>}
                  </Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedTime("");
                      setSelectedModality("");
                    }}
                    {...(!isAdmin ? { min: new Date().toISOString().split("T")[0] } : {})}
                    className={`border-teal-200 ${isAdmin ? "bg-orange-50/30" : ""}`}
                  />
                </div>

                {/* Available slots grid */}
                {selectedDate && (
                  <div className="space-y-2">
                    <Label className="text-teal-700">Horario disponible</Label>
                    {loadingSlots ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div
                            key={i}
                            className="h-14 bg-teal-50 animate-pulse rounded-lg"
                          />
                        ))}
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="text-center py-4">
                        <AlertCircle className="w-10 h-10 text-teal-300 mx-auto" />
                        <p className="text-teal-600 mt-2">
                          No hay horarios disponibles para esta fecha.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlots.map((slot) => {
                          const ModIcon =
                            slot.modality === "OL"
                              ? Monitor
                              : slot.modality === "P"
                                ? MapPin
                                : CheckCircle2;
                          return (
                            <button
                              key={slot.time}
                              onClick={() => handleSlotSelect(slot)}
                              className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                                selectedTime === slot.time
                                  ? "bg-teal-600 text-white"
                                  : "bg-teal-50 text-teal-700 hover:bg-teal-100"
                              }`}
                            >
                              <span>{slot.time}</span>
                              <span
                                className={`text-[10px] flex items-center gap-0.5 ${
                                  selectedTime === slot.time
                                    ? "text-teal-100"
                                    : "text-teal-400"
                                }`}
                              >
                                <ModIcon className="w-3 h-3" />
                                {slot.modality === "P"
                                  ? "Pres."
                                  : slot.modality === "OL"
                                    ? "Online"
                                    : "Ambas"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Modality selector - only show when slot has "ambas" */}
                {selectedTime && selectedModality && availableSlots.find(s => s.time === selectedTime)?.modality === "ambas" && (
                  <div className="space-y-2">
                    <Label className="text-teal-700">Modalidad</Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedModality("P")}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          selectedModality === "P"
                            ? "border-teal-500 bg-teal-50"
                            : "border-teal-100 hover:border-teal-300"
                        }`}
                      >
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm font-medium text-teal-900">
                          Presencial
                        </span>
                      </button>
                      <button
                        onClick={() => setSelectedModality("OL")}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          selectedModality === "OL"
                            ? "border-teal-500 bg-teal-50"
                            : "border-teal-100 hover:border-teal-300"
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                        <span className="text-sm font-medium text-teal-900">
                          Online
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(isAdmin ? 2 : 1)}
                  className="border-teal-300"
                >
                  <ChevronLeft className="mr-1 w-4 h-4" />
                  Anterior
                </Button>
                <Button
                  disabled={!canProceed()}
                  onClick={() => setStep(isAdmin ? 4 : 3)}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Siguiente
                  <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* === Step: Confirm === */}
          {((isAdmin && step === 4) || (!isAdmin && step === 3)) && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold text-teal-900 mb-4">
                <CheckCircle2 className="inline mr-2 w-5 h-5" />
                Confirmar Turno
              </h3>

              <Card className="border-teal-200">
                <CardContent className="p-4 space-y-3">
                  {/* Professional info (for admin) */}
                  {isAdmin && selectedProfessional && (
                    <div className="flex justify-between">
                      <span className="text-teal-600">Profesional</span>
                      <span className="font-medium text-teal-900">
                        {selectedProfessional.user.name}
                      </span>
                    </div>
                  )}
                  {isAdmin && selectedProfessional && (
                    <div className="flex justify-between">
                      <span className="text-teal-600">Especialidad</span>
                      <span className="font-medium text-teal-900">
                        {selectedProfessional.specialty}
                      </span>
                    </div>
                  )}

                  {/* Patient */}
                  <div className="flex justify-between">
                    <span className="text-teal-600">Paciente</span>
                    <span className="font-medium text-teal-900">
                      {selectedPatient?.user.name || ""}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex justify-between">
                    <span className="text-teal-600">Fecha</span>
                    <span className="font-medium text-teal-900">
                      {selectedDate}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="flex justify-between">
                    <span className="text-teal-600">Horario</span>
                    <span className="font-medium text-teal-900">
                      {selectedTime} hs
                    </span>
                  </div>

                  {/* Modality */}
                  <div className="flex justify-between items-center">
                    <span className="text-teal-600">Modalidad</span>
                    <span className="font-medium text-teal-900 flex items-center gap-1">
                      {selectedModality === "P" ? (
                        <>
                          <MapPin className="w-4 h-4" /> Presencial
                        </>
                      ) : selectedModality === "OL" ? (
                        <>
                          <Monitor className="w-4 h-4" /> Online
                        </>
                      ) : (
                        ""
                      )}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className="flex justify-between items-center">
                    <span className="text-teal-600">Estado</span>
                    <Badge variant="default">Confirmado</Badge>
                  </div>

                  {/* Reason */}
                  <div className="pt-2">
                    <Label htmlFor="reason" className="text-teal-700">
                      Motivo de la consulta (opcional)
                    </Label>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Motivo de la consulta..."
                      className="mt-1 border-teal-200"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(isAdmin ? 3 : 2)}
                  className="border-teal-300"
                >
                  <ChevronLeft className="mr-1 w-4 h-4" />
                  Anterior
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {submitting ? "Creando..." : "Crear Turno"}
                  <CheckCircle2 className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
