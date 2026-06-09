import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint - returns active registration fields for the professional form
export async function GET() {
  try {
    const fields = await db.cmsRegistrationField.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });

    // Parse options JSON for select fields
    const parsed = fields.map((field) => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : null,
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error fetching registration fields:", error);
    // Return empty array so the form still works with defaults
    return NextResponse.json([], { status: 200 });
  }
}
