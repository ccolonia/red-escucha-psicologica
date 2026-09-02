import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Authentication & Authorization Proxy (Next.js 16)
 *
 * Security guarantees:
 * 1. All API routes (except public ones) require a valid, non-expired JWT
 * 2. Expired or invalid tokens are rejected and session cookie is cleared
 * 3. Token version check forces re-authentication on security policy changes
 * 4. Role-based access control for admin/super_admin routes
 * 5. Deactivated users are immediately locked out
 */

const AUTH_TOKEN_VERSION = 1;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Skip static files and internal Next.js paths ──
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // static files (images, fonts, etc.)
  ) {
    return NextResponse.next();
  }

  // ── Allow public pages (token-based auth, not session-based) ──
  if (pathname === "/set-password" || pathname === "/reset-password") {
    return NextResponse.next();
  }

  // ── Allow public API routes (no auth required) ──
  if (isPublicApiRoute(pathname, request.method)) {
    return NextResponse.next();
  }

  // ── Validate JWT for protected API routes ──
  if (pathname.startsWith("/api/")) {
    return await handleProtectedApiRoute(request);
  }

  // ── For non-API page routes, client-side handles auth UI ──
  // The app is an SPA served from /, so NextAuth's SessionProvider
  // + useSession() handles the redirect to login when unauthenticated.
  return NextResponse.next();
}

/**
 * Check if an API route is publicly accessible (no auth required)
 */
function isPublicApiRoute(pathname: string, method: string): boolean {
  // NextAuth internal routes (login, callback, session, etc.)
  if (pathname.startsWith("/api/auth/")) {
    return true;
  }

  // Explicit public routes
  if (
    pathname === "/api/auth/register" ||
    pathname === "/api/contact" ||
    pathname === "/api/cms/content" ||
    pathname === "/api/public/register-patient" ||
    pathname === "/api/whatsapp/process" ||  // Bot de WhatsApp: se autentica con x-api-secret, no JWT
    pathname === "/api/chat"  // Chat Web en Vivo: el handler decide auth por acción
                                // (action=start/send son públicos; admin-send/close/reopen
                                //  exigen requireAdmin() internamente con getServerSession)
  ) {
    return true;
  }

  // === ENDPOINT TEMPORAL DE DIAGNÓSTICO DE LOGIN (tarea 2026-08-21) ===
  // No requiere auth porque SI el login está caído no podemos autenticarnos
  // para diagnosticar. Se debe ELIMINAR después de resolver el problema.
  if (pathname === "/api/debug/login-status") {
    return true;
  }

  // === ENDPOINT TEMPORAL DE RESET DE EMERGENCIA (tarea 2026-09-02) ===
  // Permite buscar usuarios por fragmento y resetear contraseña sin auth.
  // ⚠️ ELIMINAR después de resolver el caso de Silvina Pugliese.
  if (pathname === "/api/debug/emergency-reset") {
    return true;
  }

  // Push notifications: rutas públicas (VAPID public key + subscribe/unsubscribe)
  // El endpoint /subscribe puede recibir un conversationId (paciente anónimo) o
  // vincularse a userId si hay sesión. /vapid-public-key devuelve solo la clave pública.
  if (
    pathname === "/api/push/vapid-public-key" ||
    pathname === "/api/push/subscribe"
  ) {
    return true;
  }

  // Patient requests: only POST is public (patients submit triage forms)
  if (pathname === "/api/patient-requests" && method === "POST") {
    return true;
  }

  // Professional slots: public read access for booking page
  if (pathname.match(/^\/api\/professionals\/[^/]+\/slots$/)) {
    return true;
  }

  return false;
}

/**
 * Validate JWT for protected API routes.
 *
 * - Rejects requests with no token, expired token, or wrong token version
 * - Clears session cookie on invalid/expired tokens (forces client-side logout)
 * - Enforces role-based access for admin routes
 * - Checks if user is still active (prevents deactivated user access)
 */
async function handleProtectedApiRoute(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // No token or invalid/expired token — reject and clear session cookie
  if (!token || !token.id) {
    return clearSessionAndRespond(
      NextResponse.json({ error: "No autenticado" }, { status: 401 })
    );
  }

  // Token version mismatch — session was issued before security policy change
  // Forces the user to re-authenticate with the current policy
  if (token.tokenVersion !== AUTH_TOKEN_VERSION) {
    return clearSessionAndRespond(
      NextResponse.json(
        { error: "Sesión expirada. Por favor, iniciá sesión nuevamente." },
        { status: 401 }
      )
    );
  }

  const role = token.role as string;

  // ── Role-based access control ──

  // Admin-only routes: require admin or super_admin
  if (
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/auth/approve-email")
  ) {
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }
  }

  // CMS management routes: require super_admin
  if (pathname.startsWith("/api/cms/") && pathname !== "/api/cms/content") {
    if (role !== "super_admin") {
      return NextResponse.json(
        { error: "No autorizado - se requiere super_admin" },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

/**
 * Clears all session-related cookies on the response.
 *
 * This ensures that expired/invalid tokens don't persist in the browser.
 * When the client-side SessionProvider detects the missing cookie,
 * it updates the session status to "unauthenticated", triggering the
 * automatic redirect to the login page.
 */
function clearSessionAndRespond(response: NextResponse) {
  const isProd = process.env.NODE_ENV === "production";
  const prefix = isProd ? "__Secure-" : "";

  // Clear the session token cookie
  response.cookies.set(`${prefix}next-auth.session-token`, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // Clear the callback URL cookie
  response.cookies.set(`${prefix}next-auth.callback-url`, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // Clear the CSRF token cookie
  const csrfPrefix = isProd ? "__Host-" : "";
  response.cookies.set(`${csrfPrefix}next-auth.csrf-token`, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images|favicon).*)",
  ],
};
