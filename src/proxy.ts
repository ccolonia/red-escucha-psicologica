import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, _next, and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // static file
  ) {
    return NextResponse.next();
  }

  // Allow public API routes (no auth required)
  if (
    pathname === "/api" ||
    pathname.startsWith("/api/auth/") || // NextAuth routes: /api/auth/callback/credentials, /api/auth/session, etc.
    pathname === "/api/auth/register" ||
    pathname === "/api/contact" ||
    pathname === "/api/patient-requests" && request.method === "POST" || // Public: patients can submit requests
    pathname === "/api/cms/content" || // Public CMS content endpoint
    pathname.match(/^\/api\/professionals\/[^/]+\/slots$/) // professional slots
  ) {
    return NextResponse.next();
  }

  // Allow set-password page (token-based auth, not session-based)
  if (pathname === "/set-password") {
    return NextResponse.next();
  }

  // Check authentication for API routes
  if (pathname.startsWith("/api/")) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const role = token.role as string;

    // Admin-only routes
    if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/auth/approve-email")) {
      if (role !== "admin" && role !== "super_admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    // CMS routes require super_admin
    if (pathname.startsWith("/api/cms/") && pathname !== "/api/cms/content") {
      if (role !== "super_admin") {
        return NextResponse.json({ error: "No autorizado - se requiere super_admin" }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  // For non-API routes, just continue (client-side handles auth UI)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images|favicon).*)",
  ],
};
