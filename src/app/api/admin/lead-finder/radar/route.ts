import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/admin/lead-finder/radar
// Body: { query: string, location: string, radiusKm?: number, preGeocoded?: {lat,lng,address} }
//
// MOTOR PRINCIPAL: Google Places API (Text Search + Nearby Search)
// FALLBACK: Nominatim / OpenStreetMap (silencioso, sin errores en UI)
// ÚLTIMO RECURSO: Coordenadas default CABA + búsqueda local en CRM
//
// Bajo ninguna circunstancia se devuelve un error bloqueante al frontend.
// Si Google falla, se intenta Nominatim. Si Nominatim falla, se devuelven
// resultados vacíos con un mensaje amigable (sin banner rojo).

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

// === Coordenadas default: centro de CABA (Obelisco) ===
const DEFAULT_CABA_COORDS = { lat: -34.6037, lng: -58.3816 };

// ============================================================================
// GEOCODING
// ============================================================================

async function geocodeWithGoogle(location: string, apiKey: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}&language=es&region=ar`;
    const res = await fetch(url);
    if (!res.ok) { console.error("[Radar] Google Geocoding HTTP error:", res.status); return null; }
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) {
      console.error("[Radar] Google Geocoding status:", data.status, data.error_message || "");
      return null;
    }
    return {
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
      address: data.results[0].formatted_address,
    };
  } catch (err) {
    console.error("[Radar] Google Geocoding exception:", err);
    return null;
  }
}

async function geocodeWithNominatim(location: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const searchQuery = location.toLowerCase().includes("argentina") ? location : `${location}, Argentina`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&addressdetails=1&countrycodes=ar`;
    const res = await fetch(url, {
      headers: { "User-Agent": "REP-LeadFinder/1.0 (contacto@redescuchapsicologica.com)", "Accept-Language": "es" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), address: data[0].display_name || location };
  } catch {
    return null;
  }
}

// ============================================================================
// PLACES SEARCH — Google Places API (MOTOR PRINCIPAL)
// ============================================================================

// Estrategia 1: Google Text Search
async function searchPlacesWithGoogleTextSearch(query: string, lat: number, lng: number, radiusMeters: number, apiKey: string): Promise<PlaceResult[]> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&location=${lat},${lng}&radius=${radiusMeters}&key=${apiKey}&language=es&region=ar`;
    const res = await fetch(url);
    if (!res.ok) { console.error("[Radar] Google TextSearch HTTP error:", res.status); return []; }
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Radar] Google TextSearch status:", data.status, data.error_message || "");
      return [];
    }
    return (data.results || []).slice(0, 20).map((p: {
      place_id: string; name: string; formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      rating?: number; user_ratings_total?: number;
    }) => ({
      place_id: p.place_id, name: p.name, formatted_address: p.formatted_address,
      geometry: p.geometry, rating: p.rating, user_ratings_total: p.user_ratings_total,
    }));
  } catch (err) {
    console.error("[Radar] Google TextSearch exception:", err);
    return [];
  }
}

// Estrategia 2: Google Nearby Search (usa type en vez de query)
async function searchPlacesWithGoogleNearby(lat: number, lng: number, radiusMeters: number, apiKey: string): Promise<PlaceResult[]> {
  try {
    // Buscar lugares tipo "health" (salud) cerca de las coordenadas
    // Esto encuentra consultorios, clínicas, centros de salud mental, etc.
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=health&keyword=psicologo&key=${apiKey}&language=es`;
    const res = await fetch(url);
    if (!res.ok) { console.error("[Radar] Google Nearby HTTP error:", res.status); return []; }
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Radar] Google Nearby status:", data.status, data.error_message || "");
      return [];
    }
    return (data.results || []).slice(0, 20).map((p: {
      place_id: string; name: string; vicinity: string;
      geometry: { location: { lat: number; lng: number } };
      rating?: number; user_ratings_total?: number;
    }) => ({
      place_id: p.place_id, name: p.name, formatted_address: p.vicinity || "",
      geometry: p.geometry, rating: p.rating, user_ratings_total: p.user_ratings_total,
    }));
  } catch (err) {
    console.error("[Radar] Google Nearby exception:", err);
    return [];
  }
}

// ============================================================================
// PLACES SEARCH — Nominatim (FALLBACK SILENCIOSO)
// ============================================================================

