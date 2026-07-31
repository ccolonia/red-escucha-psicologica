"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { IdleTimeoutProvider } from "@/components/providers/idle-timeout-provider";
import { FloatingChatWidget } from "@/components/floating-chat-widget";

/** Oculta el widget de chat para admins (tienen su panel /admin/chat). */
function ChatWidgetWrapper() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "admin" || role === "super_admin") return null;
  return <FloatingChatWidget />;
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
          </IdleTimeoutProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
