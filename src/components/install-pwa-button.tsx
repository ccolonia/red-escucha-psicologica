"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";

/**
 * Botón / Banner de instalación de la PWA.
 *
 * Escucha el evento `beforeinstallprompt` del navegador. Cuando se dispara
 * (Chrome/Edge/Android: la web cumple los criterios de PWA instalable),
 * guarda el evento diferido y muestra un banner animado en la parte inferior
 * de la pantalla.
 *
 * Si el usuario hace clic en "Instalar App", se invoca deferredPrompt.prompt().
 * Si descarta el banner, se guarda en localStorage para no volver a mostrarlo
 * por 7 días (no ser invasivo).
 *
 * En iOS Safari, `beforeinstallprompt` NO se dispara (Apple no lo soporta).
 * Para iOS detectamos que es iOS Safari + standalone=false y mostramos un
 * banner alternativo con instrucciones de "Agregar a pantalla de inicio".
 */

// Tipo del evento beforeinstallprompt (no está en los tipos estándar de TS)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "rep_pwa_install_dismissed_until";
const DISMISS_DAYS = 7;

export function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detectar iOS Safari (no soporta beforeinstallprompt)
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                         (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIOSDevice && !isStandalone) {
      setIsIOS(true);
      // En iOS mostramos el banner con instrucciones (si no fue descartado)
      if (shouldShowBanner()) setVisible(true);
      return;
    }

    // Chrome/Edge/Android: escuchar beforeinstallprompt
    const handler = (e: Event) => {
      // Prevenir el mini-infobar default de Chrome
      e.preventDefault();
      // Guardar el evento para invocar prompt() después
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Mostrar nuestro banner si no fue descartado recientemente
      if (shouldShowBanner()) setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Si la app ya está instalada (standalone), ocultar el banner
    if (isStandalone) {
      setVisible(false);
    }

    // Escuchar el evento appinstalled para ocultar el banner después de instalar
    const installedHandler = () => {
      setVisible(false);
      setDeferredPrompt(null);
      // Limpiar el dismissal para que si desinstala y vuelve, vea el banner de nuevo
      try { localStorage.removeItem(DISMISS_KEY); } catch { /* */ }
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  function shouldShowBanner(): boolean {
    try {
      const dismissedUntil = localStorage.getItem(DISMISS_KEY);
      if (dismissedUntil) {
        const until = parseInt(dismissedUntil, 10);
        if (Date.now() < until) return false;
      }
    } catch { /* */ }
    return true;
  }

  function dismissBanner() {
    setVisible(false);
    try {
      // No volver a mostrar por 7 días
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISS_KEY, until.toString());
    } catch { /* */ }
  }

  async function handleInstallClick() {
    if (isIOS) {
      // En iOS no podemos invocar prompt(). El banner ya muestra instrucciones.
      // Lo cerramos para no ser invasivo.
      dismissBanner();
      return;
    }
    if (!deferredPrompt) return;

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        // El banner se ocultará solo cuando se dispare 'appinstalled'
      } else {
        // Usuario rechazó → descartar por 7 días
        dismissBanner();
      }
      // El evento deferredPrompt solo se puede usar una vez
      setDeferredPrompt(null);
    } catch (err) {
      console.error("Error al invocar prompt de instalación:", err);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="install-pwa-banner"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-sm z-40"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden">
            {/* Banda lateral esmeralda */}
            <div className="flex items-stretch">
              <div className="w-1.5 bg-gradient-to-b from-emerald-500 to-teal-600" />
              <div className="flex-1 p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    {isIOS ? <Smartphone className="w-5 h-5 text-emerald-600" /> : <Download className="w-5 h-5 text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-teal-900">Instalá la App de REP</p>
                    <p className="text-[11px] text-teal-600 mt-0.5 leading-snug">
                      {isIOS ? (
                        // Instrucciones para iOS Safari
                        <>
                          Tocá <span className="font-semibold">Compartir</span> <ShareIcon /> abajo en Safari
                          y luego <span className="font-semibold">"Agregar a pantalla de inicio"</span> <AddToHomeIcon />
                        </>
                      ) : (
                        <>
                          Recibí alertas de tus mensajes y turnos en tu celular. Más rápido que WhatsApp.
                        </>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2.5">
                      {!isIOS && (
                        <button
                          onClick={handleInstallClick}
                          disabled={installing}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {installing ? "Instalando..." : "Instalar App"}
                        </button>
                      )}
                      <button
                        onClick={dismissBanner}
                        className="px-2 py-1.5 text-teal-500 hover:text-teal-700 hover:bg-teal-50 text-xs font-medium rounded-lg transition-colors"
                      >
                        Ahora no
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={dismissBanner}
                    className="text-teal-300 hover:text-teal-500 p-1 -mt-1 -mr-1"
                    aria-label="Cerrar banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// === Íconos SVG inline para las instrucciones de iOS ===
// (iOS Safari no soporta beforeinstallprompt, hay que guiar al usuario)

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 inline-block fill-current" aria-hidden>
      <path d="M17 8l-4-4v2.5c-4.5.5-7 4-7 8.5 2-3 4-4 7-4V17l4-4z"/>
    </svg>
  );
}

function AddToHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 inline-block fill-current" aria-hidden>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5h3V8h4v4h3l-5 5z"/>
    </svg>
  );
}
