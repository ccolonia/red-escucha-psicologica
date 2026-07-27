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

// === Helper: detectar zona de una dirección ===
// Devuelve el label de la zona (CABA, GBA Norte, etc.) o null si no detecta
function detectZone(address: string): string | null {
  const norm = normalizeText(address);
  // CABA — barrios conocidos
  const cabaBarrios = ["palermo", "caballito", "belgrano", "recoleta", "flores", "floresta", "versalles", "villa urquiza", "liniers", "mataderos", "san telmo", "la boca", "almagro", "boedo", "nunez", "devoto", "saavedra", "coghlan", "agronomia", "park", "centro", "microcentro", "balvanera", "once", "congreso", "monserrat", "san cristobal", "constitucion", "barracas"];
  if (cabaBarrios.some((b) => norm.includes(b)) || norm.includes("caba") || norm.includes("capital federal") || norm.includes("ciudad autonoma")) {
    return "CABA";
  }
  // GBA Norte
  const gbaNorte = ["tigre", "pilar", "san isidro", "vicente lopez", "san fernando", "nordelta", "san martin", "3 de febrero", "tres de febrero", "hurlingham", "moron", "ituzaingo"];
  if (gbaNorte.some((b) => norm.includes(b))) {
    // Morón e Ituzaingó a veces se consideran Oeste, pero los incluimos en Norte por proximidad
    if (norm.includes("moron") || norm.includes("ituzaingo")) return "GBA Oeste";
    return "GBA Norte";
  }
  // GBA Sur
  const gbaSur = ["avellaneda", "lanus", "lomas de zamora", "quilmes", "ezeiza", "florencio varela", "almirante brown", "quilmes"];
  if (gbaSur.some((b) => norm.includes(b))) {
    return "GBA Sur";
  }
  // GBA Oeste
  const gbaOeste = ["merlo", "moreno", "la matanza", "ramos mejia", "haedo", "el palomar", "caseros", "ciudadela"];
  if (gbaOeste.some((b) => norm.includes(b))) {
    return "GBA Oeste";
  }
  // Interior / PBA
  const pba = ["la plata", "mar del plata", "tandil", "bahia blanca", "junin", "olavarria", "trenque lauquen", "ranelagh", "berazategui"];
  if (pba.some((b) => norm.includes(b)) || norm.includes("provincia de buenos aires") || norm.includes("pba")) {
    return "Interior / PBA";
  }
  return null;
}

// === Helper: detectar barrio/localidad de una dirección ===
// Devuelve el nombre del barrio o localidad encontrado, o null
function detectBarrio(address: string): string | null {
  const norm = normalizeText(address);
  // Lista de barrios/localidades conocidos con su nombre canónico
  const barrios: { norm: string; label: string }[] = [
    { norm: "palermo", label: "Palermo" },
    { norm: "caballito", label: "Caballito" },
    { norm: "belgrano", label: "Belgrano" },
    { norm: "recoleta", label: "Recoleta" },
    { norm: "flores", label: "Flores" },
    { norm: "versalles", label: "Versalles" },
    { norm: "villa urquiza", label: "Villa Urquiza" },
    { norm: "ramos mejia", label: "Ramos Mejía" },
    { norm: "moron", label: "Morón" },
    { norm: "merlo", label: "Merlo" },
    { norm: "moreno", label: "Moreno" },
    { norm: "la matanza", label: "La Matanza" },
    { norm: "san martin", label: "San Martín" },
    { norm: "tigre", label: "Tigre" },
    { norm: "pilar", label: "Pilar" },
    { norm: "san isidro", label: "San Isidro" },
    { norm: "vicente lopez", label: "Vicente López" },
    { norm: "avellaneda", label: "Avellaneda" },
    { norm: "lanus", label: "Lanús" },
    { norm: "lomas de zamora", label: "Lomas de Zamora" },
    { norm: "quilmes", label: "Quilmes" },
    { norm: "la plata", label: "La Plata" },
    { norm: "ranelagh", label: "Ranelagh" },
    { norm: "ituzaingo", label: "Ituzaingó" },
    { norm: "haedo", label: "Haedo" },
    { norm: "caseros", label: "Caseros" },
    { norm: "san fernando", label: "San Fernando" },
    { norm: "ezeiza", label: "Ezeiza" },
  ];
  for (const b of barrios) {
    if (norm.includes(b.norm)) return b.label;
  }
  return null;
}

// === Colores de zonas para los badges ===
const ZONE_COLORS: Record<string, string> = {
  "CABA": "bg-teal-100 text-teal-800 border-teal-300",
  "GBA Norte": "bg-blue-100 text-blue-800 border-blue-300",
  "GBA Sur": "bg-purple-100 text-purple-800 border-purple-300",
  "GBA Oeste": "bg-amber-100 text-amber-800 border-amber-300",
  "Interior / PBA": "bg-emerald-100 text-emerald-800 border-emerald-300",
};

