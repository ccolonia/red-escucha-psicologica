import webpush from "web-push";
import { db } from "@/lib/db";

/**
 * Helper para enviar notificaciones Web Push a suscripciones guardadas en DB.
 *
 * Configuración requerida en .env:
 *  - VAPID_PUBLIC_KEY
 *  - VAPID_PRIVATE_KEY
 *  - VAPID_SUBJECT (mailto:contacto@redescuchapsicologica.com)
 *
 * Si las variables no están configuradas, las funciones son no-op (no fallan).
 * Esto permite que la app funcione sin push en desarrollo.
 */

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contacto@redescuchapsicologica.com";

  if (!publicKey || !privateKey) {
    // Sin claves → push desactivado silenciosamente
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  conversationId?: string;
  tag?: string;
  icon?: string;
  requireInteraction?: boolean;
};

/**
 * Envía una notificación push a TODAS las suscripciones vinculadas a una conversación.
 * Útil cuando el admin responde a un paciente → todos los dispositivos del paciente
 * reciben la notificación.
 *
 * Limpia suscripciones inválidas (410 Gone, 404) automáticamente.
 */
export async function sendPushToConversation(
  conversationId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  ensureConfigured();
  if (!configured) return { sent: 0, failed: 0 };

  const subscriptions = await db.pushSubscription.findMany({
    where: { conversationId },
  });

  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    conversationId: payload.conversationId || conversationId,
    tag: payload.tag || "rep-chat",
    icon: payload.icon || "/icon-192x192.png",
    badge: "/icon-192x192.png",
    requireInteraction: payload.requireInteraction ?? false,
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          payloadStr
        );
        return { ok: true, id: sub.id };
      } catch (err: unknown) {
        const error = err as { statusCode?: number };
        // 410 Gone / 404 Not Found → suscripción ya no es válida, eliminar
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        return { ok: false, id: sub.id };
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const failed = results.length - sent;
  return { sent, failed };
}

/**
 * Envía una notificación push a TODAS las suscripciones vinculadas a un userId.
 * Útil para notificar a admins/profesionales sobre nuevos mensajes, turnos, etc.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  ensureConfigured();
  if (!configured) return { sent: 0, failed: 0 };

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    conversationId: payload.conversationId,
    tag: payload.tag || "rep-notification",
    icon: payload.icon || "/icon-192x192.png",
    badge: "/icon-192x512.png",
    requireInteraction: payload.requireInteraction ?? false,
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          payloadStr
        );
        return { ok: true, id: sub.id };
      } catch (err: unknown) {
        const error = err as { statusCode?: number };
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        return { ok: false, id: sub.id };
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const failed = results.length - sent;
  return { sent, failed };
}

/**
 * Helper para obtener la VAPID public key desde el servidor.
 * Usado por el cliente al suscribirse con pushManager.subscribe({ applicationServerKey }).
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
