import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint - returns all CMS content for the landing page
export async function GET() {
  try {
    const [
      heroSlides,
      specialtyTabs,
      specialties,
      philosophies,
      steps,
      stats,
      testimonials,
      siteConfigs,
    ] = await Promise.all([
      db.cmsHeroSlide.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      db.cmsSpecialtyTab.findMany({ where: { active: true }, orderBy: { order: "asc" }, include: { specialties: { where: { active: true }, orderBy: { order: "asc" } } } }),
      db.cmsSpecialty.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      db.cmsPhilosophy.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      db.cmsStep.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      db.cmsStat.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      db.cmsTestimonial.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      db.cmsSiteConfig.findMany(),
    ]);

    // Convert siteConfigs array to key-value object
    const config: Record<string, string> = {};
    for (const c of siteConfigs) {
      config[c.key] = c.value;
    }

    return NextResponse.json({
      heroSlides,
      specialtyTabs,
      specialties,
      philosophies,
      steps,
      stats,
      testimonials,
      config,
    });
  } catch (error) {
    console.error("Error fetching CMS content:", error);
    return NextResponse.json({ error: "Error fetching content" }, { status: 500 });
  }
}
