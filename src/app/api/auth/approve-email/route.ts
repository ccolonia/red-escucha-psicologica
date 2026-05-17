import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendApprovalEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session.user as { role: string }).role;
    if (!session?.user || (role !== "admin" && role !== "super_admin")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.role !== "professional") {
      return NextResponse.json({ error: "Solo se pueden enviar emails a profesionales" }, { status: 400 });
    }

    // Invalidate the current password with a secure random hash
    // (the professional will set their real password via the email link)
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const hashedRandomPassword = await hashPassword(randomPassword);
    await db.user.update({
      where: { id: userId },
      data: { password: hashedRandomPassword },
    });

    await sendApprovalEmail({
      userEmail: user.email,
      userName: user.name,
      userId: user.id,
    });

    return NextResponse.json({ message: "Email de aprobación enviado exitosamente" });
  } catch (error) {
    console.error("Approve email error:", error);
    return NextResponse.json(
      { error: "Error al enviar el email de aprobación" },
      { status: 500 }
    );
  }
}
