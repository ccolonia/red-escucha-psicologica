"use client";

import { useEffect, useState } from "react";
import { ProfessionalSeoCard } from "@/components/professional-seo-card";
import { toSlug } from "@/lib/seo-helpers";
import { SPECIALTIES } from "@/lib/professional-categories";

interface SeoProfessional {
  id: string;
  name: string;
  title?: string;
  profession?: string;
  specialty: string;
  bio?: string;
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  phone?: string;
}

export default function PsicologosPorZonaClient({ zona, zonaName, especialidad }: { zona: string; zonaName: string; especialidad?: string }) {
  const [professionals, setProfessionals] = useState<SeoProfessional[]>([]);
  const [onlineProfessionals, setOnlineProfessionals] = useState<SeoProfessional[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let url = `/api/public/professionals?zona=${zona}`;
    if (especialidad) url += `&especialidad=${especialidad}`;
    fetch(url)
      .then((r) => r.json())
      .then(async (data) => {
        if (data.professionals && data.professionals.length > 0) {
          // Hay profesionales presenciales en la zona → mostrarlos
          setProfessionals(data.professionals);
        } else {
          // No hay en la zona → cargar profesionales online como fallback
          try {
            const allRes = await fetch("/api/public/professionals");
            const allData = await allRes.json();
            const online = (allData.professionals || []).filter(
              (p: { onlineAttention?: boolean }) => p.onlineAttention === true
            );
            setOnlineProfessionals(online);
          } catch {
            setOnlineProfessionals([]);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [zona, especialidad]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <div className="text-teal-500 text-center">Cargando profesionales...</div>
      </div>
    );
  }

  const hasResults = professionals.length > 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {hasResults ? (
        <>
          <p className="text-teal-700 mb-6">
            {professionals.length} {professionals.length === 1 ? "profesional encontrado" : "profesionales encontrados"} en {zonaName}
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {professionals.map((prof) => (
              <ProfessionalSeoCard key={prof.id} {...prof} />
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
                <ProfessionalSeoCard key={prof.id} {...prof} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-teal-100">
        <h2 className="text-teal-900 font-semibold mb-3">Buscar por especialidad en {zonaName}</h2>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.slice(0, 12).map((esp) => (
            <a key={esp} href={`/psicologos/${zona}/${toSlug(esp)}`}
              className="inline-block px-3 py-1.5 text-sm bg-teal-50 border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors">
              {esp}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center">
        <a href="/" className="inline-block text-teal-600 hover:text-teal-800 font-medium">
          ← Ver todos los profesionales
        </a>
      </div>
    </div>
  );
}
