import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// ============================================================================
// TEMPORARY DIAGNOSTIC ENDPOINT — DELETE AFTER USE
// ============================================================================
// This endpoint is protected by a one-time secret key.
// It is ONLY for diagnosing login failures for a specific user.
//
// It does NOT bypass the DB auth — it just queries the user state and tests
// password comparison, returning what's happening so we can diagnose.
//
// Usage:
//   GET /api/public/debug-login-diagnostic?email=...&secret=...
//   POST /api/public/debug-login-diagnostic
//     body: { email, testPassword, secret }
// ============================================================================

const EXPECTED_SECRET = "rep_diag_2026_09_24_k7m2p9";

function sanitize(s: string): string {
  return s?.trim().toLowerCase() || "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || "";
  const secret = searchParams.get("secret") || "";

  if (secret !== EXPECTED_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return diagnoseUser(email);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { email, testPassword, secret } = body as { email?: string; testPassword?: string; secret?: string };

  if (secret !== EXPECTED_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return diagnoseUser(email || "", testPassword);
}

async function diagnoseUser(rawEmail: string, testPassword?: string) {
  if (!rawEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = sanitize(rawEmail);

  try {
    // === Step 1: search user with case-insensitive findFirst (same as auth.ts) ===
    const user = await db.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        isApproved: true,
        passwordSet: true,
        hasAccessedPanel: true,
        password: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        diagnosis: "USER_NOT_FOUND",
        message: `No se encontró ningún usuario con email "${normalizedEmail}" (case-insensitive).`,
        normalizedEmailSearched: normalizedEmail,
        step: "findFirst",
      });
    }

    // === Step 2: check active flag ===
    const activeBlockReason = !user.active ? "USER_INACTIVE" : null;

    // === Step 3: check if password is hashed ===
    const isHashed = /^\$2[aby]\$\d{2}\$/.test(user.password);
    const passwordLength = user.password?.length || 0;

    // === Step 4: if testPassword provided, try comparing ===
    let passwordTestResult: { tested: boolean; isValid?: boolean; error?: string; note?: string } = { tested: false };
    if (testPassword) {
      try {
        if (isHashed) {
          const isValid = await bcrypt.compare(testPassword, user.password);
          passwordTestResult = { tested: true, isValid };
        } else {
          // Plaintext (legacy)
          passwordTestResult = {
            tested: true,
            isValid: user.password === testPassword,
            note: "Password is plaintext (not hashed) — should auto-upgrade on next successful login",
          };
        }
      } catch (err) {
        passwordTestResult = { tested: true, error: String(err) };
      }
    }

    // === Step 5: check related professional record ===
    const professional = await db.professional.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        license: true,
        specialty: true,
        licenseVerified: true,
        available: true,
      },
    });

    // === Step 6: check PasswordTokens (password reset links) ===
    const activeTokens = await db.passwordToken.findMany({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        used: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const allTokens = await db.passwordToken.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        used: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      diagnosis: activeBlockReason || (passwordTestResult.isValid === false ? "WRONG_PASSWORD" : "OK"),
      user: {
        id: user.id,
        email: user.email, // exact casing in DB
        name: user.name,
        role: user.role,
        active: user.active,
        isApproved: user.isApproved,
        passwordSet: user.passwordSet,
        hasAccessedPanel: user.hasAccessedPanel,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      passwordInfo: {
        length: passwordLength,
        isHashed,
        prefix: user.password?.substring(0, 4) || null, // $2a$ / $2b$ / $2y$ — safe to expose prefix
        testedAgainstInput: passwordTestResult.tested,
        testResult: passwordTestResult.isValid === undefined ? null : passwordTestResult.isValid,
        testError: passwordTestResult.error || null,
        testNote: passwordTestResult.note || null,
      },
      professional: professional
        ? {
            id: professional.id,
            license: professional.license,
            specialty: professional.specialty,
            licenseVerified: professional.licenseVerified,
            available: professional.available,
          }
        : null,
      passwordTokens: {
        activeCount: activeTokens.length,
        active: activeTokens,
        recentHistory: allTokens,
      },
      // === Auth flow simulation ===
      flowSimulation: {
        step1_normalize: `Input "${rawEmail}" → normalized "${normalizedEmail}"`,
        step2_findFirst: `findFirst with mode:insensitive → found user (email casing in DB: "${user.email}")`,
        step3_active_check: user.active ? "PASS" : "FAIL — user.active is false",
        step4_password: passwordTestResult.tested
          ? passwordTestResult.isValid
            ? "PASS — bcrypt.compare returned true"
            : "FAIL — bcrypt.compare returned false (wrong password)"
          : "SKIPPED — no testPassword provided in request",
        step5_login: user.active && (passwordTestResult.tested ? passwordTestResult.isValid : true)
          ? "✅ Would log in"
          : "❌ Would be rejected",
      },
    });
  } catch (err) {
    return NextResponse.json({
      diagnosis: "ERROR",
      error: String(err),
      stack: err instanceof Error ? err.stack : null,
    }, { status: 500 });
  }
}
