"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Hook para gestionar suscripciones Web Push del lado del cliente.
 *
 * Funciones:
 *  1. Carga la VAPID public key desde /api/push/vapid-public-key
 *  2. Pide permiso al usuario (Notification.requestPermission)
 *  3. Se suscribe al pushManager del Service Worker
 *  4. Envía la suscripción al backend vía POST /api/push/subscribe
 *  5. Expone el estado actual: 'unsupported' | 'default' | 'granted' | 'denied'
 *
 * Uso típico (paciente anónimo en una conversación de chat):
 *   const { permission, subscribe } = usePushNotifications();
 *   if (permission === "default") {
 *     // mostrar botón "Activar notificaciones"
 *   }
 *   await subscribe(conversationId);
 */

type PushPermission = "unsupported" | "default" | "granted" | "denied";

// Convierte base64 → Uint8Array (requerido por pushManager.subscribe)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = typeof window !== "undefined" ? window.atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar soporte y permiso actual al montar
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    // Notification API puede no estar disponible en algunos navegadores
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);
  }, []);

  /**
   * Pide permiso y suscribe al usuario a Web Push.
   * @param conversationId - si es paciente anónimo, vincular la suscripción a esta conversación
   * @returns true si la suscripción fue exitosa, false si falló o el usuario denegó
   */
  const subscribe = useCallback(async (conversationId?: string): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Tu navegador no soporta notificaciones push");
      return false;
    }

    setSubscribing(true);
    setError(null);

    try {
      // 1. Pedir permiso si no fue concedido
      let currentPerm = Notification.permission;
      if (currentPerm === "default") {
        currentPerm = await Notification.requestPermission();
      }
      setPermission(currentPerm as PushPermission);

      if (currentPerm !== "granted") {
        setError("Permiso de notificaciones denegado");
        return false;
      }

      // 2. Esperar a que el service worker esté activo
      const registration = await navigator.serviceWorker.ready;

      // 3. Obtener la VAPID public key desde el backend
      const vapidRes = await fetch("/api/push/vapid-public-key");
      if (!vapidRes.ok) {
        setError("Notificaciones push no configuradas en el servidor");
        return false;
      }
      const { publicKey } = await vapidRes.json();
      if (!publicKey) {
        setError("Falta la VAPID public key");
        return false;
      }

      // 4. Suscribirse al pushManager
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // requerido por la spec: las notificaciones siempre son visibles
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // 5. Enviar la suscripción al backend para guardarla
      const subJson = subscription.toJSON();
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          conversationId: conversationId || undefined,
        }),
      });

      if (!saveRes.ok) {
        const d = await saveRes.json().catch(() => ({}));
        setError(d.error || "Error al guardar la suscripción");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error suscribiendo a push:", err);
      setError("Error al activar las notificaciones");
      return false;
    } finally {
      setSubscribing(false);
    }
  }, []);

  /**
   * Desuscribe el dispositivo actual del pushManager y elimina la suscripción del backend.
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return true;

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Eliminar del backend
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      return true;
    } catch (err) {
      console.error("Error desuscribiendo de push:", err);
      return false;
    }
  }, []);

  return {
    permission,        // "unsupported" | "default" | "granted" | "denied"
    subscribing,        // boolean — true mientras se está suscribiendo
    error,              // string | null — último error ocurrido
    subscribe,          // (conversationId?) => Promise<boolean>
    unsubscribe,        // () => Promise<boolean>
  };
}
