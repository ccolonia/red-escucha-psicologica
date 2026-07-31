"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  MessageCircle,
  Copy,
  Check,
  ChevronDown,
  Zap,
  AlertCircle,
  Shield,
  DollarSign,
  Clock,
  MapPin,
  User,
  Heart,
  ArrowRight,
  Phone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// === Tipos ===
type QAItem = {
  label: string;
  paciente?: string;
  respuesta: string;
};

type Category = {
  id: string;
  title: string;
  icon: string;
  items: QAItem[];
};

// === Guía Oficial de Consultas y Respuestas ===
const CATEGORIES: Category[] = [
  {
    id: "recepcion",
    title: "Recepción y Saludo Inicial",
    icon: "👋",
    items: [
      {
        label: 'Cuando escriben "Hola"',
        paciente: "Hola.",
        respuesta: "¡Hola! 😊 Soy Mónica, de Red de Escucha Psicológica. ¿Cómo estás? ¿En qué puedo ayudarte?",
      },
    ],
  },
  {
    id: "turnos",
    title: "Solicitud de Turno y Modalidad",
    icon: "📅",
    items: [
      {
        label: "Cuando pide un turno",
        paciente: "Quiero sacar un turno.",
        respuesta: "¡Claro! Con gusto te ayudamos. 😊\n¿Preferís atención online o presencial?",
      },
      {
        label: "Si elige presencial",
        respuesta: "Perfecto. ¿En qué localidad o barrio te encontrás? Así puedo buscar el profesional más cercano.",
      },
      {
        label: "Si pregunta dónde atienden",
        paciente: "¿Dónde están?",
        respuesta: "Somos una red de profesionales de la salud mental. Brindamos atención presencial en distintos consultorios según la zona de cada paciente, además de atención online.\n¿En qué localidad o barrio te encontrás?",
      },
      {
        label: "Si pregunta si hay disponibilidad",
        paciente: "¿Tienen turnos?",
        respuesta: "Sí, contamos con disponibilidad. 😊\nDecime si preferís atención online o presencial y te ayudo a encontrar la mejor opción.",
      },
    ],
  },
  {
    id: "admission",
    title: "Indagación del Motivo / Admisión",
    icon: "🧠",
    items: [
      {
        label: "Si todavía no cuenta qué le sucede",
        respuesta: "Para recomendarte el profesional más adecuado, ¿podrías contarme brevemente qué te gustaría trabajar o qué te llevó a consultar?",
      },
      {
        label: 'Si responde "prefiero hablarlo con el profesional"',
        respuesta: "Por supuesto, no hay ningún problema. 😊\nCon esa información ya podemos avanzar. Solo necesito algunos datos para recomendarte el profesional más adecuado.",
      },
      {
        label: "Si consulta por un menor",
        respuesta: "Gracias por escribirnos.\n¿Cuántos años tiene el niño, niña o adolescente y qué situación los motivó a buscar acompañamiento psicológico?",
      },
    ],
  },
  {
    id: "honorarios",
    title: "Honorarios, Duración y Frecuencia",
    icon: "💰",
    items: [
      {
        label: "Si pregunta el precio",
        paciente: "¿Cuánto sale?",
        respuesta: "El valor de la sesión es de $35.000 y se realiza una vez por semana.",
      },
      {
        label: "Si pregunta cuánto dura la sesión",
        respuesta: "Las sesiones tienen una duración aproximada de 50 minutos.",
      },
      {
        label: "Si pregunta la frecuencia",
        respuesta: "Generalmente las sesiones son semanales, aunque la frecuencia siempre la define el profesional según cada caso.",
      },
    ],
  },
  {
    id: "gestion",
    title: "Gestión de Turnos y Búsqueda",
    icon: "🔍",
    items: [
      {
        label: "Si necesita un turno urgente",
        respuesta: "Entiendo. Voy a revisar qué profesionales tienen disponibilidad y enseguida te envío la mejor opción.",
      },
      {
        label: "Mientras buscás un profesional",
        respuesta: "Dame unos minutos, por favor. Voy a verificar la disponibilidad y enseguida te comparto la opción más conveniente para vos.",
      },
      {
        label: "Cuando encontraste un profesional",
        respuesta: "Ya encontré una opción para vos. 😊\nEl profesional atiende en [Zona], tiene disponibilidad [día] a las [hora].\n¿Te sirve ese horario?",
      },
      {
        label: "Si el horario no le sirve",
        respuesta: "No hay problema. Voy a revisar otras opciones y te envío nuevos horarios.",
      },
      {
        label: "Si acepta el turno",
        respuesta: "¡Perfecto! 😊 Ya reservo ese horario para vos.\nEn unos minutos te envío los datos del profesional y toda la información necesaria para la primera sesión.",
      },
    ],
  },
  {
    id: "obras-sociales",
    title: "Obras Sociales, Recetas y Certificados",
    icon: "🏥",
    items: [
      {
        label: "Si pregunta por obras sociales",
        respuesta: "Actualmente trabajamos de manera particular. Si tu obra social ofrece reintegros, podemos brindarte la documentación necesaria para gestionarlos.",
      },
      {
        label: "Si pregunta si hacen recetas o certificados",
        respuesta: "Eso dependerá de la evaluación y del criterio profesional del psicólogo/a que te atienda. Si fuera necesario, podrá orientarte durante el proceso.",
      },
    ],
  },
  {
    id: "cierre",
    title: "Seguimiento y Cierre",
    icon: "✅",
    items: [
      {
        label: "Si deja de responder (24 horas después)",
        respuesta: "Hola. 😊 ¿Cómo estás? Te escribo para saber si todavía necesitás ayuda para coordinar tu consulta. Si tenés alguna duda, estoy a disposición.",
      },
      {
        label: "Cierre de conversación",
        respuesta: "Muchas gracias por confiar en Red de Escucha Psicológica. Cualquier consulta que tengas, escribinos. Va a ser un gusto acompañarte.",
      },
    ],
  },
];

