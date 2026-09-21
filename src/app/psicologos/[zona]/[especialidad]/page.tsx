import { Metadata } from "next";
import { db } from "@/lib/db";
import { fromSlug } from "@/lib/seo-helpers";
import { ProfessionalSeoCard } from "@/components/professional-seo-card";
import { generateJsonLd } from "@/lib/seo-jsonld";

const BASE_URL = "https://www.redescuchapsicologica.com";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ zona: string; especialidad: string }>;
}): Promise<Metadata> {
  const { zona, especialidad } = await params;
  const zonaName = fromSlug(zona);
  const especialidadName = fromSlug(especialidad);

  const title = `Psicólogos en ${zonaName} | ${especialidadName} — Red Escucha Psicológica`;
  const description = `Encontrá psicólogos matriculados en ${zonaName} especialistas en ${especialidadName}. Turnos disponibles, modalidad presencial y online. Consultá ahora.`;
  const canonical = `${BASE_URL}/psicologos/${zona}/${especialidad}`;

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
  };
}

export default async function PsicologosPorZonaYEspecialidadPage({
  params,
}: {
  params: Promise<{ zona: string; especialidad: string }>;
}) {
  const { zona, especialidad } = await params;
  const zonaName = fromSlug(zona);
  const especialidadName = fromSlug(especialidad);

  const professionals = await db.professional.findMany({
    where: {
      active: true,
      available: true,
      user: { active: true, isApproved: true },
      zones: { contains: zonaName, mode: "insensitive" },
      OR: [
        { specialty: { contains: especialidadName, mode: "insensitive" } },
        { therapyTypes: { contains: especialidadName, mode: "insensitive" } },
      ],
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

  const hasResults = professionals.length > 0;
  let fallbackProfessionals: typeof professionals = [];
  if (!hasResults) {
    fallbackProfessionals = await db.professional.findMany({
      where: {
        active: true,
        available: true,
        user: { active: true, isApproved: true },
        onlineAttention: true,
        OR: [
          { specialty: { contains: especialidadName, mode: "insensitive" } },
          { therapyTypes: { contains: especialidadName, mode: "insensitive" } },
        ],
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

  const jsonLd = generateJsonLd(
    professionals.length > 0 ? professionals : fallbackProfessionals,
    zonaName,
    especialidadName
  );

  return (
    <div className="min-h-screen bg-beige-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-gradient-to-br from-teal-700 to-teal-900 text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Psicólogos en {zonaName} — {especialidadName}
          </h1>
          <p className="text-teal-100 text-lg">
            Profesionales matriculados especializados en {especialidadName} con atención en {zonaName}.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto py-8 px-4">
        {hasResults ? (
          <>
            <p className="text-teal-700 mb-6">
              {professionals.length} {professionals.length === 1 ? "profesional encontrado" : "profesionales encontrados"} en {zonaName} especializados en {especialidadName}
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
              No hay profesionales de {especialidadName} con atención presencial en {zonaName}.
            </p>
            <p className="text-teal-500 mb-6">
              Pero tenemos {fallbackProfessionals.length} profesionales disponibles para atención Online.
            </p>
            {fallbackProfessionals.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
                {fallbackProfessionals.map((prof) => (
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

        <div className="mt-8 text-center">
          <a
            href={`/psicologos/${zona}`}
            className="inline-block text-teal-600 hover:text-teal-800 font-medium"
          >
            ← Ver todos los profesionales en {zonaName}
          </a>
        </div>
      </div>
    </div>
  );
}
