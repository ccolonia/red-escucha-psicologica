import { Metadata } from "next";
import { db } from "@/lib/db";
import { fromSlug, toSlug, ALL_ZONES, INDEXABLE_SPECIALTIES } from "@/lib/seo-helpers";
import { ProfessionalSeoCard } from "@/components/professional-seo-card";
import { generateJsonLd } from "@/lib/seo-jsonld";

const BASE_URL = "https://www.redescuchapsicologica.com";

// === generateStaticParams: pre-generar páginas para todas las zonas ===
export async function generateStaticParams() {
  return ALL_ZONES.map((zona) => ({
    zona: toSlug(zona),
  }));
}

// === generateMetadata: SEO dinámico por zona ===
export async function generateMetadata({
  params,
}: {
  params: Promise<{ zona: string }>;
}): Promise<Metadata> {
  const { zona } = await params;
  const zonaName = fromSlug(zona);

  const title = `Psicólogos en ${zonaName} — Red Escucha Psicológica`;
  const description = `Encontrá psicólogos matriculados en ${zonaName}. Atención presencial y online. Turnos disponibles. Consultá ahora con Red Escucha Psicológica.`;
  const canonical = `${BASE_URL}/psicologos/${zona}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Red Escucha Psicológica",
      type: "website",
      images: [{ url: `${BASE_URL}/images/logo.png`, width: 400, height: 138, alt: "Red Escucha Psicológica" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/images/logo.png`],
    },
  };
}

export default async function PsicologosPorZonaPage({
  params,
}: {
  params: Promise<{ zona: string }>;
}) {
  const { zona } = await params;
  const zonaName = fromSlug(zona);

  // Consultar profesionales activos en esta zona
  const professionals = await db.professional.findMany({
    where: {
      active: true,
      available: true,
      user: { active: true, isApproved: true },
      zones: { contains: zonaName, mode: "insensitive" },
    },
    select: {
      id: true,
      specialty: true,
      title: true,
      profession: true,
      bio: true,
      onlineAttention: true,
      presentialAttention: true,
      homeAttention: true,
      zones: true,
      officeAddress: true,
      addresses: { select: { id: true, label: true, address: true, isActive: true } },
      user: { select: { name: true, phone: true } },
    },
    take: 50,
    orderBy: { user: { name: "asc" } },
  });

  // Si no hay profesionales en la zona, buscar profesionales con atención online
  const hasResults = professionals.length > 0;
  let onlineProfessionals: typeof professionals = [];
  if (!hasResults) {
    onlineProfessionals = await db.professional.findMany({
      where: {
        active: true,
        available: true,
        user: { active: true, isApproved: true },
        onlineAttention: true,
      },
      select: {
        id: true,
        specialty: true,
        title: true,
        profession: true,
        bio: true,
        onlineAttention: true,
        presentialAttention: true,
        homeAttention: true,
        zones: true,
        officeAddress: true,
        addresses: { select: { id: true, label: true, address: true, isActive: true } },
        user: { select: { name: true, phone: true } },
      },
      take: 10,
      orderBy: { user: { name: "asc" } },
    });
  }

  // Generar JSON-LD para Schema.org
  const jsonLd = generateJsonLd(
    professionals.length > 0 ? professionals : onlineProfessionals,
    zonaName,
    null
  );

  return (
    <div className="min-h-screen bg-beige-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-900 text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Psicólogos en {zonaName}
          </h1>
          <p className="text-teal-100 text-lg">
            Profesionales matriculados disponibles para atención presencial y online en {zonaName}.
          </p>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-5xl mx-auto py-8 px-4">
        {hasResults ? (
          <>
            <p className="text-teal-700 mb-6">
              {professionals.length} {professionals.length === 1 ? "profesional encontrado" : "profesionales encontrados"} en {zonaName}
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {professionals.map((prof) => (
                <ProfessionalSeoCard
                  key={prof.id}
                  name={prof.user.name}
                  title={prof.title}
                  profession={prof.profession}
                  specialty={prof.specialty}
                  bio={prof.bio}
                  onlineAttention={prof.onlineAttention}
                  presentialAttention={prof.presentialAttention}
                  homeAttention={prof.homeAttention}
                  phone={prof.user.phone}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-teal-600 text-lg mb-2">
              No hay profesionales con atención presencial en {zonaName} en este momento.
            </p>
            <p className="text-teal-500 mb-6">
              Pero tenemos {onlineProfessionals.length} profesionales disponibles para atención Online.
            </p>
            {onlineProfessionals.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
                {onlineProfessionals.map((prof) => (
                  <ProfessionalSeoCard
                    key={prof.id}
                    name={prof.user.name}
                    title={prof.title}
                    profession={prof.profession}
                    specialty={prof.specialty}
                    bio={prof.bio}
                    onlineAttention={prof.onlineAttention}
                    presentialAttention={prof.presentialAttention}
                    homeAttention={prof.homeAttention}
                    phone={prof.user.phone}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Links a especialidades en esta zona */}
        <div className="mt-12 pt-8 border-t border-teal-100">
          <h2 className="text-teal-900 font-semibold mb-3">Buscar por especialidad en {zonaName}</h2>
          <div className="flex flex-wrap gap-2">
            {INDEXABLE_SPECIALTIES.slice(0, 12).map((esp) => (
              <a
                key={esp}
                href={`/psicologos/${zona}/${toSlug(esp)}`}
                className="inline-block px-3 py-1.5 text-sm bg-teal-50 border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors"
              >
                {esp}
              </a>
            ))}
          </div>
        </div>

        {/* Link a home */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-block text-teal-600 hover:text-teal-800 font-medium"
          >
            ← Ver todos los profesionales
          </a>
        </div>
      </div>
    </div>
  );
}
