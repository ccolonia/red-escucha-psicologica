import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ============================================================================
// GET /api/debug/login-status
//
// ENDPOINT TEMPORAL DE DIAGNÓSTICO — NO requiere autenticación.
// Verifica:
//   1. Conexión a la base de datos (Neon Postgres)
//   2. Cantidad de usuarios activos/inactivos
//   3. Estado específico del usuario admin (si se pasa ?email=...)
//   4. Formato del hash de contraseña (sin exponer el hash real)
//
// Uso:
//   - /api/debug/login-status           → diagnóstico general de DB
//   - /api/debug/login-status?email=X   → diagnóstico de un usuario específico
//
// Este endpoint se debe ELIMINAR después de resolver el problema de login.
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const emailParam = searchParams.get("email")?.trim().toLowerCase() || null;

  const result: {
    timestamp: string;
    dbConnection: "OK" | "FAILED" | "PENDING";
    dbError?: string;
    totalUsers?: number;
    activeUsers?: number;
    inactiveUsers?: number;
    userFound?: boolean;
    userDetails?: {
      email: string;
      role: string;
      active: boolean;
      isApproved: boolean;
      passwordFormat: "hashed-bcrypt" | "plaintext" | "empty" | "unknown";
      passwordLength: number;
      hasAccessedPanel: boolean;
      createdAt: string;
    };
    recommendation?: string;
  } = {
    timestamp: new Date().toISOString(),
    dbConnection: "PENDING",
  };

  // === 1. Test de conexión a DB ===
  try {
    // Consulta simple para verificar que Prisma + Neon anden
    const userCount = await db.user.count();
    result.dbConnection = "OK";
    result.totalUsers = userCount;

    // Contar activos/inactivos
    const [activeCount, inactiveCount] = await Promise.all([
      db.user.count({ where: { active: true } }),
      db.user.count({ where: { active: false } }),
    ]);
    result.activeUsers = activeCount;
    result.inactiveUsers = inactiveCount;

    // === 2. Si se pasó email, diagnosticar ese usuario específico ===
    if (emailParam) {
      const user = await db.user.findUnique({
        where: { email: emailParam },
        select: {
          email: true,
          role: true,
          active: true,
          isApproved: true,
          password: true,
          hasAccessedPanel: true,
          createdAt: true,
        },
      });

      if (!user) {
        result.userFound = false;
        result.recommendation = `No se encontró usuario con email "${emailParam}". Verificá que el email esté bien escrito y que exista en la tabla User.`;
      } else {
        result.userFound = true;

        // Determinar formato del password SIN exponerlo
        let passwordFormat: "hashed-bcrypt" | "plaintext" | "empty" | "unknown" = "unknown";
        if (!user.password) {
          passwordFormat = "empty";
        } else if (/^\$2[aby]\$\d{2}\$/.test(user.password)) {
          passwordFormat = "hashed-bcrypt";
        } else {
          passwordFormat = "plaintext";
        }

        result.userDetails = {
          email: user.email,
          role: user.role,
          active: user.active,
          isApproved: user.isApproved,
          passwordFormat,
          passwordLength: user.password?.length || 0,
          hasAccessedPanel: user.hasAccessedPanel,
          createdAt: user.createdAt.toISOString(),
        };

        // Generar recomendación según el estado
        if (!user.active) {
          result.recommendation = `⚠️ PROBLEMA DETECTADO: el usuario está INACTIVO (active=false). Esto bloquea el login. Posible causa: se aplicó el módulo de Baja Institucional accidentalmente. Fix: ejecutar UPDATE "User" SET active=true WHERE email='${emailParam}';`;
        } else if (!user.isApproved && user.role === "professional") {
          result.recommendation = `⚠️ PROBLEMA DETECTADO: el profesional no está aprobado (isApproved=false). Fix: ejecutar UPDATE "User" SET "isApproved"=true WHERE email='${emailParam}';`;
        } else if (passwordFormat === "empty") {
          result.recommendation = `⚠️ PROBLEMA DETECTADO: el usuario no tiene password seteado. Fix: ejecutar el flujo de reset password.`;
        } else if (passwordFormat === "plaintext") {
          result.recommendation = `⚠️ OK pero legacy: el password está en plaintext (no hasheado). Se auto-upgradeará a bcrypt en el próximo login exitoso.`;
        } else {
          result.recommendation = `✅ Usuario OK: activo, password hasheado con bcrypt. Si el login sigue fallando, el problema es la contraseña ingresada (no coincide con el hash). Probá resetear la contraseña.`;
        }
      }
    }
  } catch (dbError) {
    result.dbConnection = "FAILED";
    result.dbError = dbError instanceof Error ? dbError.message : String(dbError);
    result.recommendation = `🚨 CONEXIÓN A DB CAÍDA: Prisma no puede conectar a Neon Postgres. Verificá DATABASE_URL en Vercel Environment Variables. Error real: ${result.dbError}`;
  }

  return NextResponse.json(result, { status: 200 });
}
