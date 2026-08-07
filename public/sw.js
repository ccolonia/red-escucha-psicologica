/**
 * Service Worker de Red Escucha Psicológica (REP)
 *
 * Funciones:
 *  1. Caché básico de assets estáticos (shell + imágenes + fonts)
 *  2. Recepción de Web Push notifications (background, incluso si la app está cerrada)
 *  3. Click en notificación → foco a la ventana existente o apertura de /admin/chat
 *     para admin o / para paciente
 *
 * No hace precaching agresivo porque la app es SSR (Next.js) y el HTML cambia.
 * El caché es stale-while-revalidate para assets estáticos.
 */

const CACHE_VERSION = "rep-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Assets estáticos para cachear en install (best-effort, sin fallar si no existen)
const PRECACHE_URLS = [
  "/manifest.json",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/apple-touch-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// === INSTALL: precachear assets esenciales ===
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Usar addAll con fallback individual para que no falle si algún asset no existe
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            /* ignorar errores individuales */
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// === ACTIVATE: limpiar caches viejos ===
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// === FETCH: stale-while-revalidate para assets estáticos ===
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo cachear GET, ignorar POST/PATCH/DELETE y requests de API
  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;
  if (request.url.includes("/_next/data/")) return;

  // Para navegación (HTML), usar network-first (siempre la última versión)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Para otros assets (imágenes, fonts, JS, CSS), stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          // Solo cachear respuestas exitosas
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// === PUSH: recibir notificaciones push del servidor ===
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Red Escucha Psicológica", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Red Escucha Psicológica";
  const options = {
    body: payload.body || "Tenés un nuevo mensaje",
    icon: payload.icon || "/icon-192x192.png",
    badge: payload.badge || "/icon-192x192.png",
    tag: payload.tag || "rep-chat",
    renotify: true,
    data: {
      url: payload.url || "/",
      conversationId: payload.conversationId || null,
    },
    vibrate: [200, 100, 200],
    requireInteraction: payload.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// === NOTIFICATIONCLICK: enfocar ventana existente o abrir nueva ===
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Buscar una ventana ya abierta de REP
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        const targetPath = new URL(targetUrl, self.location.origin).pathname;
        if (clientUrl.pathname === targetPath && "focus" in client) {
          // Si ya está en la URL correcta, solo enfocar
          return client.focus();
        }
      }
      // Si hay alguna ventana de REP abierta, enfocarla y navegar
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// === MESSAGE: permitir que el cliente fuerce la activación del SW ===
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
