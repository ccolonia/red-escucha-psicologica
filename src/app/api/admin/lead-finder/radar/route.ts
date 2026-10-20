import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/admin/lead-finder/radar
// Body: { query: string, location: string, radiusKm?: number }
//
// Proceso:
//  1. Geocoding: convierte "Merlo, Buenos Aires" → lat,lng
//     - Estrategia 1: Google Geocoding API (si GOOGLE_MAPS_API_KEY está seteada)
//     - Estrategia 2 (fallback): Nominatim / OpenStreetMap (gratis, sin API key)
//     - Estrategia 3 (último recurso): coordenadas default de CABA
//  2. Places Text Search: busca "psicologos" cerca de lat,lng en radio X
//     - Si hay GOOGLE_MAPS_API_KEY: usa Google Places API
//     - Si no hay: usa Nominatim Search API (OpenStreetMap) como fallback
//  3. Para cada resultado, consulta Place Details (solo con Google API key)
//  4. Cruza con tabla ProfessionalProspect para marcar cuáles ya están en CRM

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return false;
  const role = (session.user as { role: string }).role;
  return role === "admin" || role === "super_admin";
}

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

// ============================================================================
// HELPER: Geocoding con fallback automático
// ============================================================================
// Estrategia 1: Google Geocoding API (requiere API key)
// Estrategia 2: Nominatim / OpenStreetMap (gratis, sin API key)
// Estrategia 3: Coordenadas default de CABA (último recurso)
// ============================================================================

async function geocodeWithGoogle(location: string, apiKey: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      location
    )}&key=${apiKey}&language=es&region=ar`;
    const res = await fetch(geocodeUrl);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    return {
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
      address: data.results[0].formatted_address,
    };
  } catch {
    return null;
  }
}

async function geocodeWithNominatim(location: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    // Nominatim Search API: gratis, sin API key, límite 1 req/seg
    // Añadimos ", Argentina" si no está incluido para mejorar la precisión
    const searchQuery = location.toLowerCase().includes("argentina") ? location : `${location}, Argentina`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      searchQuery
    )}&format=json&limit=1&addressdetails=1&countrycodes=ar`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "REP-LeadFinder/1.0 (contacto@redescuchapsicologica.com)",
        "Accept-Language": "es",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.display_name || location,
    };
  } catch {
    return null;
  }
}

// Coordenadas default: centro de CABA (Obelisco)
const DEFAULT_CABA_COORDS = { lat: -34.6037, lng: -58.3816 };

// ============================================================================
// HELPER: Places Search con fallback a Nominatim
// ============================================================================

