"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

/**
 * IdleTimeoutProvider
 * -------------------
 * Detecta inactividad del usuario (mousemove, keydown, click, scroll, touchstart)
 * y dispara un modal de advertencia a los 29 minutos. Si el usuario no responde
 * en 60 segundos más (30 minutos totales), cierra la sesión automáticamente.
 *
 * Solo está activo cuando hay una sesión válida. Cuando el usuario está en
 * landing/login/register, el provider se desactiva automáticamente.
 *
 * Constantes de tiempo (en milisegundos):
 *  - WARN_AFTER         29 min — cuándo se abre el modal de advertencia
 *  - COUNTDOWN_SECS     60 s   — cuenta regresiva dentro del modal
 *  (Total inactividad = 29 min + 60 s = 30 min)
 */

const WARN_AFTER = 29 * 60 * 1000; // 29 min
const COUNTDOWN_SECS = 60; // 60 s de gracia dentro del modal

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  // Timer principal de inactividad (setTimeout ID)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Intervalo de la cuenta regresiva dentro del modal
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estado del modal de advertencia
  const [warnOpen, setWarnOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECS);

  // Ref flag para evitar que handleActivity dispare durante el modal
  const warnOpenRef = useRef(false);
  useEffect(() => {
    warnOpenRef.current = warnOpen;
  }, [warnOpen]);

  // ----- Limpieza de timers -----
  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // ----- Logout forzado -----
  const forceLogout = useCallback(() => {
    clearIdleTimer();
    clearCountdown();
    setWarnOpen(false);
    // Cerrar sesión y mandar al login (vía hash, ya que /login no es ruta real)
    signOut({ redirect: false }).finally(() => {
      if (typeof window !== "undefined") {
        window.location.hash = "#login";
        // Forzar recarga para limpiar todo estado en memoria
        window.location.reload();
      }
    });
  }, [clearIdleTimer, clearCountdown]);

  // ----- Iniciar cuenta regresiva del modal -----
  const startCountdown = useCallback(() => {
    clearCountdown();
    setSecondsLeft(COUNTDOWN_SECS);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Se acabó el tiempo → logout forzado
          forceLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown, forceLogout]);

  // ----- Reiniciar el timer principal de inactividad -----
  const resetIdleTimer = useCallback(() => {
    // Si el modal está abierto, ignorar la actividad hasta que el usuario decida
    if (warnOpenRef.current) return;

    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      // 29 min sin actividad → abrir advertencia
      setWarnOpen(true);
      startCountdown();
    }, WARN_AFTER);
  }, [clearIdleTimer, startCountdown]);

  // ----- Handler de actividad -----
  const handleActivity = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  // ----- Activar listeners solo cuando está autenticado -----
  useEffect(() => {
    if (!isAuthenticated) {
      // Si por alguna razón cambia a no autenticado, limpiar todo
      clearIdleTimer();
      clearCountdown();
      setWarnOpen(false);
      return;
    }

    // Arrancar timer principal
    resetIdleTimer();

    // Adjuntar listeners (passive: true para no bloquear scroll/touch)
    const opts: AddEventListenerOptions = { passive: true };
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, handleActivity, opts);
    });

    return () => {
      clearIdleTimer();
      clearCountdown();
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, handleActivity);
      });
    };
  }, [
    isAuthenticated,
    handleActivity,
    resetIdleTimer,
    clearIdleTimer,
    clearCountdown,
  ]);

  // ----- Cleanup final al desmontar -----
  useEffect(() => {
    return () => {
      clearIdleTimer();
      clearCountdown();
    };
  }, [clearIdleTimer, clearCountdown]);

  // ----- Continuar trabajando -----
  const handleContinue = useCallback(() => {
    clearCountdown();
    setWarnOpen(false);
    setSecondsLeft(COUNTDOWN_SECS);
    // Reiniciar el timer principal de 30 min
    resetIdleTimer();
  }, [clearCountdown, resetIdleTimer]);

  return (
    <>
      {children}

      <AlertDialog
        open={warnOpen}
        onOpenChange={(open) => {
          if (!open) {
            // Si el usuario presiona ESC o clickea fuera, tratamos como "continuar"
            // para no cerrar la sesión por error. La única forma de cerrar sesión
            // es dejando que el countdown llegue a 0.
            handleContinue();
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-7 h-7 text-amber-600" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-teal-900">
              Tu sesión está por expirar
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Por inactividad, tu sesión se cerrará automáticamente en{" "}
              <span className="font-bold text-amber-600 text-base">
                {secondsLeft}
              </span>{" "}
              segundo{secondsLeft !== 1 ? "s" : ""}.
              <br />
              ¿Deseas continuar trabajando?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Barra visual de progreso */}
          <div className="w-full h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
              style={{
                width: `${(secondsLeft / COUNTDOWN_SECS) * 100}%`,
              }}
            />
          </div>

          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction
              onClick={handleContinue}
              className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto"
            >
              Continuar trabajando
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
