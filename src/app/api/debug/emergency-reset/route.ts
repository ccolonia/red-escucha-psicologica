import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

// ============================================================================
// POST /api/debug/emergency-reset
//
// ENDPOINT TEMPORAL DE EMERGENCIA
// Versión pública (sin auth) para resolver el caso de Silvina Pugliese.
// ⚠️ ELIMINAR después de resolver la emergencia.
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // === ACCIÓN 1: Búsqueda parcial ===
    if (action === "search") {
      const query = body.query?.trim().toLowerCase();
      if (!query || query.length < 3) {
        return NextResponse.json(
          { error: "Query debe tener al menos 3 caracteres" },
          { status: 400 }
        );
      }

      const users = await db.user.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          isApproved: true,
          hasAccessedPanel: true,
          createdAt: true,
        },
        take: 30,
      });

      return NextResponse.json({
        query,
        results: users.map(u => ({
          ...u,
          status: !u.active ? "INACTIVO" : u.role === "professional" && !u.isApproved ? "NO_APROBADO" : "OK",
        })),
        count: users.length,
      });
    }

    // === ACCIÓN 2: Reset de contraseña ===
    if (action === "reset") {
      const email = body.email?.trim().toLowerCase();
      const tempPassword = body.tempPassword;

      if (!email || !tempPassword || tempPassword.length < 6) {
        return NextResponse.json(
          { error: "Email y tempPassword (mín 6 caracteres) son requeridos" },
          { status: 400 }
        );
      }

      // Búsqueda case-insensitive (el email en DB puede tener mayúsculas)
      const user = await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, email: true, name: true, role: true, active: true, isApproved: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: `No se encontró usuario con email "${email}"` },
          { status: 404 }
        );
      }

      const hashedPassword = await hashPassword(tempPassword);

      await db.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          active: true,
          isApproved: true,
          passwordSet: true,
          hasAccessedPanel: true,
        },
      });

      console.log(`[emergency-reset] ✅ Usuario ${email} reactivado con nueva contraseña temporal`);

      return NextResponse.json({
        success: true,
        user: {
          email: user.email,
          name: user.name,
          role: user.role,
          wasActive: user.active,
          wasApproved: user.isApproved,
        },
        message: `Usuario reactivado. Contraseña temporal seteada: "${tempPassword}". El usuario ya puede iniciar sesión.`,
      });
    }

    return NextResponse.json(
      { error: "Acción no válida. Usar 'search' o 'reset'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[emergency-reset] Error:", error);
    return NextResponse.json(
      { error: "Error en el endpoint de emergencia", detail: String(error) },
      { status: 500 }
    );
  }
}

// === GET: búsqueda rápida sin body (para usar directo desde el browser) ===
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim().toLowerCase();
    const resetEmail = searchParams.get("reset")?.trim().toLowerCase();
    const tempPass = searchParams.get("pass");

    // === Si se pasa ?reset=email&pass=password → reset directo ===
    if (resetEmail && tempPass) {
      // Búsqueda case-insensitive (el email en DB puede tener mayúsculas)
      const user = await db.user.findFirst({
        where: { email: { equals: resetEmail, mode: "insensitive" } },
        select: { id: true, email: true, name: true, role: true, active: true, isApproved: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: `No se encontró usuario con email "${resetEmail}"` },
          { status: 404 }
        );
      }

      const hashedPassword = await hashPassword(tempPass);
      await db.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          active: true,
          isApproved: true,
          passwordSet: true,
          hasAccessedPanel: true,
        },
      });

      return NextResponse.json({
        success: true,
        user: { email: user.email, name: user.name, role: user.role },
        message: `✅ Usuario reactivado. Contraseña: "${tempPass}"`,
      });
    }

    // === Si se pasa ?q=fragmento → búsqueda ===
    if (query && query.length >= 3) {
      const users = await db.user.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          isApproved: true,
          hasAccessedPanel: true,
        },
        take: 30,
      });

      return NextResponse.json({
        query,
        results: users.map(u => ({
          ...u,
          status: !u.active ? "INACTIVO" : u.role === "professional" && !u.isApproved ? "NO_APROBADO" : "OK",
        })),
        count: users.length,
      });
    }

    return NextResponse.json({
      usage: "GET /api/debug/emergency-reset?q=silvina (búsqueda) o GET /api/debug/emergency-reset?reset=email&pass=password (reset directo)"
    });
  } catch (error) {
    console.error("[emergency-reset GET] Error:", error);
    return NextResponse.json(
      { error: "Error", detail: String(error) },
      { status: 500 }
    );
  }
}