async function searchPlacesWithGoogle(query: string, lat: number, lng: number, radiusMeters: number, apiKey: string): Promise<PlaceResult[]> {
  try {
    const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&location=${lat},${lng}&radius=${radiusMeters}&key=${apiKey}&language=es&region=ar`;
    const res = await fetch(placesUrl);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return [];
    return (data.results || []).slice(0, 20).map((place: {
      place_id: string;
      name: string;
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      rating?: number;
      user_ratings_total?: number;
    }) => ({
      place_id: place.place_id,
      name: place.name,
      formatted_address: place.formatted_address,
      geometry: place.geometry,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
    }));
  } catch {
    return [];
  }
}

async function searchPlacesWithNominatim(query: string, lat: number, lng: number, radiusMeters: number): Promise<PlaceResult[]> {
  try {
    // Nominatim no soporta búsqueda por radio directamente, pero podemos
    // hacer una búsqueda de texto con la query + la zona y filtrar por distancia
    const searchQuery = `${query} cerca de ${lat},${lng}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=20&addressdetails=1&countrycodes=ar`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "REP-LeadFinder/1.0 (contacto@redescuchapsicologica.com)",
        "Accept-Language": "es",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Filtrar resultados por distancia al punto central
    const radiusKm = radiusMeters / 1000;
    return data
      .filter((item: { lat: string; lon: string }) => {
        const itemLat = parseFloat(item.lat);
        const itemLng = parseFloat(item.lon);
        const distance = haversineDistance(lat, lng, itemLat, itemLng);
        return distance <= radiusKm;
      })
      .map((item: { place_id: string; display_name: string; lat: string; lon: string; type?: string; class?: string }) => ({
        place_id: `osm_${item.place_id}`,
        name: item.display_name?.split(",")[0] || "Sin nombre",
        formatted_address: item.display_name || "",
        geometry: { location: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) } },
      }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

// Fórmula de Haversine para calcular distancia entre dos puntos
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const body = await request.json();
    const { query, location, radiusKm } = body;

    if (!query || !location) {
      return NextResponse.json(
        { error: "query y location son obligatorios" },
        { status: 400 }
      );
    }

    const radiusMeters = Math.min(Math.max(Number(radiusKm) || 10, 1), 50) * 1000;

    // === 1. Geocoding con fallback automático ===
    // Estrategia 1: Google Geocoding API (si hay API key)
    // Estrategia 2: Nominatim / OpenStreetMap (gratis)
    // Estrategia 3: Coordenadas default CABA (último recurso)
    let lat: number;
    let lng: number;
    let geocodedAddress: string;
    let geocodeSource: string;

    if (apiKey) {
      const googleResult = await geocodeWithGoogle(location, apiKey);
      if (googleResult) {
        lat = googleResult.lat;
        lng = googleResult.lng;
        geocodedAddress = googleResult.address;
        geocodeSource = "google";
      } else {
        // Fallback a Nominatim
        const nominatimResult = await geocodeWithNominatim(location);
        if (nominatimResult) {
          lat = nominatimResult.lat;
          lng = nominatimResult.lng;
          geocodedAddress = nominatimResult.address;
          geocodeSource = "nominatim (fallback)";
        } else {
          // Último recurso: coordenadas default CABA
          lat = DEFAULT_CABA_COORDS.lat;
          lng = DEFAULT_CABA_COORDS.lng;
          geocodedAddress = "CABA (coordenadas por defecto)";
          geocodeSource = "default-caba";
        }
      }
    } else {
      // Sin API key: ir directo a Nominatim
      const nominatimResult = await geocodeWithNominatim(location);
      if (nominatimResult) {
        lat = nominatimResult.lat;
        lng = nominatimResult.lng;
        geocodedAddress = nominatimResult.address;
        geocodeSource = "nominatim";
      } else {
        // Último recurso: coordenadas default CABA
        lat = DEFAULT_CABA_COORDS.lat;
        lng = DEFAULT_CABA_COORDS.lng;
        geocodedAddress = "CABA (coordenadas por defecto)";
        geocodeSource = "default-caba";
      }
    }

    // === 2. Places Search con fallback ===
    let places: PlaceResult[] = [];

    if (apiKey) {
      places = await searchPlacesWithGoogle(query, lat, lng, radiusMeters, apiKey);
    }

    // Si Google no devolvió resultados (o no hay API key), usar Nominatim
    if (places.length === 0) {
      places = await searchPlacesWithNominatim(query, lat, lng, radiusMeters);
    }

    if (places.length === 0) {
      return NextResponse.json({
        results: [],
        geocoded: { lat, lng, address: geocodedAddress, source: geocodeSource },
        message: "No se encontraron resultados para esta búsqueda",
      });
    }

    // === 3. Place Details (solo con Google API key) ===
    if (apiKey) {
      const detailPromises = places.map(async (place) => {
        try {
          // Solo buscar details si el place_id es de Google (no de OSM)
          if (!place.place_id.startsWith("osm_")) {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,international_phone_number&key=${apiKey}&language=es`;
            const detailRes = await fetch(detailsUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.status === "OK" && detailData.result) {
                place.formatted_phone_number =
                  detailData.result.formatted_phone_number ||
                  detailData.result.international_phone_number;
                place.website = detailData.result.website;
              }
            }
          }
        } catch {
          /* silencioso */
        }
        return place;
      });
      places = await Promise.all(detailPromises);
    }

    // === 4. Cruzar con CRM ===
    const placeIds = places.map((p) => p.place_id);
    const existingProspects = await db.professionalProspect.findMany({
      where: { placeId: { in: placeIds } },
      select: { id: true, placeId: true, status: true },
    });
    const crmMap = new Map(
      existingProspects.map((p) => [p.placeId, { id: p.id, status: p.status }])
    );

    places.forEach((place) => {
      const crmEntry = crmMap.get(place.place_id);
      if (crmEntry) {
        place.inCrm = true;
        place.crmStatus = crmEntry.status;
        place.crmId = crmEntry.id;
      } else {
        place.inCrm = false;
      }
    });

    return NextResponse.json({
      results: places,
      geocoded: { lat, lng, address: geocodedAddress, source: geocodeSource },
      count: places.length,
    });
  } catch (error) {
    console.error("LeadFinder Radar error:", error);
    return NextResponse.json(
      { error: "Error interno en el radar de mapas" },
      { status: 500 }
    );
  }
}
