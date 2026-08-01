"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, UserPlus, Trash2, Edit3, Loader2, Zap, AlertCircle,
  Users, Star, Phone, Globe, ExternalLink, MessageCircle, Radar, ClipboardList,
  X, Check, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// === Taxonomía geográfica oficial REP ===
const REGIONS = {
  CABA: ["Caballito","Palermo","Belgrano","Recoleta","Almagro","Flores","Boedo","Núñez","Devoto","Villa Urquiza"],
  ZONA_SUR: ["Florencio Varela","Almirante Brown","Lomas de Zamora","Ezeiza","Avellaneda","Quilmes","Esteban Echeverría"],
  ZONA_OESTE: ["La Matanza","Morón","Ituzaingó","Merlo","Moreno","Tres de Febrero"],
  ZONA_NORTE: ["San Isidro","San Miguel","Pilar","Malvinas Argentinas","Villa Ballester","San Martín","Tigre","San Fernando"],
};

const STATUS_CONFIG: Record<string, { label: string; color: string; short: string }> = {
  NUEVO: { label: "Nuevo", color: "bg-blue-100 text-blue-700 border-blue-200", short: "Nuevo" },
  CONTACTADO: { label: "Contactado", color: "bg-amber-100 text-amber-700 border-amber-200", short: "Contact." },
  CV_RECIBIDO: { label: "CV Recibido", color: "bg-purple-100 text-purple-700 border-purple-200", short: "CV" },
  ENTREVISTADO: { label: "Entrevistado", color: "bg-indigo-100 text-indigo-700 border-indigo-200", short: "Entrev." },
  APROBADO: { label: "Reclutado", color: "bg-emerald-100 text-emerald-700 border-emerald-200", short: "Reclut." },
  DESCARTADO: { label: "Descartado", color: "bg-red-100 text-red-600 border-red-200", short: "Descart." },
};

const KANBAN_COLUMNS = ["NUEVO", "CONTACTADO", "CV_RECIBIDO", "ENTREVISTADO", "APROBADO", "DESCARTADO"];

type PlaceResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  website?: string;
  inCrm?: boolean;
  crmStatus?: string;
  crmId?: string;
};

type Prospect = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: string;
  region: string;
  location: string;
  address: string | null;
  status: string;
  notes: string | null;
  source: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  userRatings: number | null;
  website: string | null;
  specialty: string | null;
  zone: string | null;
  createdAt: string;
  updatedAt: string;
};

