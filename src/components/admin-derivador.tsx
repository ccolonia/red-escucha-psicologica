"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Clock,
  Calendar,
  User,
  Filter,
  Zap,
  CheckCircle2,
  X,
  AlertCircle,
  Stethoscope,
  MessageCircle,
  Loader2,
  UserPlus,
  ChevronsUpDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { formatPhoneForWhatsApp } from "@/lib/email";

// === Tipos ===
type DerivacionFilters = {
  // === Paciente seleccionado ===
  // Antes era patientName: string (input libre). Ahora es un objeto con los
  // datos del paciente seleccionado desde el combobox, o null si no se ha
  // seleccionado ninguno. Esto evita que se ingresen nombres ficticios.
  patient: PacienteSeleccionado | null;
  modality: string; // "online" | "presencial" | "domicilio" | "cualquiera"
  zone: string;
  timeSlot: string; // "manana" | "tarde" | "noche" | "cualquiera"
  therapyType: string;   // "" = cualquiera, o un valor de TIPOS_TERAPIA
  targetAudience: string; // "" = cualquiera, o un valor de PUBLICO_OBJETIVO
};

// === Paciente seleccionado desde el combobox ===
// Puede ser:
// - Un paciente existente (con id, name, email, phone)
// - Un paciente nuevo creado al vuelo desde el modal de registro rápido
//   (sin id, pero con name, email, phone)
type PacienteSeleccionado = {
  id?: string;       // Solo si es paciente existente en la DB
  name: string;
  email: string;
  phone: string;
  isNew?: boolean;   // true si se creó al vuelo desde el modal de registro rápido
};

type SlotDisponible = {
  date: string;
  time: string;
  endTime: string;
  modality: string;
};

type ProfesionalSugerido = {
  id: string;
  name: string;
  profession: string;
  specialty: string;
  zones: string[];
  therapyTypes: string[];   // Array de tipos de terapia que maneja el profesional
  targetAudience: string[]; // Array de públicos a los que atiende
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  phone: string;
  email: string;
  slots: SlotDisponible[];
};

// === Zonas disponibles (de las jerarquías del registro profesional) ===
const ZONAS = [
  "Capital Federal (CABA)",
  "GBA Zona Norte",
  "GBA Zona Oeste",
  "GBA Zona Sur",
  "Prov. de Buenos Aires",
  "Prov. de Córdoba",
  "Prov. de Mendoza",
  "Prov. de Santa Fe",
];

// === Tipos de Terapia (valores canónicos del schema, misma lista que professional-register.tsx) ===
// Se usan tanto para el select de filtros como para los micro-badges de la tarjeta.
const TIPOS_TERAPIA = [
  "Adicciones",
  "Deportología",
  "EMDR",
  "Logoterapia",
  "Mindfulness",
  "Neuropsicología",
  "Psicooncología",
  "Psicoanálisis",
  "Psicocorporal Reichiana",
  "Psicodrama",
  "Psicología clínica",
  "Psicología deportiva",
  "Psicología forense",
  "Psicología geriátrica",
  "Psicología laboral / organizacional",
  "Psicología perinatal",
  "Psicología positiva",
  "Psicoterapia Integral",
  "Psiconutrición",
  "Terapia cognitivo-conductual",
  "Terapia constructivista",
  "Terapia gestáltica",
  "Terapia humanista",
  "Terapia junguiana",
  "Terapia sistémica",
  "Sexología y Trastornos Sexuales",
];

// === Público Objetivo (valores canónicos del schema) ===
const PUBLICO_OBJETIVO = [
  "Adolescentes",
  "Adultos",
  "Adultos mayores",
  "Familias",
  "Jóvenes",
  "Niños/as",
  "Orientación a padres",
  "Parejas",
];

// === Franjas horarias ===
// Ampliada "Tarde" hasta 20:00 para incluir slots como 18:30 y 19:15
// (caso María Monge 14:00-19:30 / 45min → último slot 19:15)
const FRANJAS = [
  { value: "manana", label: "Mañana (08:00 - 12:00)", start: "08:00", end: "12:00" },
  { value: "tarde", label: "Tarde (12:00 - 20:00)", start: "12:00", end: "20:00" },
  { value: "noche", label: "Noche (18:00 - 22:00)", start: "18:00", end: "22:00" },
  { value: "cualquiera", label: "Cualquier franja (todo el día)", start: "00:00", end: "23:59" },
];

