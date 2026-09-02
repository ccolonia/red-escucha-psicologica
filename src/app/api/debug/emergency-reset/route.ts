import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ============================================================================
// POST /api/debug/emergency-reset
//
// ENDPOINT TEMPORAL DE EMERGENCIA — requiere autenticación de admin.
// Permite:
//   1. Buscar usuarios por fragmento de email (búsqueda parcial)
//   2. Reactivar usuario (active=true, isApproved=true)
//   3. Resetear contraseña a un valor temporal
//
// Payload:
//   { action: "search", query: "silvina" }
//   → busca usuarios cuyo email contenga el fragmento
//
//   { action: "reset", email: "exact@email.com", tempPassword: "Silvina2026!" }
//   → reactiva el usuario + setea nueva contraseña hasheada
//
// ⚠️ ELIMINAR este endpoint después de resolver la emergencia.
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // === Auth: requiere admin ===
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden usar este endpoint" },
        { status: 403 }
      );
    }

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

      // Buscar usuarios cuyo email contenga el fragmento
      const users = await db.user.findMany({
        where: {
          email: { contains: query, mode: "insensitive" },
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
          // NO seleccionamos password por seguridad
        },
        take: 20,
      });

      return NextResponse.json({
        query,
        results: users.map(u => ({
          ...u,
          // Información útil para diagnóstico SIN exponer password
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

      // Buscar usuario
      const user = await db.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true, active: true, isApproved: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: `No se encontró usuario con email "${email}"` },
          { status: 404 }
        );
      }

      // Hashear la contraseña temporal
      const hashedPassword = await hashPassword(tempPassword);

      // Actualizar: reactivar + nueva contraseña + marcar como passwordSet
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
