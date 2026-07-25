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

// === Palabras geográficas a resaltar en negrita ===
const GEO_KEYWORDS = [
  "CABA", "GBA", "Norte", "Sur", "Oeste", "Interior", "PBA",
  "Buenos Aires", "Ramos Mejía", "Morón", "Merlo", "Moreno", "Palermo",
  "Caballito", "Belgrano", "Recoleta", "Flores", "La Plata", "Tigre",
  "Pilar", "San Isidro", "Vicente López", "San Martín", "Avellaneda",
  "Lanús", "Lomas de Zamora", "Quilmes", "Ituzaingó", "La Matanza",
  "Ramos Mejía", "Tres de Febrero", "Hurlingham", "Villa Urquiza",
  "Versalles", "Ranelagh", "Mexico", "Gaona", "Cabildo", "Rivadavia",
  "Colpayo", "Lavoisier", "Trelles",
];

// === Helper: normalizar texto (insensible a tildes) ===
function normalizeText(text: string = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// === Helper: resaltar palabras geográficas en negrita ===
function highlightGeoText(text: string): React.ReactNode {
  if (!text) return text;
  // Crear regex con todas las palabras geográficas (case-insensitive, sin tildes)
  const normalizedKeywords = GEO_KEYWORDS.map((k) => normalizeText(k));
  // Construir patrón: buscar cualquiera de las palabras, sin importar tildes
  // Usamos una regex que captura cada palabra geográfica
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let found = true;
  let keyCounter = 0;

  while (found && remaining.length > 0) {
    found = false;
    let earliestMatch = -1;
    let matchedKeyword = "";

    for (let i = 0; i < GEO_KEYWORDS.length; i++) {
      const normKeyword = normalizedKeywords[i];
      const normRemaining = normalizeText(remaining);
      const idx = normRemaining.indexOf(normKeyword);
      if (idx !== -1 && (earliestMatch === -1 || idx < earliestMatch)) {
        earliestMatch = idx;
        matchedKeyword = GEO_KEYWORDS[i];
        // Guardar el largo real del match (puede tener tildes)
      }
    }

    if (earliestMatch !== -1) {
      found = true;
      // Texto antes del match
      if (earliestMatch > 0) {
        parts.push(remaining.substring(0, earliestMatch));
      }
      // El match mismo (usar el largo del keyword normalizado para cortar)
      const normKeyword = normalizeText(matchedKeyword);
      const matchEnd = earliestMatch + normKeyword.length;
      parts.push(
        <strong key={keyCounter++} className="font-bold text-emerald-800">
          {remaining.substring(earliestMatch, matchEnd)}
        </strong>
      );
      remaining = remaining.substring(matchEnd);
    }
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts.length > 0 ? parts : text;
}

// === Helper: geocodificar dirección con Nominatim (con cache en localStorage) ===
// Incluye fallback: si la dirección exacta falla, buscar por localidad + provincia
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

  // 2. Geocodificar dirección exacta con Nominatim
  const doGeocode = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ar`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "es" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Intento 1: dirección exacta
  let result = await doGeocode(address);

  // Intento 2 (fallback): si falló, buscar por las últimas 2-3 palabras
  // (probablemente la localidad) + ", Buenos Aires, Argentina"
  if (!result) {
    const words = address.split(/[\s,]+/).filter((w) => w.length > 2);
    if (words.length > 2) {
      // Tomar las últimas 2 palabras (probablemente localidad)
      const localidad = words.slice(-2).join(" ");
      const fallbackQuery = `${localidad}, Buenos Aires, Argentina`;
      result = await doGeocode(fallbackQuery);
      if (result) {
        console.log(`[geocode] Fallback exitoso para "${address}" → usando "${fallbackQuery}"`);
      }
    }
  }

  // 3. Guardar en cache (incluso si es null, para no reintentar)
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch {
      // localStorage lleno
    }
  }

  return result;
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

// === Tipo unificado para items del sidebar (profesional + dirección) ===
// Permite que el sidebar muestre TODOS los profesionales con dirección,
// incluso los que todavía no fueron geocodificados (sin coords en el mapa).
type SidebarItem = {
  key: string;
  profId: string;
  name: string;
  specialty: string;
  profession: string | null;
  phone: string | null;
  address: string;
  label: string;
  totalFreeSlots: number;
  totalBookedSlots: number;
  coords: { lat: number; lng: number } | null; // null si todavía no geocodificó
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
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // === Cargar profesionales con direcciones ===
  const loadProfessionals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/search-professionals?all=true");
      const data = await res.json();
      if (data.professionals) {
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

  // === Construir items del sidebar desde professionals (no desde markers) ===
  // Esto permite que el sidebar muestre TODOS los profesionales con dirección,
  // incluso antes de que termine la geocodificación.
  const sidebarItems: SidebarItem[] = useMemo(() => {
    const items: SidebarItem[] = [];
    for (const prof of professionals) {
      if (prof.addresses && prof.addresses.length > 0) {
        for (let i = 0; i < prof.addresses.length; i++) {
          const addr = prof.addresses[i];
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.address)) continue;
          // Buscar si ya tenemos coords para esta dirección
          const existingMarker = markers.find((m) => m.id === `${prof.id}_${i}`);
          items.push({
            key: `${prof.id}_${i}`,
            profId: prof.id,
            name: prof.name,
            specialty: prof.specialty,
            profession: prof.profession,
            phone: prof.phone,
            address: addr.address,
            label: addr.label,
            totalFreeSlots: prof.totalFreeSlots,
            totalBookedSlots: prof.totalBookedSlots,
            coords: existingMarker ? { lat: existingMarker.lat, lng: existingMarker.lng } : null,
          });
        }
      } else if (prof.officeAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prof.officeAddress)) {
        const existingMarker = markers.find((m) => m.id === `${prof.id}_0`);
        items.push({
          key: `${prof.id}_0`,
          profId: prof.id,
          name: prof.name,
          specialty: prof.specialty,
          profession: prof.profession,
          phone: prof.phone,
          address: prof.officeAddress,
          label: "Consultorio",
          totalFreeSlots: prof.totalFreeSlots,
          totalBookedSlots: prof.totalBookedSlots,
          coords: existingMarker ? { lat: existingMarker.lat, lng: existingMarker.lng } : null,
        });
      }
    }
    return items;
  }, [professionals, markers]);

  // === Geocodificar direcciones (con delay para respetar rate limit de Nominatim) ===
  useEffect(() => {
    if (professionals.length === 0) return;

    setGeocoding(true);
    const newMarkers: MapMarker[] = [];
    const addressesToGeocode: { prof: ProfWithAddress; addr: string; label: string; index: number }[] = [];

    for (const prof of professionals) {
      let addrIndex = 0;
      if (prof.addresses && prof.addresses.length > 0) {
        for (const addr of prof.addresses) {
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.address)) continue;
          addressesToGeocode.push({ prof, addr: addr.address, label: addr.label, index: addrIndex });
          addrIndex++;
        }
      } else if (prof.officeAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prof.officeAddress)) {
        addressesToGeocode.push({ prof, addr: prof.officeAddress, label: "Consultorio", index: 0 });
      }
    }

    let cancelled = false;
    (async () => {
      for (let i = 0; i < addressesToGeocode.length; i++) {
        if (cancelled) return;
        const { prof, addr, label, index } = addressesToGeocode[i];
        const coords = await geocodeAddress(addr);
        if (coords) {
          newMarkers.push({
            id: `${prof.id}_${index}`,
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
          if (!cancelled) setMarkers([...newMarkers]);
        }
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

  // === Filtrar items del sidebar por búsqueda (sobre TODOS los profesionales) ===
  const filteredSidebarItems = useMemo(() => {
    const term = normalizeText(searchTerm.trim());
    if (!term) return sidebarItems;
    return sidebarItems.filter(
      (item) =>
        normalizeText(item.name).includes(term) ||
        normalizeText(item.specialty).includes(term) ||
        normalizeText(item.address).includes(term) ||
        normalizeText(item.label).includes(term) ||
        normalizeText(item.profession || "").includes(term)
    );
  }, [sidebarItems, searchTerm]);

  // === Filtrar markers del mapa (solo los que coinciden con la búsqueda) ===
  const filteredMarkers = useMemo(() => {
    const term = normalizeText(searchTerm.trim());
    if (!term) return markers;
    const matchingKeys = new Set(filteredSidebarItems.map((item) => item.key));
    return markers.filter((m) => matchingKeys.has(m.id));
  }, [markers, filteredSidebarItems]);

  // === Cambiar zona ===
  const handleZoneChange = (zoneId: string) => {
    const zone = ZONES.find((z) => z.id === zoneId);
    if (zone) {
      setActiveZone(zoneId);
      setMapCenter(zone.center);
      setMapZoom(zone.zoom);
    }
  };

  // === Click en marker del mapa → abrir sidebar con detalle ===
  const handleMarkerClick = (marker: MapMarker) => {
    const item = sidebarItems.find((i) => i.key === marker.id);
    if (item) {
      setSelectedItem(item);
      setSidebarOpen(true);
    }
  };

  // === Click en item del sidebar → centrar mapa si tiene coords ===
  const handleSidebarItemClick = (item: SidebarItem) => {
    setSelectedItem(item);
    if (item.coords) {
      setMapCenter([item.coords.lat, item.coords.lng]);
      setMapZoom(15);
    }
  };

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
          {filteredSidebarItems.length} consultorios
        </Badge>
      </div>

      {/* Filtros superiores */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Botones de zona (con negritas en labels geográficos) */}
        <div className="flex items-center gap-1 flex-wrap">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              onClick={() => handleZoneChange(zone.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
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
                selectedMarkerId={selectedItem?.key || null}
              />
              {geocoding && (
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 z-[1000]">
                  <RefreshCw className="w-3.5 h-3.5 text-teal-500 animate-spin" />
                  <span className="text-xs text-teal-600">Geocodificando direcciones...</span>
                </div>
              )}
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
            <button
              onClick={() => setSidebarOpen(false)}
              className="self-end text-teal-400 hover:text-teal-600 mb-1"
              title="Cerrar panel"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Si hay item seleccionado, mostrar detalle */}
            {selectedItem ? (
              <Card className="border-emerald-200 shadow-md">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <Stethoscope className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-teal-900 text-sm">{selectedItem.name}</p>
                        <p className="text-xs text-teal-500">{selectedItem.specialty}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-teal-400 hover:text-teal-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">📍 Dirección del consultorio</p>
                    <p className="text-xs text-emerald-800 font-medium">
                      {highlightGeoText(selectedItem.label)}:{" "}
                      {highlightGeoText(selectedItem.address)}
                    </p>
                    {!selectedItem.coords && (
                      <p className="text-[10px] text-amber-600 mt-1 italic">
                        ⏳ Obteniendo ubicación en el mapa...
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">
                      {selectedItem.totalFreeSlots} libres
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                      {selectedItem.totalBookedSlots} ocupados
                    </Badge>
                  </div>

                  {selectedItem.phone && (
                    <a
                      href={`https://wa.me/${selectedItem.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      📱 {selectedItem.phone}
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
                {/* Lista de TODOS los profesionales con dirección (no solo los geocodificados) */}
                <p className="text-xs text-teal-500 font-medium px-1">
                  {filteredSidebarItems.length} consultorios
                  {geocoding && " (geocodificando...)"}
                </p>
                {filteredSidebarItems.map((item) => (
                  <Card
                    key={item.key}
                    className={`border-teal-100 hover:border-emerald-300 hover:shadow-sm cursor-pointer transition-all ${
                      item.coords ? "" : "opacity-75"
                    }`}
                    onClick={() => handleSidebarItemClick(item)}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-teal-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-teal-500 truncate">{item.specialty}</p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            📍 <span className="font-medium">{highlightGeoText(item.label)}</span>:{" "}
                            {highlightGeoText(item.address)}
                          </p>
                          {!item.coords && (
                            <p className="text-[9px] text-amber-500 italic">⏳ En el mapa pronto...</p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700 px-1 py-0">
                              {item.totalFreeSlots} lib
                            </Badge>
                            <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200 text-slate-600 px-1 py-0">
                              {item.totalBookedSlots} ocup
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredSidebarItems.length === 0 && (
                  <div className="py-8 text-center">
                    <MapPin className="w-8 h-8 text-teal-200 mx-auto" />
                    <p className="text-teal-500 mt-2 text-xs">
                      {searchTerm ? `Sin resultados para "${searchTerm}"` : "No hay consultorios cargados"}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-teal-400">
        <span>🗺️ Datos © OpenStreetMap | Geocodificación por Nominatim</span>
        <span>
          {markers.length} de {sidebarItems.length} direcciones geocodificadas
        </span>
      </div>
    </div>
  );
}
