"use client";

import { useState, useEffect } from "react";
import { HelpCircle, X, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================================
// PlanillaGuideModal — Wizard de onboarding interactivo para Planilla REP
// ============================================================================
//
// Replica la misma línea estética de la "Guía Agenda REP":
//   - Indicador de puntos de progreso (dots) en la parte superior
//   - Ícono central grande por paso
//   - Contador "Paso X de N"
//   - Botones Anterior/Siguiente con deshabilitado en Paso 1
//   - En el último paso: "¡Entendido!" cierra el modal
//   - Botón de cierre (X) en esquina superior derecha
//
// Soporte de localStorage:
//   - Al completar la guía (clic en "¡Entendido!"), se setea
//     localStorage['rep_planilla_guide_completed'] = 'true'
//   - Al montar el componente padre, si NO tiene ese flag, abre la guía
//     automáticamente (auto-onboarding solo la primera vez)
//   - El botón "(?) Guía" en la barra superior permite reabrirla cuando
//     el profesional lo necesite, sin importar el flag de localStorage
// ============================================================================

// === Clave de localStorage para persistir que el usuario ya vio la guía ===
const STORAGE_KEY = "rep_planilla_guide_completed";

// === Contenido de los 4 pasos ===
const GUIDE_STEPS = [
  {
    icon: "📅",
    title: "Período y Comisión Automática",
    body: "Navegá entre los meses y filtrá por semana (Sem 1 a Sem 5). El sistema identifica tus años en la Red REP y aplica automáticamente tu % de comisión correspondiente.",
  },
  {
    icon: "📝",
    title: "Registro de Sesiones",
    body: "Presioná \"+ Agregar Sesión\" para sumar una fila. Completá la Fecha, Nombre y Apellido del paciente, Modo (P: Presencial / OL: Online), Inicio de Tratamiento y Frecuencia.",
  },
  {
    icon: "🏷️",
    title: "Estado de la Sesión (CA, SA, Susp.)",
    body: "Marcá las casillas según el estado particular de la sesión en esa semana:\n• CA (Cuenta REP): Activalo cuando el cobro sea procesado directamente por la plataforma/medios de pago de la Red Escucha Psicológica.\n• SA (Sin Asistencia): Seleccionalo para registrar la ausencia/inasistencia del paciente.\n• Susp. (Suspendido): Utilizalo para indicar que la sesión o el tratamiento se encuentra en pausa o receso.",
  },
  {
    icon: "🚀",
    title: "Honorarios y Guardado",
    body: "Ingresá el valor abonado en \"Honor. Pac.\". La planilla calculará tu Honorario Profesional y la Comisión REP. Al finalizar, hacé clic en \"Guardar\" (o en la barra flotante inferior). Podés exportar tu resumen en formato CSV.",
  },
];

// === Helper: verificar si el usuario ya completó la guía ===
export function hasUserCompletedPlanillaGuide(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// === Helper: marcar la guía como completada ===
function markGuideAsCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Silencioso: si localStorage no está disponible, no rompemos el flujo
  }
}

// === Helper: resetear la guía (por si se quiere mostrar de nuevo) ===
export function resetPlanillaGuide(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silencioso
  }
}

interface PlanillaGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanillaGuideModal({ open, onOpenChange }: PlanillaGuideModalProps) {
  const [step, setStep] = useState(0);
  const totalSteps = GUIDE_STEPS.length;
  const current = GUIDE_STEPS[step];
  const isLast = step === totalSteps - 1;

  // === Resetear el step a 0 cada vez que se abre el modal ===
  // Así el usuario siempre ve la guía desde el principio.
  useEffect(() => {
    if (open) {
      setStep(0);
    }
  }, [open]);

  // === Al cerrar el modal ===
  // Si lo cierra desde el último paso con "¡Entendido!", marcamos la guía
  // como completada para que no salte automáticamente la próxima vez.
  const handleClose = () => {
    onOpenChange(false);
  };

  const handleFinalize = () => {
    markGuideAsCompleted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* === Header con botón cerrar (X) === */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-teal-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-teal-600" />
              Guía Planilla REP
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-teal-400 hover:text-teal-600 transition-colors"
              aria-label="Cerrar guía"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {/* === Indicador de progreso: dots === */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {GUIDE_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-8 bg-emerald-600"
                  : i < step
                  ? "w-2 bg-emerald-400"
                  : "w-2 bg-emerald-200"
              }`}
            />
          ))}
        </div>

        {/* === Contenido del paso === */}
        <div className="text-center py-4">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h3 className="text-lg font-bold text-teal-900 mb-2">
            Paso {step + 1} de {totalSteps}: {current.title}
          </h3>
          <p className="text-sm text-teal-600 leading-relaxed whitespace-pre-line" style={{ fontFamily: "Montserrat, sans-serif" }}>
            {current.body}
          </p>
        </div>

        {/* === Navegación: Anterior / Siguiente / Finalizar === */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="border-teal-200 text-teal-600 hover:bg-teal-50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>

          <span className="text-xs text-teal-400 font-medium">
            {step + 1} / {totalSteps}
          </span>

          {isLast ? (
            <Button
              size="sm"
              onClick={handleFinalize}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              ¡Entendido!
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setStep(Math.min(totalSteps - 1, step + 1))}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
