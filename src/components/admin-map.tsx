"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Search,
  Loader2,
  Navigation,
  Stethoscope,
  Calendar,
  X,
  RefreshCw,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import type { MapMarker } from "./map-view";

// === Cargar el mapa dinámicamente (SSR=false) para evitar errores con Leaflet ===
const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] bg-teal-50 rounded-xl">
      <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
    </div>
  ),
});

// === Zonas predefinidas con centro y zoom ===
const ZONES = [
  { id: "caba", label: "CABA", center: [-34.6037, -58.3816] as [number, number], zoom: 12 },
  { id: "norte", label: "GBA Norte", center: [-34.47, -58.55] as [number, number], zoom: 11 },
  { id: "sur", label: "GBA Sur", center: [-34.72, -58.35] as [number, number], zoom: 11 },
  { id: "oeste", label: "GBA Oeste", center: [-34.62, -58.65] as [number, number], zoom: 11 },
  { id: "interior", label: "Interior / PBA", center: [-34.92, -57.95] as [number, number], zoom: 10 },
];

// === Helper: normalizar texto (insensible a tildes) ===
function normalizeText(text: string = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// === Helper: geocodificar dirección con Nominatim (con cache en localStorage) ===
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `rep_geocode_${btoa(address).replace(/[/+=]/g, "_")}`;

  // 1. Verificar cache
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // cache corrupto, continuar
      }
    }
  }

  // 2. Geocodificar con Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=ar`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "es" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      // Guardar en cache
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          // localStorage lleno, no crítico
        }
      }
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

// === Tipo para profesionales con dirección ===
type ProfWithAddress = {
  id: string;
  name: string;
  specialty: string;
  profession: string | null;
  phone: string | null;
  officeAddress: string | null;
  addresses: { id: string; label: string; address: string; isActive: boolean }[];
  totalFreeSlots: number;
  totalBookedSlots: number;
};