// === Objeciones comunes ===
const OBJECTIONS = [
  {
    objection: "Es muy caro",
    icon: DollarSign,
    response:
      "Entendemos que la inversión puede ser significativa. 💚 Nuestro valor incluye sesión de 50 minutos con profesional matriculado, seguimiento personalizado y la posibilidad de reintegro por obra social. ¿Te gustaría que veamos disponibilidad de horarios?",
  },
  {
    objection: "Tengo obra social",
    icon: Shield,
    response:
      "🏥 Por el momento no trabajamos con obra social directa, pero al finalizar podés solicitar comprobante para tramitar el reintegro. El valor de la sesión es $35.000. ¿Te interesa que te asigne un turno?",
  },
  {
    objection: "Quiero turno para hoy",
    icon: Clock,
    response:
      "⏰ Hacemos lo posible para asignar turnos lo antes posible. Déjame tus datos y motivo de consulta y reviso la disponibilidad de hoy. Si no hay para hoy, te ofrezco la primera opción disponible. ¿Te parece?",
  },
  {
    objection: "Atención a menores",
    icon: User,
    response:
      "👶 Sí, tenemos profesionales especializados en niños y adolescentes. Para menores necesitamos que un adulto responsable complete la admisión. ¿Qué edad tiene y cuál es el motivo de consulta?",
  },
  {
    objection: "No sé qué profesional elegir",
    icon: Heart,
    response:
      "🤝 No te preocupes, para eso estamos. Contame brevemente qué estás atravesando y te recomiendo el profesional más adecuado según su especialidad y disponibilidad. ¿Qué te trae a consultar?",
  },
];

// === Árbol de decisión ===
const WORKFLOW_STEPS = [
  { num: 1, title: "Llegada de Lead", desc: "Paciente contacta por WhatsApp, web o derivación", icon: "📥" },
  { num: 2, title: "¿Turno?", desc: "¿Quiere agendar o solo consulta info?", icon: "❓" },
  { num: 3, title: "Modalidad", desc: "Online o Presencial", icon: "💻" },
  { num: 4, title: "Zona / Edad", desc: "Ubicación presencial o rango etario", icon: "📍" },
  { num: 5, title: "Motivo de Consulta", desc: "Ansiedad, depresión, vínculos, etc.", icon: "🧠" },
  { num: 6, title: "Asignación de Profesional", desc: "Match por especialidad + disponibilidad", icon: "🩺" },
  { num: 7, title: "Confirmación", desc: "Envío de email + WhatsApp con datos del turno", icon: "✅" },
];

