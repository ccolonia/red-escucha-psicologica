import { Metadata } from "next";
import { fromSlug } from "@/lib/seo-helpers";
import PsicologosPorZonaClient from "../PsicologosPorZonaClient";

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

  return (
    <div className="min-h-screen bg-beige-50">
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
      <PsicologosPorZonaClient zona={zona} zonaName={`${zonaName} — ${especialidadName}`} especialidad={especialidad} />
    </div>
  );
}
