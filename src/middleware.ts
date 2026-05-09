import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Public routes that don't require authentication
const publicRoutes = ["/", "/api/auth/register", "/api/auth/[...nextauth]", "/api/contact", "/api/professionals/[id]/slots"];

// API routes that require specific roles
const adminOnlyRoutes = ["/api/admin", "/api/auth/approve-email", "/api/contact/[id]", "/api/patients"];
const professionalOrAdminRoutes = ["/api/patients"];

export async function middleware(request: NextRequest) {
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

  // Allow public API routes
  if (pathname === "/api" || pathname === "/api/auth/register" || pathname.startsWith("/api/auth/[...nextauth]") || pathname === "/api/contact") {
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
      if (role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    return NextResponse.next();
  }

  // For non-API routes, just continue (client-side handles auth UI)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - images (public images)
     * - favicon (favicon files)
     */
    "/((?!_next/static|_next/image|images|favicon).*)",
  ],
};
