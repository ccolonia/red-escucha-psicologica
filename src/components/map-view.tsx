"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// === Fix para los iconos default de Leaflet en Webpack ===
// Sin esto, los marcadores no se ven (Webpack no resuelve las rutas de imágenes de Leaflet)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// === Icono personalizado verde para REP ===
const repIcon = L.divIcon({
  html: `<div style="background:#059669;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:12px;">📍</span></div>`,
  className: "rep-marker",
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  specialty: string;
  address: string;
  label: string;
  totalFreeSlots: number;
  totalBookedSlots: number;
  phone: string | null;
};

// === Componente para cambiar el centro del mapa programáticamente ===
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export function MapView({
  markers,
  center,
  zoom,
  onMarkerClick,
  selectedMarkerId,
}: {
  markers: MapMarker[];
  center: [number, number];
  zoom: number;
  onMarkerClick: (marker: MapMarker) => void;
  selectedMarkerId: string | null;
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%", borderRadius: "12px", zIndex: 0 }}
      scrollWheelZoom={true}
    >
      <MapController center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={repIcon}
          eventHandlers={{
            click: () => onMarkerClick(m),
          }}
        >
          <Popup>
            <div style={{ minWidth: "180px" }}>
              <strong style={{ color: "#0f766e", fontSize: "13px" }}>{m.name}</strong>
              <br />
              <span style={{ fontSize: "11px", color: "#64748b" }}>{m.specialty}</span>
              <br />
              <span style={{ fontSize: "11px" }}>📍 {m.address}</span>
              <br />
              <span style={{ fontSize: "11px", color: m.totalFreeSlots > 0 ? "#059669" : "#94a3b8" }}>
                {m.totalFreeSlots} slots libres
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
