import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint - returns social media links for the footer
export async function GET() {
  try {
    const socialKeys = [
      "social_facebook_url",
      "social_instagram_url",
      "social_tiktok_url",
      "social_linkedin_url",
    ];

    const configs = await db.cmsSiteConfig.findMany({
      where: {
        key: { in: socialKeys },
      },
    });

    // Convert to a simple key-value object, only including non-empty values
    const result: Record<string, string> = {};
    for (const c of configs) {
      if (c.value && c.value.trim() !== "") {
        result[c.key] = c.value;
      }
    }

    return NextResponse.json({
      facebook: result.social_facebook_url || "",
      instagram: result.social_instagram_url || "",
      tiktok: result.social_tiktok_url || "",
      linkedin: result.social_linkedin_url || "",
    });
  } catch (error) {
    console.error("Error fetching social links:", error);
    // Return empty values instead of error so the footer still renders
    return NextResponse.json(
      { facebook: "", instagram: "", tiktok: "", linkedin: "" },
      { status: 200 }
    );
  }
}
