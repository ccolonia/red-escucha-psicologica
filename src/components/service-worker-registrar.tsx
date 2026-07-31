"use client";

import { useEffect } from "react";

/**
 * Registra el Service Worker (/sw.js) en el navegador.
 *
 * Solo se registra en producción para evitar problemas con el hot reload
 * de Next.js dev. En dev, el SW puede cacheár assets viejos y romper el HMR.
 *
 * Se monta a nivel global en <Providers/> para que el SW esté activo en
 * todas las páginas y pueda recibir push notifications en background.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Registramos el SW después de que la página carga completamente
    // para no competir con recursos críticos del first paint.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[SW] Registrado:", registration.scope);
          // Si hay una nueva versión del SW, forzar la activación
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          // Escuchar actualizaciones futuras
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // Nueva versión disponible — el SW se activará solo en la próxima recarga
                  console.log("[SW] Nueva versión disponible");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error("[SW] Error al registrar:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
