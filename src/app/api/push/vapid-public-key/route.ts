import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/push/vapid-public-key
// Devuelve la VAPID public key para que el cliente pueda suscribirse.
// Es PÚBLICO por diseño (no es sensible, va embebida en el cliente).
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "Push notifications no configuradas" }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}