export function AdminLeadFinder() {
  const [activeTab, setActiveTab] = useState<"radar" | "crm">("radar");

  // === Radar state ===
  const [radarQuery, setRadarQuery] = useState("psicologos consultorios");
  const [radarLocation, setRadarLocation] = useState("Merlo, Buenos Aires");
  const [radarRadius, setRadarRadius] = useState(10);
  const [radarResults, setRadarResults] = useState<PlaceResult[]>([]);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [radarGeocoded, setRadarGeocoded] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);

  // === CRM state ===
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [crmLoading, setCrmLoading] = useState(true);
  const [crmFilter, setCrmFilter] = useState<string>("ALL");
  const [crmSearch, setCrmSearch] = useState("");
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newForm, setNewForm] = useState({ fullName: "", phone: "", email: "", region: "CABA", location: "", notes: "" });

  // === Cargar CRM ===
  const loadProspects = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/lead-finder");
      if (res.ok) {
        const data = await res.json();
        setProspects(Array.isArray(data) ? data : []);
      }
    } catch {
      /* silencioso */
    } finally {
      setCrmLoading(false);
    }
  }, []);

  useEffect(() => { loadProspects(); }, [loadProspects]);

  // === Lanzar Radar ===
  const handleRadarSearch = async () => {
    if (!radarQuery.trim() || !radarLocation.trim()) {
      toast.error("Completá búsqueda y zona");
      return;
    }
    setRadarLoading(true);
    setRadarError(null);
    setRadarResults([]);
    try {
      const res = await fetch("/api/admin/lead-finder/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: radarQuery, location: radarLocation, radiusKm: radarRadius }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRadarError(data.error || "Error en la búsqueda");
        if (data.hint) toast.error(data.error, { description: data.hint });
        return;
      }
      setRadarResults(data.results || []);
      setRadarGeocoded(data.geocoded);
      toast.success(`${data.count} resultados encontrados`);
    } catch {
      setRadarError("Error de conexión");
    } finally {
      setRadarLoading(false);
    }
  };

  // === Guardar Place en CRM ===
  const handleSavePlace = async (place: PlaceResult) => {
    setSavingPlaceId(place.place_id);
    try {
      // Inferir región desde la zona geocodificada
      const zone = radarLocation.split(",")[0].trim();
      const region = (Object.entries(REGIONS).find(([, locs]) => locs.includes(zone))?.[0]) || "CABA";

      const res = await fetch("/api/admin/lead-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: place.name,
          phone: place.formatted_phone_number || "",
          address: place.formatted_address,
          location: zone,
          region,
          zone,
          source: "MAPS_RADAR",
          placeId: place.place_id,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          rating: place.rating,
          userRatings: place.user_ratings_total,
          website: place.website,
          specialty: radarQuery,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (res.status === 409) {
          toast.info("Ya estaba guardado en el CRM");
        } else {
          toast.error(d.error || "Error al guardar");
        }
        return;
      }
      toast.success(`${place.name} guardado en CRM`);
      // Actualizar UI: marcar como inCrm
      setRadarResults(prev => prev.map(p => p.place_id === place.place_id ? { ...p, inCrm: true, crmStatus: "NUEVO" } : p));
      await loadProspects();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingPlaceId(null);
    }
  };

  // === Cambiar estado de prospecto (Kanban) ===
  const handleStatusChange = async (id: string, status: string) => {
    // Optimista
    setProspects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    try {
      await fetch("/api/admin/lead-finder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      toast.success(`Estado: ${STATUS_CONFIG[status]?.label || status}`);
    } catch {
      toast.error("Error al actualizar");
      await loadProspects(); // revertir
    }
  };

  // === Guardar notas ===
  const handleSaveNotes = async () => {
    if (!editingNotes) return;
    try {
      await fetch("/api/admin/lead-finder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingNotes.id, notes: editingNotes.notes }),
      });
      setProspects(prev => prev.map(p => p.id === editingNotes.id ? { ...p, notes: editingNotes.notes } : p));
      setEditingNotes(null);
      toast.success("Notas guardadas");
    } catch {
      toast.error("Error al guardar notas");
    }
  };

  // === Eliminar ===
  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este prospecto del CRM?")) return;
    try {
      await fetch(`/api/admin/lead-finder?id=${id}`, { method: "DELETE" });
      setProspects(prev => prev.filter(p => p.id !== id));
      toast.success("Prospecto eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  // === Crear manual ===
  const handleCreateManual = async () => {
    if (!newForm.fullName.trim()) {
      toast.error("Nombre es obligatorio");
      return;
    }
    try {
      const res = await fetch("/api/admin/lead-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newForm.fullName,
          phone: newForm.phone,
          email: newForm.email,
          region: newForm.region,
          location: newForm.location,
          notes: newForm.notes,
          source: "MANUAL_ENTRY",
        }),
      });
      if (res.ok) {
        toast.success("Prospecto creado");
        setNewDialogOpen(false);
        setNewForm({ fullName: "", phone: "", email: "", region: "CABA", location: "", notes: "" });
        await loadProspects();
      } else {
        const d = await res.json();
        toast.error(d.error || "Error");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  // === Filtrado CRM ===
  const filteredProspects = prospects.filter(p => {
    if (crmFilter !== "ALL" && p.status !== crmFilter) return false;
    if (crmSearch) {
      const q = crmSearch.toLowerCase();
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.location || "").toLowerCase().includes(q) ||
        (p.zone || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // === WhatsApp corporativo ===
  const openWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    const msg = encodeURIComponent(`Hola ${name}, te escribimos de Red Escucha Psicológica. Vimos tu perfil profesional y estamos convocando profesionales para derivación de pacientes. ¿Te interesaría sumarte a la red?`);
    window.open(`https://wa.me/${cleanPhone.replace(/^\+/, "")}?text=${msg}`, "_blank");
  };

  // === Estadísticas rápidas ===
  const stats = {
    total: prospects.length,
    nuevos: prospects.filter(p => p.status === "NUEVO").length,
    reclutados: prospects.filter(p => p.status === "APROBADO").length,
    porRegion: {
      CABA: prospects.filter(p => p.region === "CABA").length,
      ZONA_SUR: prospects.filter(p => p.region === "ZONA_SUR").length,
      ZONA_OESTE: prospects.filter(p => p.region === "ZONA_OESTE").length,
      ZONA_NORTE: prospects.filter(p => p.region === "ZONA_NORTE").length,
    },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Radar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-teal-900">LeadFinder</h2>
            <p className="text-xs text-teal-500">Radar de Google Maps + CRM de Reclutamiento</p>
          </div>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
          <UserPlus className="w-4 h-4 mr-1.5" />
          Nuevo Prospecto
        </Button>
      </div>

      {/* Widget: Demanda Insatisfecha */}
      <Card className="border-amber-200 bg-amber-50/50 mb-4">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-bold text-amber-800">Cobertura por Zona (CRM)</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(stats.porRegion).map(([region, count]) => (
              <div key={region} className={`rounded-lg p-2 text-center border ${count === 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
                <p className="text-[10px] text-slate-500 font-medium">{region.replace("ZONA_", "Zona ")}</p>
                <p className={`text-lg font-bold ${count === 0 ? "text-red-600" : "text-teal-700"}`}>{count}</p>
                <p className="text-[9px] text-slate-400">{count === 0 ? "Sin cobertura" : "prospectos"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-teal-100 pb-2">
        <button onClick={() => setActiveTab("radar")} className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-1.5 ${activeTab === "radar" ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-600 hover:bg-purple-100"}`}>
          <Radar className="w-4 h-4" /> Radar de Mapas
        </button>
        <button onClick={() => setActiveTab("crm")} className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-1.5 ${activeTab === "crm" ? "bg-teal-600 text-white" : "bg-teal-50 text-teal-600 hover:bg-teal-100"}`}>
          <ClipboardList className="w-4 h-4" /> CRM Kanban ({prospects.length})
        </button>
      </div>

      {/* === TAB RADAR === */}
      {activeTab === "radar" && (
        <div className="flex-1 overflow-y-auto">
          {/* Buscador */}
          <Card className="border-purple-100 mb-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2">
                <div>
                  <Label className="text-xs text-purple-600">Búsqueda</Label>
                  <Input value={radarQuery} onChange={e => setRadarQuery(e.target.value)} placeholder="psicologos, consultorios, centro de salud mental..." className="h-9 text-sm border-purple-200" />
                </div>
                <div>
                  <Label className="text-xs text-purple-600">Zona / Localidad</Label>
                  <Input value={radarLocation} onChange={e => setRadarLocation(e.target.value)} placeholder="Merlo, Buenos Aires" className="h-9 text-sm border-purple-200" />
                </div>
                <div>
                  <Label className="text-xs text-purple-600">Radio</Label>
                  <select value={radarRadius} onChange={e => setRadarRadius(Number(e.target.value))} className="h-9 text-sm border border-purple-200 rounded-md px-2">
                    <option value={5}>5 km</option>
                    <option value={10}>10 km</option>
                    <option value={20}>20 km</option>
                    <option value={50}>50 km</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleRadarSearch} disabled={radarLoading} className="bg-purple-600 hover:bg-purple-700 text-white h-9">
                    {radarLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Radar className="w-4 h-4 mr-1.5" />}
                    Lanzar Radar
                  </Button>
                </div>
              </div>
              {radarGeocoded && (
                <p className="text-[10px] text-purple-500 mt-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {radarGeocoded.address} (lat: {radarGeocoded.lat.toFixed(4)}, lng: {radarGeocoded.lng.toFixed(4)})
                </p>
              )}
            </CardContent>
          </Card>

          {/* Error */}
          {radarError && (
            <Card className="border-red-200 bg-red-50 mb-4">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700">{radarError}</p>
                    <p className="text-xs text-red-500 mt-1">
                      Si falta configurar GOOGLE_MAPS_API_KEY, agregala en Vercel → Settings → Environment Variables.
                      La key debe tener habilitadas: Geocoding API + Places API.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultados */}
          {radarLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-2" />
              <p className="text-sm text-purple-600">Escaneando zona con Google Maps...</p>
            </div>
          ) : radarResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {radarResults.map(place => (
                <Card key={place.place_id} className={`border ${place.inCrm ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-teal-900 truncate">{place.name}</p>
                          {place.inCrm && (
                            <Badge variant="outline" className={`text-[9px] ${STATUS_CONFIG[place.crmStatus || ""]?.color}`}>
                              ✓ {STATUS_CONFIG[place.crmStatus || ""]?.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {place.formatted_address}
                        </p>
                      </div>
                      {place.rating && (
                        <div className="flex items-center gap-1 shrink-0 bg-amber-50 px-2 py-1 rounded-md">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold text-amber-700">{place.rating.toFixed(1)}</span>
                          {place.user_ratings_total && (
                            <span className="text-[9px] text-amber-500">({place.user_ratings_total})</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-600 mb-2 flex-wrap">
                      {place.formatted_phone_number && (
                        <a href={`tel:${place.formatted_phone_number}`} className="flex items-center gap-1 hover:text-teal-600">
                          <Phone className="w-3 h-3" /> {place.formatted_phone_number}
                        </a>
                      )}
                      {place.website && (
                        <a href={place.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-teal-600 truncate max-w-[150px]">
                          <Globe className="w-3 h-3" /> Web <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {!place.inCrm ? (
                      <Button
                        onClick={() => handleSavePlace(place)}
                        disabled={savingPlaceId === place.place_id}
                        size="sm"
                        className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {savingPlaceId === place.place_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3 mr-1" />}
                        Guardar en CRM
                      </Button>
                    ) : (
                      <div className="text-center text-[10px] text-emerald-600 font-medium py-1">
                        ✓ Ya en CRM — ver en pestaña Kanban
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !radarError && !radarLoading && (
            <Card className="border-purple-100">
              <CardContent className="py-12 text-center">
                <Radar className="w-10 h-10 text-purple-200 mx-auto mb-2" />
                <p className="text-sm font-medium text-purple-700">Lanzá el radar para encontrar profesionales</p>
                <p className="text-xs text-purple-500 mt-1">Ingresá una zona y un tipo de búsqueda para escanear Google Maps</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* === TAB CRM KANBAN === */}
      {activeTab === "crm" && (
        <div className="flex-1 flex flex-col">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, zona..."
                value={crmSearch}
                onChange={e => setCrmSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            <select value={crmFilter} onChange={e => setCrmFilter(e.target.value)} className="h-9 text-sm border border-teal-200 rounded-lg px-3">
              <option value="ALL">Todos ({prospects.length})</option>
              {KANBAN_COLUMNS.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label} ({prospects.filter(p => p.status === s).length})</option>
              ))}
            </select>
          </div>

          {/* Kanban columns */}
          {crmLoading ? (
            <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-teal-400 mx-auto" /></div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-3 min-w-max pb-4">
                {KANBAN_COLUMNS.map(colStatus => {
                  const colProspects = filteredProspects.filter(p => p.status === colStatus);
                  const config = STATUS_CONFIG[colStatus];
                  return (
                    <div key={colStatus} className="w-72 shrink-0">
                      <div className={`rounded-lg px-3 py-2 mb-2 border ${config.color}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold">{config.label}</p>
                          <span className="text-[10px] font-bold bg-white/50 px-1.5 py-0.5 rounded">{colProspects.length}</span>
                        </div>
                      </div>
                      <div className="space-y-2 min-h-[100px]">
                        {colProspects.map(p => (
                          <Card key={p.id} className="border-slate-200 hover:shadow-sm transition-shadow">
                            <CardContent className="p-2.5">
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <p className="text-xs font-bold text-teal-900 truncate flex-1">{p.fullName}</p>
                                <button onClick={() => handleDelete(p.id)} className="text-red-300 hover:text-red-500 shrink-0">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              {p.address && (
                                <p className="text-[9px] text-slate-500 flex items-start gap-1 mb-1">
                                  <MapPin className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                                  <span className="truncate">{p.address}</span>
                                </p>
                              )}
                              {p.rating && (
                                <div className="flex items-center gap-1 mb-1">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                  <span className="text-[10px] font-medium text-amber-700">{p.rating.toFixed(1)}</span>
                                  {p.userRatings && <span className="text-[9px] text-slate-400">({p.userRatings})</span>}
                                </div>
                              )}
                              {p.phone && (
                                <p className="text-[9px] text-slate-600 mb-1">📞 {p.phone}</p>
                              )}
                              {p.notes && (
                                <p className="text-[9px] text-slate-400 italic truncate mb-1">{p.notes}</p>
                              )}
                              {/* Acciones rápidas */}
                              <div className="flex items-center gap-1 mt-2">
                                {p.phone && (
                                  <button onClick={() => openWhatsApp(p.phone, p.fullName)} className="p-1 rounded bg-emerald-50 border border-emerald-200 hover:bg-emerald-100" title="WhatsApp">
                                    <MessageCircle className="w-3 h-3 text-emerald-600" />
                                  </button>
                                )}
                                {p.website && (
                                  <a href={p.website} target="_blank" rel="noopener noreferrer" className="p-1 rounded bg-blue-50 border border-blue-200 hover:bg-blue-100" title="Sitio web">
                                    <Globe className="w-3 h-3 text-blue-600" />
                                  </a>
                                )}
                                <button onClick={() => setEditingNotes({ id: p.id, notes: p.notes || "" })} className="p-1 rounded bg-white border border-teal-200 hover:bg-teal-50" title="Notas">
                                  <Edit3 className="w-3 h-3 text-teal-500" />
                                </button>
                              </div>
                              {/* Selector de estado */}
                              <select
                                value={p.status}
                                onChange={e => handleStatusChange(p.id, e.target.value)}
                                className="w-full mt-2 h-6 text-[10px] border border-slate-200 rounded px-1"
                              >
                                {KANBAN_COLUMNS.map(s => (
                                  <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>
                                ))}
                              </select>
                            </CardContent>
                          </Card>
                        ))}
                        {colProspects.length === 0 && (
                          <div className="text-center py-4">
                            <p className="text-[10px] text-slate-300 italic">Sin prospectos</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === Modal Editar Notas === */}
      <AnimatePresence>
        {editingNotes && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setEditingNotes(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-teal-900">Editar Notas</h3>
                <button onClick={() => setEditingNotes(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <textarea
                value={editingNotes.notes}
                onChange={e => setEditingNotes({ ...editingNotes, notes: e.target.value })}
                rows={5}
                placeholder="Ej: Mónica habló el 12/08, interesada en sumar agenda presencial..."
                className="w-full text-sm border border-teal-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none"
              />
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" onClick={() => setEditingNotes(null)} className="border-teal-300 text-xs h-8">Cancelar</Button>
                <Button onClick={handleSaveNotes} className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8">
                  <Check className="w-3 h-3 mr-1" /> Guardar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Modal Nuevo Prospecto === */}
      <AnimatePresence>
        {newDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setNewDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-teal-900">Nuevo Prospecto Manual</h3>
                <button onClick={() => setNewDialogOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Nombre completo *</Label>
                  <Input value={newForm.fullName} onChange={e => setNewForm({ ...newForm, fullName: e.target.value })} className="h-8 text-sm border-teal-200" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Teléfono</Label>
                    <Input value={newForm.phone} onChange={e => setNewForm({ ...newForm, phone: e.target.value })} className="h-8 text-sm border-teal-200" />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={newForm.email} onChange={e => setNewForm({ ...newForm, email: e.target.value })} className="h-8 text-sm border-teal-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Región</Label>
                    <select value={newForm.region} onChange={e => setNewForm({ ...newForm, region: e.target.value })} className="w-full h-8 text-sm border border-teal-200 rounded-md px-2">
                      <option value="CABA">CABA</option>
                      <option value="ZONA_SUR">Zona Sur</option>
                      <option value="ZONA_OESTE">Zona Oeste</option>
                      <option value="ZONA_NORTE">Zona Norte</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Localidad</Label>
                    <Input value={newForm.location} onChange={e => setNewForm({ ...newForm, location: e.target.value })} className="h-8 text-sm border-teal-200" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <textarea value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes: e.target.value })} rows={2} className="w-full text-sm border border-teal-200 rounded-lg p-2 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" onClick={() => setNewDialogOpen(false)} className="border-teal-300 text-xs h-8">Cancelar</Button>
                <Button onClick={handleCreateManual} className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8">Crear</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