async function searchPlacesWithNominatim(query: string, lat: number, lng: number, radiusMeters: number): Promise<PlaceResult[]> {
  try {
    const radiusKm = radiusMeters / 1000;
    const searchVariations = [query, "psicologo", "consultorio psicologico", "centro de salud mental"];
    const allResults: PlaceResult[] = [];
    const seenIds = new Set<string>();

    for (const sq of searchVariations) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(sq)}&format=json&limit=20&addressdetails=1&countrycodes=ar`;
        const res = await fetch(url, {
          headers: { "User-Agent": "REP-LeadFinder/1.0 (contacto@redescuchapsicologica.com)", "Accept-Language": "es" },
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (!Array.isArray(data)) continue;

        for (const item of data) {
          const pid = `osm_${item.place_id}`;
          if (seenIds.has(pid)) continue;
          const iLat = parseFloat(item.lat);
          const iLng = parseFloat(item.lon);
          if (isNaN(iLat) || isNaN(iLng)) continue;
          if (haversineDistance(lat, lng, iLat, iLng) > radiusKm) continue;
          seenIds.add(pid);
          allResults.push({
            place_id: pid,
            name: item.display_name?.split(",")[0] || "Sin nombre",
            formatted_address: item.display_name || "",
            geometry: { location: { lat: iLat, lng: iLng } },
          });
        }
      } catch { /* silencioso */ }
    }
    return allResults.slice(0, 20);
  } catch {
    return [];
  }
}

// ============================================================================
// HELPER: Haversine
// ============================================================================
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================================
// MAIN: POST handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const body = await request.json();
    const { query, location, radiusKm, preGeocoded } = body;

    if (!query || !location) {
      return NextResponse.json({ error: "query y location son obligatorios" }, { status: 400 });
    }

    const radiusMeters = Math.min(Math.max(Number(radiusKm) || 10, 1), 50) * 1000;

    // === 1. GEOCODING ===
    let lat: number;
    let lng: number;
    let geocodedAddress: string;
    let geocodeSource: string;

    if (preGeocoded && typeof preGeocoded.lat === "number" && typeof preGeocoded.lng === "number") {
      lat = preGeocoded.lat;
      lng = preGeocoded.lng;
      geocodedAddress = preGeocoded.address || location;
      geocodeSource = "pre-geocoded";
    } else if (apiKey) {
      const gResult = await geocodeWithGoogle(location, apiKey);
      if (gResult) {
        lat = gResult.lat; lng = gResult.lng;
        geocodedAddress = gResult.address; geocodeSource = "google";
      } else {
        const nResult = await geocodeWithNominatim(location);
        if (nResult) {
          lat = nResult.lat; lng = nResult.lng;
          geocodedAddress = nResult.address; geocodeSource = "nominatim";
        } else {
          lat = DEFAULT_CABA_COORDS.lat; lng = DEFAULT_CABA_COORDS.lng;
          geocodedAddress = "CABA (default)"; geocodeSource = "default-caba";
        }
      }
    } else {
      const nResult = await geocodeWithNominatim(location);
      if (nResult) {
        lat = nResult.lat; lng = nResult.lng;
        geocodedAddress = nResult.address; geocodeSource = "nominatim";
      } else {
        lat = DEFAULT_CABA_COORDS.lat; lng = DEFAULT_CABA_COORDS.lng;
        geocodedAddress = "CABA (default)"; geocodeSource = "default-caba";
      }
    }

    // === 2. PLACES SEARCH — Google como motor principal ===
    let places: PlaceResult[] = [];
    const seenPlaceIds = new Set<string>();

    if (apiKey) {
      // Estrategia 1: Google Text Search (busca por texto: "psicologos")
      console.log("[Radar] Intentando Google Text Search...");
      const textResults = await searchPlacesWithGoogleTextSearch(query, lat, lng, radiusMeters, apiKey);
      for (const p of textResults) {
        if (!seenPlaceIds.has(p.place_id)) { seenPlaceIds.add(p.place_id); places.push(p); }
      }
      console.log(`[Radar] Text Search: ${textResults.length} resultados`);

      // Estrategia 2: Google Nearby Search (busca tipo "health" + keyword "psicologo")
      if (places.length < 10) {
        console.log("[Radar] Intentando Google Nearby Search...");
        const nearbyResults = await searchPlacesWithGoogleNearby(lat, lng, radiusMeters, apiKey);
        for (const p of nearbyResults) {
          if (!seenPlaceIds.has(p.place_id)) { seenPlaceIds.add(p.place_id); places.push(p); }
        }
        console.log(`[Radar] Nearby Search: ${nearbyResults.length} resultados adicionales`);
      }
    }

    // === FALLBACK SILENCIOSO: Nominatim (solo si Google no devolvió nada) ===
    if (places.length === 0) {
      console.log("[Radar] Google sin resultados. Fallback a Nominatim...");
      places = await searchPlacesWithNominatim(query, lat, lng, radiusMeters);
      console.log(`[Radar] Nominatim: ${places.length} resultados`);
    }

    // === Si no hay resultados, devolver array vacío sin error ===
    if (places.length === 0) {
      return NextResponse.json({
        results: [],
        geocoded: { lat, lng, address: geocodedAddress, source: geocodeSource },
        count: 0,
        message: "No se encontraron consultorios en el radio seleccionado. Probá ampliando a 20km o 30km.",
      });
    }

    // === 3. PLACE DETAILS (solo Google) ===
    if (apiKey) {
      const detailPromises = places.map(async (place) => {
        try {
          if (!place.place_id.startsWith("osm_")) {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,international_phone_number&key=${apiKey}&language=es`;
            const detailRes = await fetch(detailsUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.status === "OK" && detailData.result) {
                place.formatted_phone_number = detailData.result.formatted_phone_number || detailData.result.international_phone_number;
                place.website = detailData.result.website;
              }
            }
          }
        } catch { /* silencioso */ }
        return place;
      });
      places = await Promise.all(detailPromises);
    }

    // === 4. CRUZAR CON CRM ===
    const placeIds = places.map((p) => p.place_id);
    const existingProspects = await db.professionalProspect.findMany({
      where: { placeId: { in: placeIds } },
      select: { id: true, placeId: true, status: true },
    });
    const crmMap = new Map(existingProspects.map((p) => [p.placeId, { id: p.id, status: p.status }]));
    places.forEach((place) => {
      const crmEntry = crmMap.get(place.place_id);
      if (crmEntry) {
        place.inCrm = true; place.crmStatus = crmEntry.status; place.crmId = crmEntry.id;
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
    console.error("[Radar] Error interno:", error);
    // NUNCA devolver error 500 al frontend — devolver array vacío con mensaje
    return NextResponse.json({
      results: [],
      count: 0,
      message: "No se pudo completar la búsqueda en este momento. Intentá de nuevo.",
    });
  }
}
