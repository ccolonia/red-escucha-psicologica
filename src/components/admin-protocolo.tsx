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
type Category = {
  id: string;
  title: string;
  icon: string;
  responses: { label: string; text: string }[];
};

// === Respuestas rápidas por categoría ===
const CATEGORIES: Category[] = [
  {
    id: "recepcion",
    title: "Recepción & Saludo",
    icon: "👋",
    responses: [
      {
        label: "Saludo inicial",
        text: "¡Hola! 👋 Bienvenido/a a Red Escucha Psicológica. ¿En qué podemos ayudarte hoy?",
      },
      {
        label: "Dónde estamos",
        text: "📍 Atendemos de forma Online (videollamada) y Presencial en distintos puntos de CABA y GBA. ¿Qué modalidad preferís?",
      },
      {
        label: "Urgencias",
        text: "🚨 Si estás atravesando una emergencia, por favor llamá al 135 (Línea de Prevención del Suicidio, 24 hs) o al 0800-345-1435 (Salud Mental). Si es una urgencia médica, acudí a la guardia del hospital más cercano.",
      },
    ],
  },
  {
    id: "admission",
    title: "Admisión & Turnos",
    icon: "📅",
    responses: [
      {
        label: "Precio por sesión",
        text: "💰 El valor de la sesión es de $35.000. Incluye sesión de 50 minutos con profesional matriculado.",
      },
      {
        label: "Duración de la sesión",
        text: "⏱️ Cada sesión tiene una duración de 50 minutos, ya sea Online o Presencial.",
      },
      {
        label: "Online vs Presencial",
        text: "💻 Atendemos de forma Online (por videollamada, desde cualquier lugar) y Presencial (en consultorios de CABA y GBA). ¿Cuál te resulta más cómodo?",
      },
      {
        label: "Ubicación / Zona",
        text: "📍 Tenemos consultorios en CABA, GBA Norte, GBA Oeste y GBA Sur. ¿En qué zona te resulta más fácil concurrir?",
      },
    ],
  },
  {
    id: "manejo",
    title: "Manejo de Respuestas",
    icon: "🧠",
    responses: [
      {
        label: "Hablarlo con profesional",
        text: "🤝 Esa consulta es excelente para plantearla en la primera sesión con el/la profesional. Cada caso es único y merece un abordaje personalizado. ¿Te asigno un turno para que puedas conversarlo?",
      },
      {
        label: "Atención a menores",
        text: "👶 Sí, contamos con profesionales especializados en infanto-juvenil. Para menores de edad necesitamos que un adulto responsable complete el formulario de admisión. ¿Qué edad tiene el/la menor?",
      },
      {
        label: "Obras sociales / Reintegros",
        text: "🏥 Por el momento no trabajamos directamente con obras sociales, pero al finalizar el tratamiento podés solicitar un comprobante para presentar y tramitar el reintegro correspondiente.",
      },
    ],
  },
  {
    id: "cierre",
    title: "Cierre & Seguimiento",
    icon: "✅",
    responses: [
      {
        label: "Turno confirmado",
        text: "✅ ¡Turno confirmado! 📅 Te enviamos por email los detalles con fecha, hora y link de la sesión. ¡Te esperamos!",
      },
      {
        label: "Seguimiento 24 hs",
        text: "👋 Hola! Te escribimos desde Red Escucha Psicológica. Vimos que no respondiste a nuestro último mensaje. ¿Necesitás que te ayudemos con algo? Estamos acá para lo que necesites. 💚",
      },
      {
        label: "Despedida",
        text: "💚 Muchas gracias por contactarte con Red Escucha Psicológica. Quedamos a tu disposición. ¡Que tengas un excelente día!",
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
      toast.success("Copiado al portapapeles ✅");
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
            <p className="text-xs text-teal-500">Respuestas rápidas, árbol de decisión y manejo de objeciones</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-600">
          Solo lectura
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-teal-100 pb-2">
        <button
          onClick={() => setActiveTab("respuestas")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === "respuestas"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-teal-50 text-teal-600 hover:bg-teal-100"
          }`}
        >
          <MessageCircle className="w-4 h-4 inline mr-1.5" />
          Respuestas Rápidas
        </button>
        <button
          onClick={() => setActiveTab("workflow")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
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
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
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
                        {cat.responses.length} respuestas
                      </Badge>
                      <ChevronDown
                        className={`w-4 h-4 text-teal-400 transition-transform ${
                          openCategory === cat.id ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                  {openCategory === cat.id && (
                    <div className="px-4 pb-4 space-y-2">
                      {cat.responses.map((resp, i) => {
                        const copyId = `${cat.id}-${i}`;
                        return (
                          <div
                            key={copyId}
                            className="bg-teal-50/50 rounded-lg p-3 border border-teal-100"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-xs font-medium text-teal-700">{resp.label}</p>
                              <button
                                onClick={() => handleCopy(resp.text, copyId)}
                                className="shrink-0 p-1.5 rounded-md bg-white border border-teal-200 hover:bg-teal-100 transition-colors"
                                title="Copiar texto"
                              >
                                {copiedId === copyId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-teal-500" />
                                )}
                              </button>
                            </div>
                            <p className="text-sm text-teal-800 whitespace-pre-wrap">{resp.text}</p>
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
                            ".objection"
                          </p>
                        </div>
                        <button
                          onClick={() => handleCopy(obj.response, copyId)}
                          className="shrink-0 p-1.5 rounded-md bg-white border border-teal-200 hover:bg-teal-100 transition-colors"
                          title="Copiar respuesta"
                        >
                          {copiedId === copyId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-teal-500" />
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