// === Helper: sanitizar dirección para evitar duplicación (FIX DEFINITIVO) ===
// Algunos profesionales cargaron en `label` la dirección completa y en
// `address` también la dirección (con leves variaciones). El helper
// anterior usaba includes() que no detectaba duplicados con variaciones.
//
// Nuevo enfoque estricto:
// 1. Si la dirección ya contiene "—" o ":", tomar solo el primer segmento
// 2. Comparar los primeros 20 caracteres normalizados de label y address
//    — si coinciden, son duplicados → mostrar solo address
// 3. Si no son duplicados, mostrar "label — address" (formato limpio)
function sanitizeAddress(label: string, address: string): string {
  if (!address) return label || "";

  // Paso 1: limpiar la dirección de separadores previos
  let cleanAddr = address;
  if (/—|:/.test(cleanAddr)) {
    const parts = cleanAddr.split(/—|:/);
    cleanAddr = parts[0].trim();
  }

  // Paso 2: comparar primeros 20 chars normalizados
  const normLabel = normalizeText(label).substring(0, 20);
  const normAddr = normalizeText(cleanAddr).substring(0, 20);

  // Si los primeros 20 chars coinciden, son duplicados
  if (normLabel === normAddr && normLabel.length > 5) {
    return cleanAddr;
  }

  // Paso 3: si el label es genérico (corta, < 30 chars y no parece dirección)
  // mostrar "label — address"
  if (label.length < 30 && !/\d/.test(label)) {
    return `${label} — ${cleanAddr}`;
  }

  // Si el label parece una dirección (tiene números), mostrar solo address
  return cleanAddr;
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
              <Card className="bg-white border border-slate-200 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  {/* === Badges de zona + barrio === */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {(() => {
                      // Buscar zona y barrio en AMBOS campos (address + label)
                      // porque a veces la localidad está en el label, no en el address
                      const combined = `${selectedItem.address} ${selectedItem.label}`;
                      const zone = detectZone(combined);
                      const barrio = detectBarrio(combined);
                      return (
                        <>
                          {zone && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${ZONE_COLORS[zone] || "bg-slate-100 text-slate-700 border-slate-300"}`}>
                              {zone}
                            </span>
                          )}
                          {barrio && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full border bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {barrio}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* === Nombre + especialidad === */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{selectedItem.name}</p>
                      <p className="text-xs text-gray-500">{selectedItem.specialty}</p>
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* === Dirección limpia en una línea (sin caja verde) === */}
                  <div className="text-sm text-gray-700">
                    📍 {sanitizeAddress(selectedItem.label, selectedItem.address)}
                  </div>

                  {/* === Estado de geocodificación === */}
                  {!selectedItem.coords ? (
                    <p className="text-[10px] text-amber-600 italic flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                      Ubicación aproximada — cargando en mapa...
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                      ✅ Ubicación confirmada en el mapa
                    </p>
                  )}

                  {/* === Slots compactos en una línea === */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-gray-700 font-medium">{selectedItem.totalFreeSlots} libres</span>
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400"></span>
                      <span className="text-gray-500">{selectedItem.totalBookedSlots} ocupados</span>
                    </span>
                  </div>

                  {/* === WhatsApp === */}
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

                  {/* === Botón Ver Agenda === */}
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
                {filteredSidebarItems.map((item) => {
                  // Buscar zona y barrio en AMBOS campos (address + label)
                  const combined = `${item.address} ${item.label}`;
                  const zone = detectZone(combined);
                  const barrio = detectBarrio(combined);
                  return (
                    <Card
                      key={item.key}
                      className="bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 cursor-pointer transition-all"
                      onClick={() => handleSidebarItemClick(item)}
                    >
                      <CardContent className="p-3 space-y-1.5">
                        {/* === Badges de zona + barrio === */}
                        <div className="flex flex-wrap items-center gap-1">
                          {zone ? (
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${ZONE_COLORS[zone] || "bg-slate-100 text-slate-700 border-slate-300"}`}>
                              {zone}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full border bg-slate-50 text-slate-400 border-slate-200">
                              Sin zona
                            </span>
                          )}
                          {barrio && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full border bg-slate-100 text-slate-600 border-slate-300 flex items-center gap-0.5">
                              <MapPin className="w-2 h-2" />
                              {barrio}
                            </span>
                          )}
                          {!item.coords && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full border bg-amber-50 text-amber-600 border-amber-300 flex items-center gap-0.5">
                              <span className="inline-block w-1 h-1 bg-amber-400 rounded-full animate-pulse"></span>
                              Cargando
                            </span>
                          )}
                        </div>

                        {/* === Nombre + especialidad === */}
                        <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{item.specialty}</p>

                        {/* === Dirección limpia (sin caja verde) === */}
                        <p className="text-[10px] text-gray-600 truncate">
                          📍 {sanitizeAddress(item.label, item.address)}
                        </p>

                        {/* === Slots compactos === */}
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-gray-700 font-medium">{item.totalFreeSlots} lib</span>
                          </span>
                          <span className="text-gray-300">|</span>
                          <span className="flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            <span className="text-gray-500">{item.totalBookedSlots} ocup</span>
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