export function AdminMap() {
  const { setCurrentView } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<ProfWithAddress[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeZone, setActiveZone] = useState("caba");
  const [mapCenter, setMapCenter] = useState<[number, number]>(ZONES[0].center);
  const [mapZoom, setMapZoom] = useState(ZONES[0].zoom);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // === Cargar profesionales con direcciones ===
  const loadProfessionals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/search-professionals?all=true");
      const data = await res.json();
      if (data.professionals) {
        // Filtrar solo los que tienen dirección presencial
        const withAddress = data.professionals.filter(
          (p: ProfWithAddress) =>
            (p.addresses && p.addresses.length > 0) || p.officeAddress
        );
        setProfessionals(withAddress);
      }
    } catch (err) {
      console.error("Error cargando profesionales:", err);
      toast.error("Error al cargar profesionales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfessionals();
  }, [loadProfessionals]);

  // === Geocodificar direcciones (con delay para respetar rate limit de Nominatim) ===
  useEffect(() => {
    if (professionals.length === 0) return;

    setGeocoding(true);
    const newMarkers: MapMarker[] = [];
    const addressesToGeocode: { prof: ProfWithAddress; addr: string; label: string }[] = [];

    // Recolectar todas las direcciones únicas a geocodificar
    for (const prof of professionals) {
      if (prof.addresses && prof.addresses.length > 0) {
        for (const addr of prof.addresses) {
          // Filtrar emails (igual que en OfficeAddressBadge)
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.address)) continue;
          addressesToGeocode.push({ prof, addr: addr.address, label: addr.label });
        }
      } else if (prof.officeAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prof.officeAddress)) {
        addressesToGeocode.push({ prof, addr: prof.officeAddress, label: "Consultorio" });
      }
    }

    // Geocodificar con delay de 1.2s entre requests (rate limit de Nominatim)
    let cancelled = false;
    (async () => {
      for (let i = 0; i < addressesToGeocode.length; i++) {
        if (cancelled) return;
        const { prof, addr, label } = addressesToGeocode[i];
        const coords = await geocodeAddress(addr);
        if (coords) {
          newMarkers.push({
            id: `${prof.id}_${i}`,
            lat: coords.lat,
            lng: coords.lng,
            name: prof.name,
            specialty: prof.specialty,
            address: `${label}: ${addr}`,
            label,
            totalFreeSlots: prof.totalFreeSlots,
            totalBookedSlots: prof.totalBookedSlots,
            phone: prof.phone,
          });
          // Actualizar markers progresivamente
          if (!cancelled) setMarkers([...newMarkers]);
        }
        // Delay entre requests (excepto el último)
        if (i < addressesToGeocode.length - 1) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      if (!cancelled) setGeocoding(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [professionals]);

  // === Filtrar markers por búsqueda ===
  const filteredMarkers = useMemo(() => {
    const term = normalizeText(searchTerm.trim());
    if (!term) return markers;
    return markers.filter(
      (m) =>
        normalizeText(m.name).includes(term) ||
        normalizeText(m.specialty).includes(term) ||
        normalizeText(m.address).includes(term)
    );
  }, [markers, searchTerm]);

  // === Cambiar zona ===
  const handleZoneChange = (zoneId: string) => {
    const zone = ZONES.find((z) => z.id === zoneId);
    if (zone) {
      setActiveZone(zoneId);
      setMapCenter(zone.center);
      setMapZoom(zone.zoom);
    }
  };

  // === Click en marker → abrir sidebar ===
  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    setSidebarOpen(true);
  };

  // === "Ver Agenda" → navegar a Agenda Central ===
  const handleVerAgenda = () => {
    setCurrentView("admin-agenda-central");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-teal-900">Mapa de Consultorios</h2>
            <p className="text-xs text-teal-500">Derivación geográfica de pacientes</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
          {filteredMarkers.length} consultorios mapeados
        </Badge>
      </div>

      {/* Filtros superiores */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Botones de zona */}
        <div className="flex items-center gap-1 flex-wrap">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              onClick={() => handleZoneChange(zone.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                activeZone === zone.id
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-teal-600 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
              }`}
            >
              <Navigation className="w-3 h-3 inline mr-1" />
              {zone.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
          <input
            type="text"
            placeholder="Buscar por barrio, nombre o especialidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
        </div>
      </div>

      {/* Contenido principal: mapa + sidebar */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Mapa */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-teal-100 min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-teal-50">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              <span className="ml-2 text-teal-600 text-sm">Cargando profesionales...</span>
            </div>
          ) : (
            <>
              <MapView
                markers={filteredMarkers}
                center={mapCenter}
                zoom={mapZoom}
                onMarkerClick={handleMarkerClick}
                selectedMarkerId={selectedMarker?.id || null}
              />
              {/* Indicador de geocodificación */}
              {geocoding && (
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 z-[1000]">
                  <RefreshCw className="w-3.5 h-3.5 text-teal-500 animate-spin" />
                  <span className="text-xs text-teal-600">Geocodificando direcciones...</span>
                </div>
              )}
              {/* Toggle sidebar */}
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 z-[1000] hover:bg-white"
                >
                  <Users className="w-4 h-4 text-teal-600" />
                  <span className="text-xs text-teal-700 font-medium">Ver lista</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Sidebar de profesionales */}
        {sidebarOpen && (
          <div className="w-[320px] shrink-0 flex flex-col gap-2 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar pr-1">
            {/* Botón cerrar sidebar */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="self-end text-teal-400 hover:text-teal-600 mb-1"
              title="Cerrar panel"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Si hay marker seleccionado, mostrar detalle */}
            {selectedMarker ? (
              <Card className="border-emerald-200 shadow-md">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <Stethoscope className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-teal-900 text-sm">{selectedMarker.name}</p>
                        <p className="text-xs text-teal-500">{selectedMarker.specialty}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedMarker(null)}
                      className="text-teal-400 hover:text-teal-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">📍 Dirección del consultorio</p>
                    <p className="text-xs text-emerald-800">{selectedMarker.address}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">
                      {selectedMarker.totalFreeSlots} libres
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                      {selectedMarker.totalBookedSlots} ocupados
                    </Badge>
                  </div>

                  {selectedMarker.phone && (
                    <a
                      href={`https://wa.me/${selectedMarker.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      📱 {selectedMarker.phone}
                    </a>
                  )}

                  <Button
                    onClick={handleVerAgenda}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
                    size="sm"
                  >
                    <Calendar className="w-4 h-4 mr-1.5" />
                    Ver Agenda
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Lista de todos los profesionales mapeados */}
                <p className="text-xs text-teal-500 font-medium px-1">
                  {filteredMarkers.length} consultorios en el mapa
                </p>
                {filteredMarkers.map((m) => (
                  <Card
                    key={m.id}
                    className="border-teal-100 hover:border-emerald-300 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => {
                      setSelectedMarker(m);
                      setMapCenter([m.lat, m.lng]);
                      setMapZoom(15);
                    }}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-teal-900 truncate">{m.name}</p>
                          <p className="text-[10px] text-teal-500 truncate">{m.specialty}</p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">📍 {m.address}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700 px-1 py-0">
                              {m.totalFreeSlots} lib
                            </Badge>
                            <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200 text-slate-600 px-1 py-0">
                              {m.totalBookedSlots} ocup
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredMarkers.length === 0 && !geocoding && (
                  <div className="py-8 text-center">
                    <MapPin className="w-8 h-8 text-teal-200 mx-auto" />
                    <p className="text-teal-500 mt-2 text-xs">
                      {searchTerm ? `Sin resultados para "${searchTerm}"` : "No hay consultorios mapeados"}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer con info */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-teal-400">
        <span>
          🗺️ Datos © OpenStreetMap | Geocodificación por Nominatim
        </span>
        <span>
          {markers.length} de {professionals.length} profesionales geocodificados
        </span>
      </div>
    </div>
  );
}
