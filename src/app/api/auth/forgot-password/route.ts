import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "El email es requerido" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Anti-enumeration: Always respond with the same generic success message
    // regardless of whether the email exists in the database.
    const genericResponse = NextResponse.json({
      message: "Si el correo está registrado, recibirás un enlace de recuperación",
    });

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If user doesn't exist, still return success to prevent enumeration
    if (!user) {
      console.log(`[forgot-password] Email not found: ${normalizedEmail}`);
      return genericResponse;
    }

    // Optional: Check if user is active — inactive users shouldn't get reset emails
    if (!user.active) {
      console.log(`[forgot-password] User inactive: ${normalizedEmail}`);
      return genericResponse;
    }

    // Invalidate any previous unused reset tokens for this user
    // to prevent multiple valid tokens from existing simultaneously
    await db.passwordToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true, // Mark previous tokens as used so they can't be reused
      },
    });

    // Generate token and send reset email
    try {
      await sendPasswordResetEmail({
        userEmail: user.email,
        userName: user.name,
        userId: user.id,
      });
      console.log(`[forgot-password] Reset email sent to: ${normalizedEmail}`);
    } catch (emailError) {
      // Log the error but still return generic success to prevent enumeration
      console.error("[forgot-password] Failed to send reset email:", emailError);
    }

    return genericResponse;
  } catch (error) {
    console.error("[forgot-password] Unexpected error:", error);
    // Even on unexpected errors, return generic message to prevent information leakage
    return NextResponse.json({
      message: "Si el correo está registrado, recibirás un enlace de recuperación",
    });
  }
}