// === Helper: parsear JSON array string del endpoint (therapyTypes, targetAudience) ===
// El schema los guarda como String? con JSON.stringify(array). El endpoint los
// devuelve como string crudo. Hay que parsearlos de forma segura.
function parseJsonArray(raw: any): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function DerivadorInteligente() {
  const [filters, setFilters] = useState<DerivacionFilters>({
    patient: null,
    modality: "cualquiera",
    zone: "",
    timeSlot: "cualquiera",
    therapyType: "",
    targetAudience: "",
  });
  const [results, setResults] = useState<ProfesionalSugerido[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    profesional: ProfesionalSugerido | null;
    slot: SlotDisponible | null;
  }>({ open: false, profesional: null, slot: null });
  const [confirming, setConfirming] = useState(false);

  // === Estado del Combobox de pacientes ===
  const [patientComboboxOpen, setPatientComboboxOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<PacienteSeleccionado[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);

  // === Modal "Registrar nuevo paciente" ===
  const [newPatientDialog, setNewPatientDialog] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ name: "", email: "", phone: "" });
  const [newPatientSaving, setNewPatientSaving] = useState(false);

  // === Debounced search de pacientes ===
  // Cada vez que cambia el query del combobox, esperar 300ms y buscar en /api/patients?search=
  useEffect(() => {
    if (!patientComboboxOpen) return;
    if (patientSearchQuery.trim().length < 2) {
      setPatientSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setPatientSearchLoading(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearchQuery.trim())}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          // Mapear a PacienteSeleccionado
          const mapped: PacienteSeleccionado[] = data.map((p: any) => ({
            id: p.id,
            name: p.user?.name || "Sin nombre",
            email: p.user?.email || "",
            phone: p.user?.phone || "",
          }));
          setPatientSearchResults(mapped);
        } else {
          setPatientSearchResults([]);
        }
      } catch (err) {
        console.error("Error buscando pacientes:", err);
        setPatientSearchResults([]);
      } finally {
        setPatientSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearchQuery, patientComboboxOpen]);

  // === Seleccionar paciente existente ===
  const handleSelectPatient = (paciente: PacienteSeleccionado) => {
    setFilters({ ...filters, patient: paciente });
    setPatientComboboxOpen(false);
    setPatientSearchQuery("");
    setPatientSearchResults([]);
  };

  // === Abrir modal de nuevo paciente ===
  const handleOpenNewPatientDialog = () => {
    // Pre-llenar con lo que el admin ya había escrito en el combobox
    setNewPatientForm({
      name: patientSearchQuery.trim(),
      email: "",
      phone: "",
    });
    setNewPatientDialog(true);
    setPatientComboboxOpen(false);
  };

  // === Crear nuevo paciente (desde el modal) ===
  // NO llama al backend para crear el paciente — solo arma el objeto
  // PacienteSeleccionado con isNew=true. El paciente se crea automáticamente
  // en el endpoint /api/admin/quick-assign cuando se confirma la derivación
  // (ese endpoint hace upsert por email).
  const handleCreateNewPatient = () => {
    if (!newPatientForm.name.trim() || !newPatientForm.email.trim() || !newPatientForm.phone.trim()) {
      toast.error("Completá nombre, email y teléfono");
      return;
    }
    // Validar email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newPatientForm.email.trim())) {
      toast.error("El email no es válido");
      return;
    }
    const nuevoPaciente: PacienteSeleccionado = {
      name: newPatientForm.name.trim(),
      email: newPatientForm.email.trim().toLowerCase(),
      phone: newPatientForm.phone.trim(),
      isNew: true,
    };
    setFilters({ ...filters, patient: nuevoPaciente });
    setNewPatientDialog(false);
    setNewPatientForm({ name: "", email: "", phone: "" });
    toast.success(`Paciente "${nuevoPaciente.name}" agregado. Se creará al confirmar la derivación.`);
  };

  // === Búsqueda de profesionales con slots disponibles ===
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      // Construir params para el endpoint de search-professionals
      // El endpoint usa modality en el sentido de "presencial" | "online" | "híbrida" | "ambas"
      // "domicilio" no es un valor que entienda, así que lo mapeamos a "presencial"
      // (porque el backend filtra por OR presentialAttention/homeAttention en "presencial")
      // "cualquiera" → no mandamos modality → el backend no filtra por modalidad
      const params = new URLSearchParams();
      params.set("all", "true");
      if (filters.modality === "online") {
        params.set("modality", "online");
      } else if (filters.modality === "presencial") {
        params.set("modality", "presencial");
      } else if (filters.modality === "domicilio") {
        // "domicilio" → "presencial" en el backend filtra por presentialAttention OR homeAttention
        params.set("modality", "presencial");
      }
      // filters.modality === "cualquiera" → no mandamos param, backend no filtra

      // === Filtros clínicos (therapyTypes, targetAudience) ===
      // El backend ya soporta estos como comma-separated. Si el admin selecciona
      // un valor específico, lo mandamos. Si deja "Cualquiera", no mandamos el param
      // y el backend trae todos los profesionales sin filtrar por ese campo.
      if (filters.therapyType) {
        params.set("therapyTypes", filters.therapyType);
      }
      if (filters.targetAudience) {
        params.set("targetAudience", filters.targetAudience);
      }

      const res = await fetch(`/api/admin/search-professionals?${params.toString()}`);
      const data = await res.json();

      if (!data.professionals) {
        setResults([]);
        return;
      }

      // === MAPEO CRÍTICO: el endpoint devuelve weeklySlots (objeto keyed por dayOfWeek 0-6),
      // cada día tiene availableSlots[]. El frontend necesita un array plano de slots
      // con {date, time, endTime, modality}.
      // Bug original: el componente esperaba p.slots (array) pero el endpoint devuelve p.weeklySlots (objeto).
      //
      // === FILTRO DE SLOTS PASADOS (bug 17/07/2026) ===
      // El endpoint NO filtra días pasados (porque la Agenda Central necesita mostrarlos
      // en la grilla con marca 'past'). El derivador SÍ debe mostrar solo slots futuros.
      // Forzamos timezone Argentina (UTC-3) porque el servidor Vercel está en UTC y el
      // admin puede estar navegando desde cualquier tz.
      const ARG_TZ = "America/Argentina/Buenos_Aires";
      const nowArg = new Date();
      const todayStr = nowArg.toLocaleDateString("sv-SE", { timeZone: ARG_TZ }); // "2026-07-16"
      const nowArgTime = nowArg.toLocaleTimeString("en-GB", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit" }); // "14:30"

      const mapped: ProfesionalSugerido[] = data.professionals.map((p: any) => {
        const weeklySlots = p.weeklySlots || {};
        const flatSlots: SlotDisponible[] = [];
        // Iterar los 7 días (0=Dom, 1=Lun, ..., 6=Sab)
        for (const dayKey of Object.keys(weeklySlots)) {
          const dayData = weeklySlots[dayKey];
          if (!dayData || !dayData.availableSlots) continue;
          for (const slot of dayData.availableSlots) {
            const slotDate = dayData.date; // "2026-07-13"
            const slotTime = slot.time;    // "14:00"

            // === FILTRO TEMPORAL ===
            // 1) Día pasado → descartar
            if (slotDate < todayStr) continue;
            // 2) Hoy pero slot ya pasado → descartar
            if (slotDate === todayStr && slotTime <= nowArgTime) continue;
            // 3) Futuro (hoy+y o días futuros) → mantener

            flatSlots.push({
              date: slotDate,
              time: slotTime,
              endTime: slot.endTime,
              modality: slot.modality,
            });
          }
        }
        // Ordenar slots por fecha y hora (los más próximos primero)
        flatSlots.sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.time.localeCompare(b.time);
        });

        return {
          id: p.id,
          name: p.name,
          profession: p.profession,
          specialty: p.specialty,
          // === Zones del endpoint (JSON array string) ===
          // Antes estaba vacío porque el endpoint no los devolvía. Ahora sí.
          zones: parseJsonArray(p.zones),
          // === Datos clínicos para los micro-badges ===
          therapyTypes: parseJsonArray(p.therapyTypes),
          targetAudience: parseJsonArray(p.targetAudience),
          onlineAttention: p.modalityBadges?.includes("Online") ?? false,
          presentialAttention: p.modalityBadges?.includes("Presencial") ?? false,
          homeAttention: p.modalityBadges?.includes("A Domicilio") ?? false,
          phone: p.phone,
          email: p.email,
          slots: flatSlots,
        } as ProfesionalSugerido;
      });

      // === Filtrar por zona si es presencial o domicilio ===
      // (El endpoint no filtra por zona porque las zones están dentro de schedules.direccionId,
      // no como campo directo del professional. Por ahora dejamos el filtro flexible
      // en el frontend, pero si el profesional no tiene zona cargada, lo incluimos igual
      // para no perder profesionales válidos.)
      let filtered: ProfesionalSugerido[] = mapped;
      if ((filters.modality === "presencial" || filters.modality === "domicilio") && filters.zone) {
        filtered = filtered.filter((p: ProfesionalSugerido) => {
          if (!p.zones || p.zones.length === 0) return true; // No filtrar si el profesional no cargó zonas
          const zonesStr = p.zones.join(" ").toLowerCase();
          const zoneLower = filters.zone.toLowerCase();
          const zoneMap: Record<string, string[]> = {
            "capital federal (caba)": ["caba", "capital federal", "flores", "palermo", "caballito", "belgrano", "recoleta"],
            "gba zona norte": ["tigre", "pilar", "san isidro", "vicente lópez", "san fernando", "nordelta"],
            "gba zona oeste": ["merlo", "moreno", "morón", "ituzaingó", "la matanza", "ramos mejía", "haedo", "tres de febrero"],
            "gba zona sur": ["lanús", "avellaneda", "lomas de zamora", "quilmes", "ezeiza", "florencio varela"],
            "prov. de buenos aires": ["la plata", "mar del plata", "tandil"],
            "prov. de córdoba": ["córdoba"],
            "prov. de mendoza": ["mendoza"],
            "prov. de santa fe": ["rosario", "santa fe"],
          };
          const synonyms = zoneMap[zoneLower] || [];
          return zonesStr.includes(zoneLower) || synonyms.some(s => zonesStr.includes(s));
        });
      }

      // === Filtrar por modalidad (redundante con backend, pero por seguridad) ===
      if (filters.modality === "online") {
        filtered = filtered.filter((p: ProfesionalSugerido) => p.onlineAttention);
      } else if (filters.modality === "presencial") {
        filtered = filtered.filter((p: ProfesionalSugerido) => p.presentialAttention);
      } else if (filters.modality === "domicilio") {
        filtered = filtered.filter((p: ProfesionalSugerido) => p.homeAttention || p.presentialAttention);
      }

      // === Filtrar por franja horaria en los slots disponibles ===
      const franja = FRANJAS.find(f => f.value === filters.timeSlot);
      if (franja && franja.value !== "cualquiera") {
        filtered = filtered.map((p: ProfesionalSugerido) => {
          const filteredSlots = (p.slots || []).filter((s: SlotDisponible) => {
            return s.time >= franja.start && s.time < franja.end;
          });
          return { ...p, slots: filteredSlots };
        });
        // Solo mostrar profesionales que tienen al menos 1 slot en la franja
        filtered = filtered.filter((p: ProfesionalSugerido) => p.slots && p.slots.length > 0);
      } else {
        // Si la franja es "cualquiera", igual filtramos profesionales sin slots
        filtered = filtered.filter((p: ProfesionalSugerido) => p.slots && p.slots.length > 0);
      }

      // === Sin límite de slots por profesional ===
      // Antes había un .slice(0, 6) que cortaba los últimos 2 slots de profesionales
      // con 8 turnos (caso María Monge: 14:00-19:30 / 45min → 8 slots, pero se cortaba en 17:45).
      // El contenedor del frontend ya tiene flex flex-wrap gap-2, así que los slots
      // adicionales bajan ordenadamente a una segunda fila sin romper el diseño.
      // Ordenados por proximidad temporal (los más próximos primero).

      setResults(filtered);
    } catch (err) {
      console.error("Error en derivador:", err);
      toast.error("Error al buscar profesionales");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // === Confirmar derivación ===
  const handleConfirmDerivacion = async () => {
    if (!confirmDialog.profesional || !confirmDialog.slot || !filters.patient) {
      toast.error("Faltan datos para confirmar la derivación");
      return;
    }

    setConfirming(true);
    try {
      // Crear el turno usando el endpoint de quick-assign
      // El endpoint hace upsert del paciente por email (si no existe, lo crea)
      // y crea el appointment con status "confirmed".
      // También envía emails automáticos al paciente y al profesional.
      const res = await fetch("/api/admin/quick-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: confirmDialog.profesional.id,
          patientName: filters.patient.name,
          patientEmail: filters.patient.email,
          patientPhone: filters.patient.phone,
          date: confirmDialog.slot.date,
          time: confirmDialog.slot.time,
          modality: confirmDialog.slot.modality,
          reason: "Derivación inteligente desde admin",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const createdMsg = data.created ? " (nuevo paciente creado)" : "";
        toast.success(
          `Derivación confirmada${createdMsg}: ${filters.patient.name} (${filters.patient.email}) ` +
          `con ${confirmDialog.profesional.name} para el ${confirmDialog.slot.date} a las ${confirmDialog.slot.time}`
        );
        setConfirmDialog({ open: false, profesional: null, slot: null });
        // Remover el slot de los resultados (ya está ocupado)
        setResults(prev => prev.map(p => {
          if (p.id === confirmDialog.profesional?.id) {
            return { ...p, slots: p.slots.filter(s => s.time !== confirmDialog.slot?.time || s.date !== confirmDialog.slot?.date) };
          }
          return p;
        }).filter(p => p.slots.length > 0));
      } else {
        toast.error(data.error || "Error al confirmar derivación");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setConfirming(false);
    }
  };

  // === Formatear fecha para mostrar ===
  const formatFecha = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const diaSemana = dias[date.getDay()];
    return `${diaSemana} ${parseInt(d)}/${parseInt(m)}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-teal-900">Derivador Inteligente</h2>
            <p className="text-xs text-teal-500">Encuentra el profesional ideal en segundos</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
          {results.length} profesionales encontrados
        </Badge>
      </div>

      <div className="grid lg:grid-cols-[30%_70%] gap-6 flex-1 min-h-0">
        {/* === COLUMNA IZQUIERDA: Filtros === */}
        <Card className="border-teal-100 h-fit lg:sticky lg:top-4">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-teal-500" />
              <h3 className="font-semibold text-teal-900 text-sm">Filtros de Derivación</h3>
            </div>

            {/* === Paciente (Combobox buscable) === */}
            {/* Reemplaza al input de texto libre para evitar nombres ficticios.
                Permite buscar por nombre, email o teléfono y seleccionar un
                paciente real de la DB. Si no existe, botón "+ Registrar nuevo". */}
            <div className="space-y-2">
              <Label className="text-teal-700 text-xs font-medium">Paciente</Label>
              <Popover open={patientComboboxOpen} onOpenChange={setPatientComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={patientComboboxOpen}
                    className="relative w-full justify-start border-teal-200 bg-white text-sm font-normal h-9 pl-3 pr-9 truncate focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {filters.patient ? (
                      <span className="flex items-center gap-2 truncate min-w-0">
                        <User className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span className="truncate">
                          {filters.patient.name}
                          {filters.patient.isNew && (
                            <span className="ml-1 text-[10px] text-amber-600 font-medium">(nuevo)</span>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 truncate">Buscar paciente...</span>
                    )}
                    {/* Icono de flechas posicionado absolutamente dentro del botón */}
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <ChevronsUpDown className="h-4 w-4" />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar por nombre o email..."
                      value={patientSearchQuery}
                      onValueChange={setPatientSearchQuery}
                    />
                    <CommandList>
                      {patientSearchLoading && (
                        <div className="py-6 text-center text-sm text-teal-500">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                          Buscando...
                        </div>
                      )}
                      {!patientSearchLoading && patientSearchQuery.trim().length < 2 && (
                        <div className="py-6 text-center text-sm text-teal-400">
                          Escribí al menos 2 caracteres para buscar
                        </div>
                      )}
                      {!patientSearchLoading && patientSearchQuery.trim().length >= 2 && patientSearchResults.length === 0 && (
                        <CommandEmpty>No se encontraron pacientes con ese criterio.</CommandEmpty>
                      )}
                      {!patientSearchLoading && patientSearchResults.length > 0 && (
                        <CommandGroup heading="Pacientes existentes">
                          {patientSearchResults.map((p) => (
                            <CommandItem
                              key={p.id || p.email}
                              value={p.id || p.email}
                              onSelect={() => handleSelectPatient(p)}
                              className="flex flex-col items-start gap-0.5 py-2"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <User className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                                <span className="font-medium text-teal-900 text-sm">{p.name}</span>
                              </div>
                              <div className="text-[11px] text-teal-500 pl-5">
                                {p.email}{p.phone && ` · ${p.phone}`}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {/* === Botón "+ Registrar nuevo paciente" === */}
                      {/* Aparece siempre que el admin haya escrito algo, incluso
                          si hay resultados. Permite registrar uno nuevo al vuelo. */}
                      {patientSearchQuery.trim().length >= 2 && (
                        <CommandGroup>
                          <CommandItem
                            onSelect={handleOpenNewPatientDialog}
                            className="bg-amber-50 hover:bg-amber-100 border-t border-amber-200 text-amber-800 font-medium"
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Registrar nuevo paciente
                            {patientSearchQuery.trim() && (
                              <span className="ml-1 text-amber-600">"{patientSearchQuery.trim()}"</span>
                            )}
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {/* Botón para limpiar la selección si ya hay un paciente elegido */}
              {filters.patient && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, patient: null })}
                  className="text-xs text-teal-500 hover:text-red-600 inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Quitar selección
                </button>
              )}
            </div>

            {/* Modalidad (expandida con "Cualquiera") */}
            <div className="space-y-2">
              <Label className="text-teal-700 text-xs font-medium">Modalidad</Label>
              <Select
                value={filters.modality}
                onValueChange={(v) => setFilters({ ...filters, modality: v })}
              >
                <SelectTrigger className="border-teal-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cualquiera">Cualquiera (todas)</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="domicilio">A Domicilio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zona (solo si no es online ni "cualquiera") */}
            {filters.modality !== "online" && filters.modality !== "cualquiera" && (
              <div className="space-y-2">
                <Label className="text-teal-700 text-xs font-medium">Zona</Label>
                <Select
                  value={filters.zone}
                  onValueChange={(v) => setFilters({ ...filters, zone: v })}
                >
                  <SelectTrigger className="border-teal-200 text-sm">
                    <SelectValue placeholder="Todas las zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONAS.map(z => (
                      <SelectItem key={z} value={z}>{z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* === NUEVO: Tipo de Terapia (filtro clínico) === */}
            <div className="space-y-2">
              <Label className="text-teal-700 text-xs font-medium">Tipo de Terapia</Label>
              <Select
                value={filters.therapyType || "__cualquiera__"}
                onValueChange={(v) => setFilters({ ...filters, therapyType: v === "__cualquiera__" ? "" : v })}
              >
                <SelectTrigger className="border-teal-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__cualquiera__">Cualquiera</SelectItem>
                  {TIPOS_TERAPIA.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* === NUEVO: Dirigido A / Público Objetivo === */}
            <div className="space-y-2">
              <Label className="text-teal-700 text-xs font-medium">Dirigido A</Label>
              <Select
                value={filters.targetAudience || "__cualquiera__"}
                onValueChange={(v) => setFilters({ ...filters, targetAudience: v === "__cualquiera__" ? "" : v })}
              >
                <SelectTrigger className="border-teal-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__cualquiera__">Cualquiera</SelectItem>
                  {PUBLICO_OBJETIVO.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Franja horaria */}
            <div className="space-y-2">
              <Label className="text-teal-700 text-xs font-medium">Franja Horaria</Label>
              <Select
                value={filters.timeSlot}
                onValueChange={(v) => setFilters({ ...filters, timeSlot: v })}
              >
                <SelectTrigger className="border-teal-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRANJAS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botón buscar */}
            <Button
              onClick={handleSearch}
              disabled={loading || !filters.patient}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {loading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Search className="mr-2 w-4 h-4" />}
              {loading ? "Buscando..." : "Buscar Profesionales"}
            </Button>

            {!filters.patient && (
              <p className="text-xs text-teal-400 text-center">
                Seleccioná un paciente para comenzar
              </p>
            )}
          </CardContent>
        </Card>

        {/* === COLUMNA DERECHA: Resultados === */}
        <div className="space-y-3 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar pr-1">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-teal-50 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : !hasSearched ? (
            <Card className="border-teal-100">
              <CardContent className="py-16 text-center">
                <Zap className="w-12 h-12 text-teal-200 mx-auto mb-3" />
                <p className="text-teal-700 font-medium">Derivador Inteligente</p>
                <p className="text-teal-500 text-sm mt-1">
                  Completá los filtros de la izquierda y hacé click en "Buscar Profesionales"
                </p>
              </CardContent>
            </Card>
          ) : results.length === 0 ? (
            <Card className="border-teal-100">
              <CardContent className="py-16 text-center">
                <AlertCircle className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                <p className="text-teal-700 font-medium">No se encontraron profesionales</p>
                <p className="text-teal-500 text-sm mt-1">
                  Probá con otra zona, modalidad o franja horaria
                </p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {results.map((prof, idx) => (
                <motion.div
                  key={prof.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <Card className="border-teal-100 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        {/* Info del profesional */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                            <Stethoscope className="w-5 h-5 text-teal-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-teal-900 text-sm">{prof.name}</p>
                              {prof.profession && (
                                <span className="text-xs text-teal-500">{prof.profession}</span>
                              )}
                            </div>
                            <p className="text-xs text-teal-600">{prof.specialty}</p>

                            {/* === Micro-badges clínicos: Tipos de Terapia === */}
                            {/* Ayuda al admin a entender al instante por qué el sistema
                                recomendó a este profesional (match con el filtro clínico). */}
                            {prof.therapyTypes && prof.therapyTypes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {prof.therapyTypes.slice(0, 5).map((t, i) => (
                                  <span
                                    key={`therapy-${i}`}
                                    className="inline-flex items-center bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded font-medium"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {prof.therapyTypes.length > 5 && (
                                  <span className="inline-flex items-center bg-gray-50 text-gray-500 text-[10px] px-2 py-0.5 rounded">
                                    +{prof.therapyTypes.length - 5}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* === Micro-badges clínicos: Público Objetivo === */}
                            {prof.targetAudience && prof.targetAudience.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {prof.targetAudience.map((p, i) => (
                                  <span
                                    key={`aud-${i}`}
                                    className="inline-flex items-center bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded font-medium border border-amber-200"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Badges de zonas */}
                            {prof.zones && prof.zones.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {prof.zones.slice(0, 3).map((z, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] bg-teal-50 border-teal-200 text-teal-600 py-0">
                                    <MapPin className="w-2.5 h-2.5 mr-0.5" />
                                    {z}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {/* WhatsApp del profesional */}
                            {prof.phone && (
                              <a
                                href={`https://wa.me/${formatPhoneForWhatsApp(prof.phone)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1.5 text-xs text-[#25D366] hover:text-[#20bd5a]"
                              >
                                <MessageCircle className="w-3 h-3" />
                                {prof.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Slots disponibles */}
                      <div className="mt-3">
                        <p className="text-xs text-teal-500 font-medium mb-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Próximos turnos disponibles:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {prof.slots.map((slot, i) => (
                            <button
                              key={i}
                              onClick={() => setConfirmDialog({ open: true, profesional: prof, slot })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-lg transition-colors"
                            >
                              <Clock className="w-3 h-3" />
                              {formatFecha(slot.date)} · {slot.time}
                            </button>
                          ))}
                          {prof.slots.length === 0 && (
                            <span className="text-xs text-teal-400">Sin slots disponibles en esta franja</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* === Modal de Confirmación === */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-teal-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Confirmar Derivación
            </DialogTitle>
          </DialogHeader>
          {confirmDialog.profesional && confirmDialog.slot && filters.patient && (
            <div className="space-y-3 py-2">
              <div className="bg-teal-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-500 shrink-0" />
                  <span className="text-sm text-teal-700 break-all">
                    <strong>Paciente:</strong> {filters.patient.name}
                    {filters.patient.isNew && (
                      <span className="ml-1 text-[10px] text-amber-600 font-medium">(nuevo — se creará al confirmar)</span>
                    )}
                    <br />
                    <span className="text-teal-500 text-xs">
                      {filters.patient.email}{filters.patient.phone && ` · ${filters.patient.phone}`}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-500 shrink-0" />
                  <span className="text-sm text-teal-700">
                    <strong>Profesional:</strong> {confirmDialog.profesional.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-500 shrink-0" />
                  <span className="text-sm text-teal-700">
                    <strong>Fecha:</strong> {formatFecha(confirmDialog.slot.date)} a las {confirmDialog.slot.time} hs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-500 shrink-0" />
                  <span className="text-sm text-teal-700">
                    <strong>Modalidad:</strong> {confirmDialog.slot.modality === "OL" ? "Online" : confirmDialog.slot.modality === "P" ? "Presencial" : confirmDialog.slot.modality}
                  </span>
                </div>
              </div>
              <p className="text-xs text-teal-400 text-center">
                Se enviará un email de confirmación al paciente y al profesional.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, profesional: null, slot: null })} className="border-teal-300">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDerivacion}
              disabled={confirming || !filters.patient}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {confirming ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <CheckCircle2 className="mr-2 w-4 h-4" />}
              {confirming ? "Confirmando..." : "Confirmar Derivación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal "Registrar nuevo paciente" === */}
      {/* Perite al admin cargar un paciente nuevo al vuelo (sin salir del derivador).
          El paciente NO se crea en la DB acá — se arma el objeto PacienteSeleccionado
          con isNew=true y se guarda en el estado. Cuando se confirma la derivación,
          el endpoint /api/admin/quick-assign hace upsert por email y lo crea. */}
      <Dialog open={newPatientDialog} onOpenChange={setNewPatientDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-teal-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              Registrar nuevo paciente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-teal-500">
              El paciente se creará automáticamente al confirmar la derivación.
              No es necesario cargar DNI ni otros datos ahora — el paciente podrá
              completarlos después desde su panel.
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-teal-700 text-xs font-medium">Nombre y Apellido *</Label>
                <Input
                  value={newPatientForm.name}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, name: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                  className="border-teal-200 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-teal-700 text-xs font-medium">Email *</Label>
                <Input
                  type="email"
                  value={newPatientForm.email}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, email: e.target.value })}
                  placeholder="juan.perez@email.com"
                  className="border-teal-200 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-teal-700 text-xs font-medium">Teléfono *</Label>
                <Input
                  value={newPatientForm.phone}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, phone: e.target.value })}
                  placeholder="+54 11 1234-5678"
                  className="border-teal-200 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewPatientDialog(false);
                setNewPatientForm({ name: "", email: "", phone: "" });
                // Reabrir el combobox para que el admin pueda buscar de nuevo
                setTimeout(() => setPatientComboboxOpen(true), 100);
              }}
              className="border-teal-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateNewPatient}
              disabled={newPatientSaving || !newPatientForm.name.trim() || !newPatientForm.email.trim() || !newPatientForm.phone.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <UserPlus className="mr-2 w-4 h-4" />
              Agregar paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
