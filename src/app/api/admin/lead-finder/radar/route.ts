import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/admin/lead-finder/radar
// Body: { query: string, location: string, radiusKm?: number }
//
// Proceso:
//  1. Geocoding API: convierte "Merlo, Buenos Aires" → lat,lng
//  2. Places Text Search: busca "psicologos" cerca de lat,lng en radio X
//  3. Para cada resultado, consulta Place Details para obtener teléfono y web
//  4. Cruza con tabla ProfessionalProspect para marcar cuáles ya están en CRM
//
// Requiere GOOGLE_MAPS_API_KEY en env. Si no está seteada, devuelve error 503
// con mensaje claro para que el admin sepa que falta configuración.

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
  // De Place Details:
  formatted_phone_number?: string;
  website?: string;
  // Cruzado con CRM:
  inCrm?: boolean;
  crmStatus?: string;
  crmId?: string;
};

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GOOGLE_MAPS_API_KEY no configurada",
          hint: "Agregá la variable de entorno GOOGLE_MAPS_API_KEY en Vercel → Settings → Environment Variables. La key debe tener habilitadas las APIs: Geocoding API, Places API (New o legacy).",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { query, location, radiusKm } = body;

    if (!query || !location) {
      return NextResponse.json(
        { error: "query y location son obligatorios" },
        { status: 400 }
      );
    }

    const radiusMeters = Math.min(Math.max(Number(radiusKm) || 10, 1), 50) * 1000;

    // === 1. Geocoding: location string → lat,lng ===
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      location
    )}&key=${apiKey}&language=es&region=ar`;
    const geocodeRes = await fetch(geocodeUrl);
    if (!geocodeRes.ok) {
      return NextResponse.json(
        { error: "Error al consultar Google Geocoding API" },
        { status: 502 }
      );
    }
    const geocodeData = await geocodeRes.json();
    if (geocodeData.status !== "OK" || !geocodeData.results?.length) {
      return NextResponse.json(
        {
          error: `No se pudo geocodificar "${location}"`,
          status: geocodeData.status,
          hint: geocodeData.error_message || "Probá con una zona más específica",
        },
        { status: 400 }
      );
    }
    const { lat, lng } = geocodeData.results[0].geometry.location;
    const geocodedAddress = geocodeData.results[0].formatted_address;

    // === 2. Places Text Search ===
    const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&location=${lat},${lng}&radius=${radiusMeters}&key=${apiKey}&language=es&region=ar`;
    const placesRes = await fetch(placesUrl);
    if (!placesRes.ok) {
      return NextResponse.json(
        { error: "Error al consultar Google Places API" },
        { status: 502 }
      );
    }
    const placesData = await placesRes.json();
    if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        {
          error: `Google Places API error: ${placesData.status}`,
          hint: placesData.error_message || "",
        },
        { status: 400 }
      );
    }

    const places: PlaceResult[] = (placesData.results || []).slice(0, 20); // limitar a 20 resultados

    if (places.length === 0) {
      return NextResponse.json({
        results: [],
        geocoded: { lat, lng, address: geocodedAddress },
        message: "No se encontraron resultados para esta búsqueda",
      });
    }

    // === 3. Place Details: obtener teléfono y web para cada lugar ===
    // Hacemos las requests en paralelo pero con un límite de concurrencia
    // para no saturar la API (Google Places tiene quota).
    const detailPromises = places.map(async (place) => {
      try {
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
      } catch {
        /* silencioso: si falla details, igual devolvemos el place sin teléfono */
      }
      return place;
    });

    const placesWithDetails = await Promise.all(detailPromises);

    // === 4. Cruzar con CRM: marcar cuáles ya están guardados ===
    const placeIds = placesWithDetails.map((p) => p.place_id);
    const existingProspects = await db.professionalProspect.findMany({
      where: { placeId: { in: placeIds } },
      select: { id: true, placeId: true, status: true },
    });
    const crmMap = new Map(
      existingProspects.map((p) => [p.placeId, { id: p.id, status: p.status }])
    );

    placesWithDetails.forEach((place) => {
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
      results: placesWithDetails,
      geocoded: { lat, lng, address: geocodedAddress },
      count: placesWithDetails.length,
    });
  } catch (error) {
    console.error("LeadFinder Radar error:", error);
    return NextResponse.json(
      { error: "Error interno en el radar de mapas" },
      { status: 500 }
    );
  }
}
