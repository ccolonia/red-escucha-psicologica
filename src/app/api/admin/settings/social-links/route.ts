import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Protected endpoint - updates social media links (super_admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role: string }).role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { facebook, instagram, tiktok, linkedin } = body;

    // Map friendly names to CmsSiteConfig keys
    const socialEntries = [
      { key: "social_facebook_url", value: (facebook as string) || "", group: "social" },
      { key: "social_instagram_url", value: (instagram as string) || "", group: "social" },
      { key: "social_tiktok_url", value: (tiktok as string) || "", group: "social" },
      { key: "social_linkedin_url", value: (linkedin as string) || "", group: "social" },
    ];

    // Upsert each social link config entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    for (const entry of socialEntries) {
      const result = await db.cmsSiteConfig.upsert({
        where: { key: entry.key },
        update: { value: entry.value, group: entry.group },
        create: { key: entry.key, value: entry.value, group: entry.group },
      });
      results.push(result);
    }

    return NextResponse.json({
      message: "Redes sociales actualizadas correctamente",
      data: {
        facebook: socialEntries[0].value,
        instagram: socialEntries[1].value,
        tiktok: socialEntries[2].value,
        linkedin: socialEntries[3].value,
      },
    });
  } catch (error) {
    console.error("Error updating social links:", error);
    return NextResponse.json(
      { error: "Error al actualizar las redes sociales" },
      { status: 500 }
    );
  }
}
