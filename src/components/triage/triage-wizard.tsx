"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Heart,
  Users,
  Baby,
  Sparkles,
  HelpCircle,
  MapPin,
  Video,
  Monitor,
  Search,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MessageCircle,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_ZONES, toSlug } from "@/lib/seo-helpers";

// ============================================================================
// TriageWizard — Buscador interactivo de profesionales en 3 pasos
// ============================================================================

interface TriageResult {
  id: string;
  name: string;
  title?: string;
  specialty: string;
  bio?: string;
  onlineAttention: boolean;
  presentialAttention: boolean;
  homeAttention: boolean;
  zones: string[];
  phone?: string;
}

const MOTIVOS = [
  { id: "ansiedad", label: "Ansiedad / Ataques de Pánico", icon: Brain, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { id: "depresion", label: "Depresión / Estado de Ánimo", icon: Heart, color: "text-rose-600 bg-rose-50 border-rose-200" },
  { id: "pareja", label: "Terapia de Pareja / Familia", icon: Users, color: "text-teal-600 bg-teal-50 border-teal-200" },
  { id: "infancias", label: "Infancias / Adolescentes", icon: Baby, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { id: "autoestima", label: "Autoestima / Desarrollo Personal", icon: Sparkles, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { id: "otros", label: "Otro motivo", icon: HelpCircle, color: "text-slate-600 bg-slate-50 border-slate-200" },
];

// Mapeo de IDs de motivo a texto buscable en specialty/therapyTypes
const MOTIVO_SEARCH: Record<string, string[]> = {
  ansiedad: ["ansiedad", "ataques de pánico", "pánico"],
  depresion: ["depresión", "estado de ánimo", "duelo"],
  pareja: ["pareja", "familia", "vínculos", "vincular"],
  infancias: ["infanto", "niño", "adolescent", "infantil", "temprana"],
  autoestima: ["autoestima", "desarrollo", "personal"],
  otros: [],
};

const MODALIDADES = [
  { id: "P", label: "Presencial", icon: MapPin, color: "text-teal-600 bg-teal-50 border-teal-200" },
  { id: "OL", label: "Online", icon: Video, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { id: "ambas", label: "Indistinto", icon: Monitor, color: "text-purple-600 bg-purple-50 border-purple-200" },
];

// === Sanitizar nombre del profesional: evitar "Lic. Lic. Nombre" ===
// Si el name ya incluye el título (Lic., Dr., Dra., etc.), no anteponerlo.
function formatDisplayName(title: string | undefined, name: string): string {
  if (!title || title === "Ninguno") return name;
  const nameLower = name.toLowerCase().trim();
  const titleLower = title.toLowerCase().trim();
  // Si el nombre ya empieza con el título, no duplicar
  if (nameLower.startsWith(titleLower) ||
      (titleLower === "lic." && (nameLower.startsWith("lic ") || nameLower.startsWith("lic."))) ||
      (titleLower === "dr." && (nameLower.startsWith("dr ") || nameLower.startsWith("dr."))) ||
      (titleLower === "dra." && (nameLower.startsWith("dra ") || nameLower.startsWith("dra.")))) {
    return name;
  }
  return `${title} ${name}`;
}

export function TriageWizard() {
  const [step, setStep] = useState(0); // 0=motivo, 1=modalidad, 2=zona, 3=resultados
  const [motivo, setMotivo] = useState<string | null>(null);
  const [modalidad, setModalidad] = useState<string | null>(null);
  const [zonaQuery, setZonaQuery] = useState("");
  const [zonaSelected, setZonaSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TriageResult[]>([]);
  const [fallbackMode, setFallbackMode] = useState(false);

  const showZonaStep = modalidad === "P" || modalidad === "ambas";

  // === Filtro de zonas con normalización (insensible a mayúsculas/acentos/espacios) ===
  const normalizeText = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const filteredZonas = zonaQuery.length >= 2
    ? ALL_ZONES.filter((z) => normalizeText(z).includes(normalizeText(zonaQuery))).slice(0, 8)
    : [];

  const handleSearch = async () => {
    setLoading(true);
    setStep(3);
    setFallbackMode(false);
    try {
      let url = "/api/public/professionals";
      const params: string[] = [];
      if (zonaSelected) params.push(`zona=${toSlug(zonaSelected)}`);
      if (params.length > 0) url += "?" + params.join("&");

      const res = await fetch(url);
      const data = await res.json();
      let profs: TriageResult[] = data.professionals || [];

      // === ORDEN DE FILTROS CORRECTO ===
      // 1. ZONA primero (con normalización robusta)
      // 2. MOTIVO después (sobre los que ya pasaron el filtro de zona)
      // 3. MODALIDAD al final
      // Esto evita que el filtro por motivo elimine profesionales que
      // sí atienden en la zona seleccionada pero no tienen el motivo en
      // su campo specialty (porque su specialty es "Psicología Clínica").

      // === 1. Filtrar por zona seleccionada (con normalización) ===
      if (zonaSelected) {
        const zonaNorm = normalizeText(zonaSelected);
        const zoneFiltered = profs.filter((p) => {
          const zones = (p.zones || []);
          return zones.some((z) => {
            const zNorm = normalizeText(z);
            return zNorm.includes(zonaNorm) || zonaNorm.includes(zNorm);
          });
        });

        if (zoneFiltered.length > 0) {
          // Hay matches exactos de zona → usarlos, NO activar fallback
          profs = zoneFiltered;
        } else {
          // No hay matches exactos de zona → activar fallback Online
          setFallbackMode(true);
          // Recargar la lista completa (sin filtro de zona) para priorizar online
          const allRes = await fetch("/api/public/professionals");
          const allData = await allRes.json();
          profs = (allData.professionals || []).filter((p) => p.onlineAttention);
          if (profs.length === 0) {
            profs = allData.professionals || [];
          }
        }
      }

      // === 2. Filtrar por motivo en JS (sobre los que ya pasaron zona) ===
      if (motivo && MOTIVO_SEARCH[motivo]?.length > 0) {
        const searchTerms = MOTIVO_SEARCH[motivo].map((t) => normalizeText(t));
        profs = profs.filter((p) => {
          const specialtyNorm = normalizeText(p.specialty || "");
          const zonesNorm = normalizeText((p.zones || []).join(" "));
          const bioNorm = normalizeText(p.bio || "");
          return searchTerms.some((term) =>
            specialtyNorm.includes(term) ||
            zonesNorm.includes(term) ||
            bioNorm.includes(term)
          );
        });
        // Si el filtro por motivo eliminó a todos, no mostrar lista vacía:
        // el usuario ya pasó la barrera de zona, así que mostramos todos los
        // de la zona (sin filtrar por motivo) para que tenga opciones.
        if (profs.length === 0 && !fallbackMode) {
          // Re-hacer fetch solo de zona (sin filtro motivo)
          let zoneUrl = "/api/public/professionals";
          if (zonaSelected) zoneUrl += `?zona=${toSlug(zonaSelected)}`;
          const zoneRes = await fetch(zoneUrl);
          const zoneData = await zoneRes.json();
          profs = zoneData.professionals || [];
        }
      }

      // === 3. Filtrar por modalidad ===
      if (modalidad === "OL") {
        profs = profs.filter((p) => p.onlineAttention);
      } else if (modalidad === "P") {
        // Si es presencial y no hay fallback, filtrar por presentialAttention
        if (!fallbackMode) {
          profs = profs.filter((p) => p.presentialAttention);
        }
      }

      // === Fallback final: si después de todo no hay resultados ===
      if (profs.length === 0) {
        setFallbackMode(true);
        const allRes = await fetch("/api/public/professionals");
        const allData = await allRes.json();
        profs = (allData.professionals || []).filter((p) => p.onlineAttention);
        if (profs.length === 0) {
          profs = allData.professionals || [];
        }
      }

      // Tomar los primeros 6
      setResults(profs.slice(0, 6));
    } catch (err) {
      console.error("[TriageWizard] Error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setMotivo(null);
    setModalidad(null);
    setZonaQuery("");
    setZonaSelected(null);
    setResults([]);
    setFallbackMode(false);
  };

  const canProceed = () => {
    if (step === 0) return motivo !== null;
    if (step === 1) return modalidad !== null;
    if (step === 2) return true; // zona es opcional
    return false;
  };

  const handleNext = () => {
    if (step === 1 && !showZonaStep) {
      handleSearch();
    } else if (step === 2) {
      handleSearch();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(showZonaStep ? 2 : 1);
      setResults([]);
    } else {
      setStep(step - 1);
    }
  };

  const steps = showZonaStep ? ["Motivo", "Modalidad", "Zona", "Resultados"] : ["Motivo", "Modalidad", "Resultados"];
  const currentStepIndex = step;

  return (
    <div className="bg-gradient-to-br from-teal-50 to-sage-50 rounded-2xl p-6 sm:p-8 shadow-lg border border-teal-100">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-teal-900 mb-1">Encontrá tu profesional ideal</h2>
        <p className="text-teal-600 text-sm">Respondé 3 preguntas y te recomendamos los mejores profesionales para vos</p>
      </div>

      {/* Progress bar */}
      {step < 3 && (
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < currentStepIndex ? "bg-teal-600 text-white" :
                i === currentStepIndex ? "bg-teal-600 text-white ring-4 ring-teal-200" :
                "bg-teal-100 text-teal-400"
              }`}>
                {i < currentStepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 ${i < currentStepIndex ? "bg-teal-600" : "bg-teal-100"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Steps content */}
      <AnimatePresence mode="wait">
        {/* STEP 0: Motivo */}
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-teal-900 text-center">¿Cuál es el motivo principal de tu consulta?</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MOTIVOS.map((m) => {
                const Icon = m.icon;
                const selected = motivo === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMotivo(m.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      selected ? `${m.color} ring-2 ring-offset-2 ring-teal-300 scale-105` : "bg-white border-teal-100 hover:border-teal-300 hover:scale-105"
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-2 ${selected ? "" : "text-teal-400"}`} />
                    <span className="text-xs sm:text-sm font-medium text-teal-800">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* STEP 1: Modalidad */}
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-teal-900 text-center">¿Cómo preferís realizar tus sesiones?</h3>
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              {MODALIDADES.map((m) => {
                const Icon = m.icon;
                const selected = modalidad === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setModalidad(m.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      selected ? `${m.color} ring-2 ring-offset-2 ring-teal-300 scale-105` : "bg-white border-teal-100 hover:border-teal-300 hover:scale-105"
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-2 ${selected ? "" : "text-teal-400"}`} />
                    <span className="text-sm font-medium text-teal-800">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* STEP 2: Zona */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-teal-900 text-center">¿En qué zona buscás atención?</h3>
            <p className="text-teal-500 text-sm text-center">Escribí tu zona o barrio (opcional — podés saltar este paso)</p>
            <div className="max-w-md mx-auto relative">
              <Input
                type="text"
                value={zonaQuery}
                onChange={(e) => { setZonaQuery(e.target.value); setZonaSelected(null); }}
                placeholder="Ej: Merlo, Caballito, Palermo..."
                className="border-teal-200 bg-white text-center"
              />
              {filteredZonas.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-teal-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredZonas.map((z) => (
                    <button
                      key={z}
                      onClick={() => { setZonaSelected(z); setZonaQuery(z); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 text-teal-700"
                    >
                      <MapPin className="w-3 h-3 inline mr-1 text-teal-400" />{z}
                    </button>
                  ))}
                </div>
              )}
              {zonaSelected && (
                <div className="mt-2 text-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm">
                    <MapPin className="w-3 h-3" /> {zonaSelected}
                    <button onClick={() => { setZonaSelected(null); setZonaQuery(""); }} className="ml-1 text-teal-400 hover:text-teal-600">✕</button>
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* STEP 3: Resultados */}
        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
                <p className="text-teal-600">Buscando los mejores profesionales para vos...</p>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-teal-900">
                    {fallbackMode && zonaSelected
                      ? "No encontramos profesionales presenciales en " + zonaSelected
                      : `Encontramos ${results.length} ${results.length === 1 ? "profesional" : "profesionales"} para vos`}
                  </h3>
                  {fallbackMode && zonaSelected ? (
                    <p className="text-teal-500 text-sm mt-1">
                      Te recomendamos estos especialistas con atención <strong>Online</strong>
                    </p>
                  ) : (
                    <p className="text-teal-500 text-sm">Estos son los que mejor se adaptan a tu búsqueda</p>
                  )}
                </div>
                {fallbackMode && zonaSelected && (
                  <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      No hay profesionales con atención presencial en <strong>{zonaSelected}</strong>.
                      Mostramos especialistas disponibles para sesiones <strong>Online</strong> desde cualquier ubicación.
                    </p>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((prof) => {
                    return (
                      <div key={prof.id} className="bg-white rounded-xl border border-teal-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-teal-600 font-bold">{prof.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-teal-900 text-sm leading-tight">{formatDisplayName(prof.title, prof.name)}</h4>
                            <p className="text-xs text-teal-600">{prof.specialty}</p>
                          </div>
                        </div>
                        {prof.bio && (
                          <p className="text-xs text-teal-700 mb-3 line-clamp-2">{prof.bio}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {prof.onlineAttention && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md">
                              <Video className="w-3 h-3" /> Online
                            </span>
                          )}
                          {prof.presentialAttention && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-md">
                              <MapPin className="w-3 h-3" /> Presencial
                            </span>
                          )}
                          {prof.zones.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md">
                              <MapPin className="w-3 h-3" /> {prof.zones[0]}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <a
                            href="/#contacto"
                            className="flex-1 text-center text-xs font-medium px-3 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                          >
                            <Calendar className="w-3.5 h-3.5 inline mr-1" /> Reservar Turno
                          </a>
                          {/* === WhatsApp Central de REP (no del profesional) === */}
                          <a
                            href={`https://wa.me/541168667898?text=${encodeURIComponent(`Hola, estuve usando el buscador de REP y quiero consultar por un turno con ${prof.name}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-3 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg transition-colors"
                            title="Consultar por WhatsApp a la coordinación de REP"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-teal-600 mb-4">No encontramos profesionales con esos criterios exactos.</p>
                <Button onClick={handleReset} variant="outline" className="border-teal-200 text-teal-600">
                  Probar con otros criterios
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation buttons */}
      {step < 3 && (
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <Button variant="ghost" onClick={handleBack} className="text-teal-500 hover:text-teal-700">
              <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
            </Button>
          ) : (
            <div />
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40"
          >
            {step === 1 && !showZonaStep ? (
              <><Search className="w-4 h-4 mr-1" /> Buscar</>
            ) : step === 2 ? (
              <><Search className="w-4 h-4 mr-1" /> {zonaSelected ? "Buscar" : "Saltar y buscar"}</>
            ) : (
              <>Siguiente <ArrowRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </div>
      )}

      {/* Reset button when showing results */}
      {step === 3 && !loading && (
        <div className="text-center mt-6">
          <Button onClick={handleReset} variant="outline" className="border-teal-200 text-teal-600 hover:bg-teal-50">
            <Search className="w-4 h-4 mr-1" /> Nueva búsqueda
          </Button>
        </div>
      )}
    </div>
  );
}
