"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { IdleTimeoutProvider } from "@/components/providers/idle-timeout-provider";
import { FloatingChatWidget } from "@/components/floating-chat-widget";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { InstallPWAButton } from "@/components/install-pwa-button";

/** Oculta el widget de chat para admins (tienen su panel /admin/chat). */
function ChatWidgetWrapper() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "admin" || role === "super_admin") return null;
  return <FloatingChatWidget />;
}

/** Oculta el banner de instalación de PWA para usuarios autenticados
 *  (ellos ya están dentro de la app; el banner es para visitantes anónimos
 *  de la web pública). */
function InstallPWAWrapper() {
  const { data: session } = useSession();
  // Mostrar el banner solo si NO hay sesión (visitantes anónimos de la home)
  // o si es paciente (no admin/profesional)
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "admin" || role === "super_admin" || role === "professional") return null;
  return <InstallPWAButton />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider
      // Poll session every 5 minutes to detect server-side invalidation.
      // If the JWT has been invalidated (expired, tokenVersion change, user deactivated),
      // the client will detect it and update the session status to "unauthenticated",
      // triggering the automatic redirect to the login page.
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {/* IdleTimeoutProvider: cierra sesión tras 30 min de inactividad.
              Va aquí dentro porque usa useSession() para detectar auth status.
              Solo activa listeners cuando el usuario está autenticado. */}
          <IdleTimeoutProvider>
            {children}
            {/* Widget flotante de Chat Web en Vivo - disponible en toda la web
                como fallback temporal por contingencia de WhatsApp. */}
            <ChatWidgetWrapper />
            {/* Service Worker para PWA + Web Push notifications.
                Solo se registra en producción para no romper el HMR de dev. */}
            <ServiceWorkerRegistrar />
            {/* Banner de instalación de la PWA - solo para visitantes/pacientes. */}
            <InstallPWAWrapper />
          </IdleTimeoutProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