export function AdminProtocolo() {
  const [activeTab, setActiveTab] = useState<"respuestas" | "workflow" | "objeciones">("respuestas");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>("recepcion");

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Texto copiado ✅");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-teal-900">Protocolo de Admisión REP</h2>
            <p className="text-xs text-teal-500">Guía oficial de consultas, respuestas rápidas y manejo de objeciones</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-600">
          Solo lectura
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-teal-100 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab("respuestas")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === "respuestas"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-teal-50 text-teal-600 hover:bg-teal-100"
          }`}
        >
          <MessageCircle className="w-4 h-4 inline mr-1.5" />
          Consultas y Respuestas
        </button>
        <button
          onClick={() => setActiveTab("workflow")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === "workflow"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-teal-50 text-teal-600 hover:bg-teal-100"
          }`}
        >
          <Zap className="w-4 h-4 inline mr-1.5" />
          Árbol de Decisión
        </button>
        <button
          onClick={() => setActiveTab("objeciones")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === "objeciones"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-teal-50 text-teal-600 hover:bg-teal-100"
          }`}
        >
          <AlertCircle className="w-4 h-4 inline mr-1.5" />
          Objeciones
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <AnimatePresence mode="wait">
          {activeTab === "respuestas" && (
            <motion.div
              key="respuestas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {CATEGORIES.map((cat) => (
                <Card key={cat.id} className="border-teal-100 overflow-hidden">
                  <button
                    onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-teal-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.icon}</span>
                      <h3 className="font-semibold text-teal-900 text-sm">{cat.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-teal-50 border-teal-200 text-teal-600">
                        {cat.items.length} {cat.items.length === 1 ? "respuesta" : "respuestas"}
                      </Badge>
                      <ChevronDown
                        className={`w-4 h-4 text-teal-400 transition-transform ${
                          openCategory === cat.id ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                  {openCategory === cat.id && (
                    <div className="px-4 pb-4 space-y-3">
                      {cat.items.map((item, i) => {
                        const copyId = `${cat.id}-${i}`;
                        return (
                          <div
                            key={copyId}
                            className="bg-white rounded-lg p-3 border border-teal-100"
                          >
                            {/* Label de la situación */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <p className="text-xs font-bold text-teal-700 mb-1">{item.label}</p>
                                {item.paciente && (
                                  <div className="flex items-start gap-1.5 mb-2">
                                    <Badge variant="outline" className="text-[9px] bg-slate-100 border-slate-200 text-slate-500 shrink-0">
                                      Paciente
                                    </Badge>
                                    <p className="text-xs text-slate-600 italic">"{item.paciente}"</p>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleCopy(item.respuesta, copyId)}
                                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors"
                                title="Copiar respuesta"
                              >
                                {copiedId === copyId ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-[10px] text-emerald-600 font-medium">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-teal-500" />
                                    <span className="text-[10px] text-teal-600 font-medium">Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>
                            {/* Respuesta */}
                            <div className="flex items-start gap-1.5">
                              <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-600 shrink-0">
                                Respuesta
                              </Badge>
                              <p className="text-sm text-teal-800 whitespace-pre-wrap flex-1">{item.respuesta}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ))}
            </motion.div>
          )}

          {activeTab === "workflow" && (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card className="border-teal-100">
                <CardContent className="p-6">
                  <div className="space-y-1">
                    {WORKFLOW_STEPS.map((step, i) => (
                      <div key={step.num} className="flex items-start gap-4">
                        {/* Número + línea */}
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {step.num}
                          </div>
                          {i < WORKFLOW_STEPS.length - 1 && (
                            <div className="w-0.5 h-12 bg-teal-200 mt-1" />
                          )}
                        </div>
                        {/* Contenido */}
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{step.icon}</span>
                            <h4 className="font-semibold text-teal-900 text-sm">{step.title}</h4>
                          </div>
                          <p className="text-xs text-teal-600 ml-7">{step.desc}</p>
                          {i < WORKFLOW_STEPS.length - 1 && (
                            <div className="flex items-center gap-1 mt-2 ml-7 text-teal-300">
                              <ArrowRight className="w-3 h-3" />
                              <span className="text-[10px]">Siguiente paso</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Nota final */}
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Si el paciente está en crisis o indica riesgo, NO continuar con el flujo de admisión.
                      Derivar inmediatamente a Línea 135 o 0800-345-1435.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "objeciones" && (
            <motion.div
              key="objeciones"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {OBJECTIONS.map((obj, i) => {
                const copyId = `obj-${i}`;
                return (
                  <Card key={copyId} className="border-teal-100">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <obj.icon className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-teal-900 text-sm">
                            "{obj.objection}"
                          </p>
                        </div>
                        <button
                          onClick={() => handleCopy(obj.response, copyId)}
                          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors"
                          title="Copiar respuesta"
                        >
                          {copiedId === copyId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-[10px] text-emerald-600 font-medium">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-teal-500" />
                              <span className="text-[10px] text-teal-600 font-medium">Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-teal-700 bg-teal-50/50 rounded-lg p-2.5 border border-teal-100">
                        {obj.response}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-teal-400">
        <Phone className="w-3 h-3" />
        <span>Emergencias: 135 (Prevención Suicidio) · 0800-345-1435 (Salud Mental)</span>
      </div>
    </div>
  );
}
