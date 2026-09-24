import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { hashPassword } from "@/lib/password";
import { sendApprovalEmail } from "@/lib/email";

// ============================================================================
// TEMPORARY DIAGNOSTIC + FIX ENDPOINT — DELETE AFTER USE
// ============================================================================
// Protected by a one-time secret.
//
// Modes:
//   1. Diagnose (default): query user state, return what's blocking login.
//   2. Fix (fix=true): activate user, mark approved, invalidate password,
//      generate new PasswordToken, send approval email.
//
// Usage:
//   GET ?email=...&secret=...
//   GET ?email=...&secret=...&fix=true
//   POST { email, secret, fix?: true, testPassword?: string }
// ============================================================================

const EXPECTED_SECRET = "rep_diag_2026_09_24_k7m2p9";

function sanitize(s: string): string {
  return s?.trim().toLowerCase() || "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || "";
  const secret = searchParams.get("secret") || "";
  const fix = searchParams.get("fix") === "true";

  if (secret !== EXPECTED_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (fix) {
    return fixUser(email);
  }
  return diagnoseUser(email);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { email, testPassword, secret, fix } = body as { email?: string; testPassword?: string; secret?: string; fix?: boolean };

  if (secret !== EXPECTED_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (fix) {
    return fixUser(email || "");
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

// ============================================================================
// FIX MODE — activates user, marks approved, sends approval email
// ============================================================================
async function fixUser(rawEmail: string) {
  if (!rawEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = sanitize(rawEmail);

  try {
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
      },
    });

    if (!user) {
      return NextResponse.json({
        fixStatus: "FAILED",
        error: "USER_NOT_FOUND",
        message: `No se encontró usuario con email "${normalizedEmail}".`,
      }, { status: 404 });
    }

    if (user.role !== "professional") {
      return NextResponse.json({
        fixStatus: "FAILED",
        error: "NOT_A_PROFESSIONAL",
        message: `El usuario con ese email tiene rol "${user.role}", no "professional". El fix solo aplica a profesionales.`,
      }, { status: 400 });
    }

    // === Invalidate any previous unused password tokens ===
    await db.passwordToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: { used: true },
    });

    // === Generate random password (mirrors /api/admin/professionals/approve) ===
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const hashedRandomPassword = await hashPassword(randomPassword);

    // === Update user: activate + approve + invalidate password ===
    await db.user.update({
      where: { id: user.id },
      data: {
        active: true,
        isApproved: true,
        password: hashedRandomPassword,
      },
    });

    // === Send approval email (generates new PasswordToken + sends email) ===
    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendApprovalEmail({
        userEmail: user.email,
        userName: user.name,
        userId: user.id,
      });
      emailSent = true;
    } catch (err) {
      emailError = String(err);
    }

    return NextResponse.json({
      fixStatus: "SUCCESS",
      actions: {
        activated: !user.active, // was inactive before
        approved: !user.isApproved, // was unapproved before
        passwordInvalidated: true,
        previousTokensInvalidated: true,
        approvalEmailSent: emailSent,
        emailError,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: true, // now
        isApproved: true, // now
        passwordSet: false, // remains false until user sets it via the link
      },
      nextSteps: emailSent
        ? `El profesional recibió un email en ${user.email} con un link válido por 48hs para setear su contraseña definitiva. Después de setearla, podrá loguearse normalmente.`
        : `El usuario fue activado y aprobado pero el email no pudo enviarse. El admin debe usar "Reenviar Acceso" desde el panel.`,
    });
  } catch (err) {
    return NextResponse.json({
      fixStatus: "ERROR",
      error: String(err),
      stack: err instanceof Error ? err.stack : null,
    }, { status: 500 });
  }
}

