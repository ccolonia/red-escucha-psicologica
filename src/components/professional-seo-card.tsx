"use client";

import { MapPin, Video, Home, MessageCircle } from "lucide-react";

interface ProfessionalSeoCardProps {
  name: string;
  title?: string | null;
  profession?: string | null;
  specialty: string;
  bio?: string | null;
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  phone?: string | null;
}

export function ProfessionalSeoCard({
  name,
  title,
  profession,
  specialty,
  bio,
  onlineAttention,
  presentialAttention,
  homeAttention,
  phone,
}: ProfessionalSeoCardProps) {
  const displayName = title ? `${title} ${name}` : name;
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${name}, te contacto desde Red Escucha Psicológica`)}` : "";

  return (
    <div className="bg-white rounded-xl border border-teal-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
          <span className="text-teal-600 font-bold text-lg">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-teal-900 text-base leading-tight">
            {displayName}
          </h2>
          <p className="text-sm text-teal-600">{specialty}</p>
          {profession && (
            <p className="text-xs text-teal-400">{profession}</p>
          )}
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-sm text-teal-700 mb-3 line-clamp-3">
          {bio}
        </p>
      )}

      {/* Modalidades */}
      <div className="flex flex-wrap gap-2 mb-3">
        {onlineAttention && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-md">
            <Video className="w-3 h-3" /> Online
          </span>
        )}
        {presentialAttention && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-md">
            <MapPin className="w-3 h-3" /> Presencial
          </span>
        )}
        {homeAttention && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-md">
            <Home className="w-3 h-3" /> Domicilio
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="flex gap-2">
        <a
          href="/#contacto"
          className="flex-1 text-center text-sm font-medium px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
        >
          Solicitar Turno
        </a>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-3 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg transition-colors"
            title={`Contactar por WhatsApp a ${name}`}
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
