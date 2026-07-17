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
import { toast } from "sonner";
import { formatPhoneForWhatsApp } from "@/lib/email";

// === Tipos ===
type DerivacionFilters = {
  patientName: string;
  modality: string; // "online" | "presencial" | "domicilio"
  zone: string;
  timeSlot: string; // "manana" | "tarde" | "noche"
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

// === Franjas horarias ===
// Ampliada "Tarde" hasta 20:00 para incluir slots como 18:30 y 19:15
// (caso María Monge 14:00-19:30 / 45min → último slot 19:15)
const FRANJAS = [
  { value: "manana", label: "Mañana (08:00 - 12:00)", start: "08:00", end: "12:00" },
  { value: "tarde", label: "Tarde (12:00 - 20:00)", start: "12:00", end: "20:00" },
  { value: "noche", label: "Noche (18:00 - 22:00)", start: "18:00", end: "22:00" },
  { value: "cualquiera", label: "Cualquier franja (todo el día)", start: "00:00", end: "23:59" },
];

export function DerivadorInteligente() {
  const [filters, setFilters] = useState<DerivacionFilters>({
    patientName: "",
    modality: "presencial",
    zone: "",
    timeSlot: "cualquiera",
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

  // === Búsqueda de profesionales con slots disponibles ===
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      // Construir params para el endpoint de search-professionals
      // El endpoint usa modality en el sentido de "presencial" | "online" | "híbrida" | "ambas"
      // "domicilio" no es un valor que entienda, así que lo mapeamos a "presencial"
      // (porque el backend filtra por OR presentialAttention/homeAttention en "presencial")
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
      const mapped: ProfesionalSugerido[] = data.professionals.map((p: any) => {
        const weeklySlots = p.weeklySlots || {};
        const flatSlots: SlotDisponible[] = [];
        // Iterar los 7 días (0=Dom, 1=Lun, ..., 6=Sab)
        for (const dayKey of Object.keys(weeklySlots)) {
          const dayData = weeklySlots[dayKey];
          if (!dayData || !dayData.availableSlots) continue;
          for (const slot of dayData.availableSlots) {
            flatSlots.push({
              date: dayData.date,
              time: slot.time,
              endTime: slot.endTime,
              modality: slot.modality,
            });
          }
        }
        // Ordenar slots por fecha y hora
        flatSlots.sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.time.localeCompare(b.time);
        });

        return {
          id: p.id,
          name: p.name,
          profession: p.profession,
          specialty: p.specialty,
          zones: [], // El endpoint no devuelve zones como array; el frontend las puede obtener del schedules si hace falta
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

      // Limitar a 6 slots por profesional (los más próximos)
      filtered = filtered.map((p: ProfesionalSugerido) => ({
        ...p,
        slots: p.slots.slice(0, 6),
      }));

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
    if (!confirmDialog.profesional || !confirmDialog.slot || !filters.patientName.trim()) {
      toast.error("Faltan datos para confirmar la derivación");
      return;
    }

    setConfirming(true);
    try {
      // Crear el turno usando el endpoint de quick-assign
      const res = await fetch("/api/admin/quick-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: confirmDialog.profesional.id,
          patientName: filters.patientName,
          date: confirmDialog.slot.date,
          time: confirmDialog.slot.time,
          modality: confirmDialog.slot.modality,
          reason: "Derivación inteligente desde admin",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Derivación confirmada: ${filters.patientName} con ${confirmDialog.profesional.name} para el ${confirmDialog.slot.date} a las ${confirmDialog.slot.time}`);
        setConfirmDialog({ open: false, profesional: null, slot: null });
        // Remover el slot de los resultados
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

            {/* Nombre del paciente */}
            <div className="space-y-2">
              <Label className="text-teal-700 text-xs font-medium">Nombre del Paciente</Label>
              <Input
                value={filters.patientName}
                onChange={(e) => setFilters({ ...filters, patientName: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="border-teal-200 text-sm"
              />
            </div>

            {/* Modalidad */}
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
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="domicilio">A Domicilio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zona (solo si no es online) */}
            {filters.modality !== "online" && (
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
              disabled={loading || !filters.patientName.trim()}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {loading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Search className="mr-2 w-4 h-4" />}
              {loading ? "Buscando..." : "Buscar Profesionales"}
            </Button>

            {!filters.patientName.trim() && (
              <p className="text-xs text-teal-400 text-center">
                Ingresá el nombre del paciente para comenzar
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
          {confirmDialog.profesional && confirmDialog.slot && (
            <div className="space-y-3 py-2">
              <div className="bg-teal-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-500" />
                  <span className="text-sm text-teal-700">
                    <strong>Paciente:</strong> {filters.patientName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-500" />
                  <span className="text-sm text-teal-700">
                    <strong>Profesional:</strong> {confirmDialog.profesional.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-500" />
                  <span className="text-sm text-teal-700">
                    <strong>Fecha:</strong> {formatFecha(confirmDialog.slot.date)} a las {confirmDialog.slot.time} hs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-500" />
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
              disabled={confirming || !filters.patientName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {confirming ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <CheckCircle2 className="mr-2 w-4 h-4" />}
              {confirming ? "Confirmando..." : "Confirmar Derivación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
