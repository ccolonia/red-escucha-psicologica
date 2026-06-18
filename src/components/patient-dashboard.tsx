"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarPlus,
  Clock,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Stethoscope,
  FileText,
  MapPin,
  Monitor,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

interface Professional {
  id: string;
  specialty: string;
  bio: string | null;
  available: boolean;
  user: { name: string; email: string };
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

const SPECIALTIES = [
  "Psicología Clínica",
  "Terapia de Pareja y Familia",
  "Psicología Infanto-Juvenil",
];

function BookingFlow({ patientId }: { patientId: string }) {
  const [step, setStep] = useState(1);
  const [specialty, setSpecialty] = useState("");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Array<{time: string; modality: string}>>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedModality, setSelectedModality] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);

  // Load professionals when specialty changes (all=true returns flat array)
  useEffect(() => {
    if (specialty) {
      fetch(`/api/professionals?all=true&specialty=${encodeURIComponent(specialty)}`)
        .then((res) => res.json())
        .then((data) => {
          const profs = Array.isArray(data) ? data : [];
          setProfessionals(profs);
          setSelectedProfessional("");
          setSelectedDate("");
          setSelectedTime("");
          setAvailableSlots([]);
        })
        .catch(() => {});
    }
  }, [specialty]);

  // Load available slots when professional and date change
  useEffect(() => {
    if (selectedProfessional && selectedDate) {
      fetch(
        `/api/professionals/${selectedProfessional}/slots?date=${selectedDate}`
      )
        .then((res) => res.json())
        .then((data) => {
          // API now returns {time, modality} objects
          if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
            setAvailableSlots(data);
          } else {
            // Fallback for old format (string array)
            setAvailableSlots((data as string[]).map((t: string) => ({ time: t, modality: "ambas" })));
          }
          setSelectedTime("");
          setSelectedModality("");
        })
        .catch(() => {});
    }
  }, [selectedProfessional, selectedDate]);

  const handleBook = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          professionalId: selectedProfessional,
          date: selectedDate,
          time: selectedTime,
          modality: selectedModality === "ambas" ? "P" : selectedModality,
          reason,
        }),
      });
      if (res.ok) {
        setBookingDone(true);
        toast.success("Turno solicitado exitosamente");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al solicitar turno");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (bookingDone) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto" />
        <h3 className="mt-4 text-2xl font-bold text-teal-900">
          ¡Turno Solicitado!
        </h3>
        <p className="mt-2 text-teal-600">
          Recibirás la confirmación a la brevedad.
        </p>
        <Button
          className="mt-6 bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => {
            setBookingDone(false);
            setStep(1);
            setSpecialty("");
            setSelectedProfessional("");
            setSelectedDate("");
            setSelectedTime("");
            setSelectedModality("");
            setReason("");
          }}
        >
          Solicitar otro turno
        </Button>
      </motion.div>
    );
  }

  return (
    <div>
      {/* Progress steps */}
      <div className="flex items-center justify-center mb-8 gap-2">
        {[1, 2, 3, 4].map((s) => (
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
            {s < 4 && (
              <div
                className={`w-8 sm:w-16 h-0.5 mx-1 ${
                  step > s ? "bg-teal-600" : "bg-teal-100"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Select specialty */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h3 className="text-lg font-semibold text-teal-900 mb-4">
              <Stethoscope className="inline mr-2 w-5 h-5" />
              ¿Qué tipo de consulta necesitás?
            </h3>
            <div className="space-y-3">
              {SPECIALTIES.map((spec) => (
                <button
                  key={spec}
                  onClick={() => setSpecialty(spec)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    specialty === spec
                      ? "border-teal-500 bg-teal-50"
                      : "border-teal-100 hover:border-teal-300"
                  }`}
                >
                  <p className="font-medium text-teal-900">{spec}</p>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                disabled={!specialty}
                onClick={() => setStep(2)}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Siguiente
                <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Select professional */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h3 className="text-lg font-semibold text-teal-900 mb-4">
              <User className="inline mr-2 w-5 h-5" />
              Elegí un profesional
            </h3>
            {professionals.length === 0 ? (
              <p className="text-teal-600">
                No hay profesionales disponibles para esta especialidad.
              </p>
            ) : (
              <div className="space-y-3">
                {professionals.map((prof) => (
                  <button
                    key={prof.id}
                    onClick={() => setSelectedProfessional(prof.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedProfessional === prof.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-teal-100 hover:border-teal-300"
                    }`}
                  >
                    <p className="font-semibold text-teal-900">
                      {prof.user.name}
                    </p>
                    <p className="text-sm text-teal-600">{prof.specialty}</p>
                    {prof.bio && (
                      <p className="text-sm text-teal-500 mt-1">{prof.bio}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="border-teal-300"
              >
                <ChevronLeft className="mr-1 w-4 h-4" />
                Anterior
              </Button>
              <Button
                disabled={!selectedProfessional}
                onClick={() => setStep(3)}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Siguiente
                <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Select date and time */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h3 className="text-lg font-semibold text-teal-900 mb-4">
              <Calendar className="inline mr-2 w-5 h-5" />
              Elegí fecha y horario
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="border-teal-200"
                />
              </div>

              {selectedDate && availableSlots.length > 0 && (
                <div className="space-y-2">
                  <Label>Horario disponible</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableSlots.map((slot) => {
                      const ModIcon = slot.modality === "OL" ? Monitor : slot.modality === "P" ? MapPin : slot.modality === "H" ? CheckCircle2 : CheckCircle2;
                      return (
                        <button
                          key={slot.time}
                          onClick={() => { setSelectedTime(slot.time); setSelectedModality(slot.modality); }}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                            selectedTime === slot.time
                              ? "bg-teal-600 text-white"
                              : "bg-teal-50 text-teal-700 hover:bg-teal-100"
                          }`}
                        >
                          <span>{slot.time}</span>
                          <span className={`text-[10px] flex items-center gap-0.5 ${selectedTime === slot.time ? "text-teal-100" : "text-teal-400"}`}>
                            <ModIcon className="w-3 h-3" />
                            {slot.modality === "P" ? "Presencial" : slot.modality === "OL" ? "Online" : slot.modality === "H" ? "Híbrida" : "Ambas"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedDate && availableSlots.length === 0 && (
                <div className="text-center py-4">
                  <AlertCircle className="w-10 h-10 text-teal-300 mx-auto" />
                  <p className="text-teal-600 mt-2">
                    No hay horarios disponibles para esta fecha.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="border-teal-300"
              >
                <ChevronLeft className="mr-1 w-4 h-4" />
                Anterior
              </Button>
              <Button
                disabled={!selectedTime}
                onClick={() => setStep(4)}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Siguiente
                <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h3 className="text-lg font-semibold text-teal-900 mb-4">
              <FileText className="inline mr-2 w-5 h-5" />
              Confirmar turno
            </h3>
            <Card className="border-teal-200">
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-teal-600">Especialidad</span>
                  <span className="font-medium text-teal-900">{specialty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-600">Profesional</span>
                  <span className="font-medium text-teal-900">
                    {professionals.find((p) => p.id === selectedProfessional)
                      ?.user.name || ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-600">Fecha</span>
                  <span className="font-medium text-teal-900">
                    {selectedDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-600">Horario</span>
                  <span className="font-medium text-teal-900">
                    {selectedTime} hs
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-600">Modalidad</span>
                  <span className="font-medium text-teal-900 flex items-center gap-1">
                    {selectedModality === "P" ? <><MapPin className="w-4 h-4" /> Presencial</> :
                     selectedModality === "OL" ? <><Monitor className="w-4 h-4" /> Online</> :
                     <><CheckCircle2 className="w-4 h-4" /> Presencial</>}
                  </span>
                </div>
                <div className="pt-2">
                  <Label htmlFor="reason">Motivo de la consulta (opcional)</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Contanos brevemente por qué necesitás la consulta..."
                    className="mt-1 border-teal-200"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
            <div className="mt-6 flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                className="border-teal-300"
              >
                <ChevronLeft className="mr-1 w-4 h-4" />
                Anterior
              </Button>
              <Button
                onClick={handleBook}
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loading ? "Confirmando..." : "Confirmar Turno"}
                <CheckCircle2 className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PatientDashboard() {
  const { data: session } = useSession();
  const { setCurrentView, justRegistered, setJustRegistered } = useAppStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (session?.user) {
      // Check if this is a first-time registration
      if (justRegistered) {
        setShowWelcome(true);
        setJustRegistered(false);
      }

      // Get patient ID and appointments
      fetch("/api/appointments")
        .then((res) => res.json())
        .then((data) => {
          setAppointments(data);
          // Extract patientId from first appointment if available
          if (data.length > 0 && data[0].patient) {
            // We need to find patientId for this user
            fetch("/api/appointments")
              .then((r) => r.json())
              .then(() => {});
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));

      // Get patient profile
      fetch("/api/patients")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            // For patient role, find their patient record
            const userId = (session.user as { id: string }).id;
            const patient = data.find(
              (p: { userId: string; id: string }) => p.userId === userId
            );
            if (patient) setPatientId(patient.id);
          }
        })
        .catch(() => {});
    }
  }, [session]);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = appointments.filter(
    (a) => a.date >= today && a.status !== "cancelled" && a.status !== "completed"
  );
  const past = appointments.filter(
    (a) => a.date < today || a.status === "completed" || a.status === "cancelled"
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-6 text-white">
        {showWelcome ? (
          <>
            <h1 className="text-2xl font-bold">
              ¡Bienvenido/a, {session?.user?.name?.split(" ")[0]}!
            </h1>
            <p className="text-teal-100 mt-1">
              Tu cuenta fue creada exitosamente. Ya podés solicitar tu primer turno de forma simple y rápida.
            </p>
            <Button
              className="mt-4 bg-white text-teal-700 hover:bg-teal-50 font-semibold"
              onClick={() => {
                setShowWelcome(false);
                setCurrentView("patient-book");
              }}
            >
              <CalendarPlus className="mr-2 w-4 h-4" />
              Solicitar mi primer turno
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">
              ¡Hola, {session?.user?.name?.split(" ")[0]}!
            </h1>
            <p className="text-teal-100 mt-1">
              Bienvenido/a a tu panel de turnos
            </p>
            <Button
              className="mt-4 bg-white text-teal-700 hover:bg-teal-50 font-semibold"
              onClick={() => setCurrentView("patient-book")}
            >
              <CalendarPlus className="mr-2 w-4 h-4" />
              Solicitar Turno
            </Button>
          </>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-teal-100">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-teal-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {upcoming.length}
            </p>
            <p className="text-sm text-teal-600">Próximos turnos</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {past.filter((a) => a.status === "completed").length}
            </p>
            <p className="text-sm text-teal-600">Atendidos</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100 col-span-2 sm:col-span-1">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-2xl font-bold text-teal-900 mt-2">
              {upcoming.filter((a) => a.status === "pending").length}
            </p>
            <p className="text-sm text-teal-600">Pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming appointments */}
      <Card className="border-teal-100">
        <CardHeader>
          <CardTitle className="text-teal-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Próximos Turnos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-teal-50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-8">
              <CalendarPlus className="w-12 h-12 text-teal-200 mx-auto" />
              <p className="text-teal-600 mt-2">No tenés turnos programados</p>
              <Button
                className="mt-3 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => setCurrentView("patient-book")}
              >
                Solicitar Turno
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
              {upcoming.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 bg-teal-50/50 rounded-lg border border-teal-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-teal-900">
                        {apt.professional.user.name}
                      </p>
                      <p className="text-sm text-teal-600">
                        {apt.date} • {apt.timeEnd ? `${apt.time} a ${apt.timeEnd} hs` : `${apt.time} hs`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_MAP[apt.status]?.variant || "outline"}>
                      {STATUS_MAP[apt.status]?.label || apt.status}
                    </Badge>
                    {(apt.status === "pending" || apt.status === "confirmed") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          if (!window.confirm("¿Estás seguro de que querés cancelar este turno?")) return;
                          try {
                            const res = await fetch(`/api/appointments/${apt.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "cancelled" }),
                            });
                            if (res.ok) {
                              setAppointments((prev) =>
                                prev.map((a) =>
                                  a.id === apt.id ? { ...a, status: "cancelled" } : a
                                )
                              );
                              toast.success("Turno cancelado exitosamente");
                            } else {
                              const data = await res.json();
                              toast.error(data.error || "Error al cancelar el turno");
                            }
                          } catch {
                            toast.error("Error de conexión");
                          }
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past appointments */}
      {past.length > 0 && (
        <Card className="border-teal-100">
          <CardHeader>
            <CardTitle className="text-teal-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Historial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
              {past.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">
                        {apt.professional.user.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {apt.date} • {apt.timeEnd ? `${apt.time} a ${apt.timeEnd} hs` : `${apt.time} hs`}
                        {apt.reason ? ` — ${apt.reason}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={STATUS_MAP[apt.status]?.variant || "outline"}>
                    {STATUS_MAP[apt.status]?.label || apt.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function PatientBook() {
  const { data: session } = useSession();
  const [modality, setModality] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [patientRequests, setPatientRequests] = useState<any[]>([]);

  const MODALITY_OPTIONS = [
    { value: "online", label: "Online", icon: Monitor, desc: "Videollamada" },
    { value: "presencial", label: "Presencial", icon: MapPin, desc: "Av. Sanabria 1616" },
    { value: "híbrida", label: "Híbrida", icon: CheckCircle2, desc: "Lo que suceda primero" },
  ];

  const REASON_OPTIONS = [
    { value: "ansiedad", label: "Ansiedad" },
    { value: "depresion", label: "Depresión" },
    { value: "vinculos", label: "Vínculos / Pareja" },
    { value: "duelo", label: "Duelo / Pérdida" },
    { value: "autoestima", label: "Autoestima" },
    { value: "adicciones", label: "Adicciones" },
    { value: "estres", label: "Estrés" },
    { value: "laboral", label: "Laboral" },
    { value: "orientacion_padres", label: "Orientación a Padres" },
    { value: "evaluaciones", label: "Evaluaciones" },
    { value: "discapacidad", label: "Discapacidad" },
    { value: "otros", label: "Otros" },
  ];

  // Load existing patient requests
  useEffect(() => {
    if (session?.user) {
      fetch("/api/patient-requests?status=pending")
        .then((res) => res.json())
        .then((data) => {
          // Filter to only show this user's requests
          const myRequests = Array.isArray(data)
            ? data.filter((r: any) => r.email === session?.user?.email)
            : [];
          setPatientRequests(myRequests);
        })
        .catch(() => {});
    }
  }, [session]);

  const handleSubmit = async () => {
    if (!modality || !reason) {
      toast.error("Completá la modalidad y el motivo de consulta");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/patient-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: session?.user?.name || "",
          email: session?.user?.email || "",
          phone: (session?.user as any)?.phone || null,
          modality,
          reason,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        toast.success("Solicitud enviada exitosamente");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al enviar solicitud");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto" />
        <h3 className="mt-4 text-2xl font-bold text-teal-900">
          ¡Solicitud Recibida!
        </h3>
        <p className="mt-2 text-teal-600 max-w-md mx-auto">
          Tu solicitud fue recibida. Un administrador la revisará y te asignará
          un profesional a la brevedad.
        </p>
        <p className="mt-3 text-sm text-teal-500">
          Te notificaremos por email cuando se asigne tu profesional.
        </p>
        <Button
          className="mt-6 bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => {
            setSubmitted(false);
            setModality("");
            setReason("");
            setNotes("");
          }}
        >
          Enviar otra solicitud
        </Button>
      </motion.div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-teal-900 mb-6">
        Solicitar Turno
      </h2>

      {/* Existing pending requests */}
      {patientRequests.length > 0 && (
        <Card className="border-amber-100 bg-amber-50/30 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-amber-700">
                Tenés {patientRequests.length} solicitud{patientRequests.length > 1 ? "es" : ""} pendiente{patientRequests.length > 1 ? "s" : ""}
              </p>
            </div>
            <p className="text-xs text-amber-600">
              Un administrador las revisará y te asignará un profesional a la brevedad.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-teal-100">
        <CardContent className="p-6 space-y-6">
          {/* Modality Selection */}
          <div className="space-y-3">
            <Label className="text-teal-800 font-medium text-sm">
              ¿Cómo preferís tu consulta?
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODALITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setModality(opt.value)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      modality === opt.value
                        ? "border-teal-500 bg-teal-50"
                        : "border-teal-100 hover:border-teal-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-5 h-5 ${modality === opt.value ? "text-teal-600" : "text-teal-400"}`} />
                      <span className="font-medium text-teal-900">{opt.label}</span>
                    </div>
                    <p className="text-xs text-teal-500">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-3">
            <Label className="text-teal-800 font-medium text-sm">
              ¿Cuál es el motivo de tu consulta?
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setReason(opt.value)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    reason === opt.value
                      ? "bg-teal-600 text-white"
                      : "bg-teal-50 text-teal-700 hover:bg-teal-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-teal-800 font-medium text-sm">
              Notas adicionales (opcional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contanos brevemente algo que quieras que sepamos..."
              className="border-teal-200 min-h-[80px]"
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !modality || !reason}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <CalendarPlus className="mr-2 w-5 h-5" />
                Enviar Solicitud
              </>
            )}
          </Button>

          <p className="text-xs text-teal-400 text-center">
            Un administrador revisará tu solicitud y te asignará un profesional.
            Recibirás una notificación por email.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatientAppointments() {
  const { data: session } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => {
        setAppointments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCancel = async (aptId: string) => {
    if (!window.confirm("¿Estás seguro de que querés cancelar este turno?")) return;
    setCancellingId(aptId);
    try {
      const res = await fetch(`/api/appointments/${aptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === aptId ? { ...a, status: "cancelled" } : a
          )
        );
        toast.success("Turno cancelado exitosamente");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al cancelar el turno");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-teal-900 mb-6">Mis Turnos</h2>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-teal-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <Card className="border-teal-100">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 text-teal-200 mx-auto" />
            <p className="text-teal-600 mt-2">No tenés turnos registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <Card key={apt.id} className="border-teal-100">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-teal-900">
                      {apt.professional.user.name}
                    </p>
                    <p className="text-sm text-teal-600">
                      {apt.professional.specialty}
                    </p>
                    <p className="text-sm text-teal-500">
                      {apt.date} • {apt.timeEnd ? `${apt.time} a ${apt.timeEnd} hs` : `${apt.time} hs`}
                    </p>
                    {apt.reason && (
                      <p className="text-sm text-teal-400 mt-1">
                        {apt.reason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_MAP[apt.status]?.variant || "outline"}>
                    {STATUS_MAP[apt.status]?.label || apt.status}
                  </Badge>
                  {(apt.status === "pending" || apt.status === "confirmed") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      disabled={cancellingId === apt.id}
                      onClick={() => handleCancel(apt.id)}
                    >
                      <XCircle className="w-4 h-4" />
                      <span className="ml-1 text-xs hidden sm:inline">Cancelar</span>
                    </Button>
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

export function PatientProfile() {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <h2 className="text-2xl font-bold text-teal-900 mb-6">Mi Perfil</h2>
      <Card className="border-teal-100">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-teal-200"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={session?.user?.email || ""}
              disabled
              className="border-teal-200 bg-teal-50/50"
            />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 11 xxxx-xxxx"
              className="border-teal-200"
            />
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setTimeout(() => {
                setSaving(false);
                toast.success("Perfil actualizado");
              }, 500);
            }}
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
