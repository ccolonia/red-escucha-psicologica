import { Metadata } from "next";
import { fromSlug } from "@/lib/seo-helpers";
import PsicologosPorZonaClient from "./PsicologosPorZonaClient";

const BASE_URL = "https://www.redescuchapsicologica.com";

export const dynamic = "force-dynamic";

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

  return (
    <div className="min-h-screen bg-beige-50">
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
      <PsicologosPorZonaClient zona={zona} zonaName={zonaName} />
    </div>
  );
}
