import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Minimal interface that all CMS Prisma delegates satisfy */
interface ModelDelegate {
  findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
  findUnique: (args: { where: Record<string, unknown> }) => Promise<unknown | null>;
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  delete: (args: { where: Record<string, unknown> }) => Promise<unknown>;
}

interface ListOptions {
  /** Prisma `orderBy` argument (default: `{ order: "asc" }`) */
  orderBy?: Record<string, string>;
  /** Prisma `include` argument for related models */
  include?: Record<string, unknown>;
}

// ─── List Handlers (GET + POST) ─────────────────────────────────────────────

/**
 * Creates GET and POST route handlers for a CMS collection endpoint.
 *
 * - **GET**  → lists all items ordered by the given field (default: `order` asc)
 * - **POST** → creates a new item from the JSON body
 */
export function createListHandlers(delegate: ModelDelegate, options?: ListOptions) {
  const orderBy = options?.orderBy ?? { order: "asc" };
  const include = options?.include;

  async function GET() {
    try {
      const args: Record<string, unknown> = { orderBy };
      if (include) args.include = include;

      const items = await delegate.findMany(args);
      return NextResponse.json(items);
    } catch (error) {
      console.error("CMS list error:", error);
      return NextResponse.json(
        { error: "Error al obtener los elementos" },
        { status: 500 },
      );
    }
  }

  async function POST(request: NextRequest) {
    try {
      const body = await request.json();
      // Strip empty id so Prisma auto-generates a CUID via @default(cuid())
      if (!body.id) delete body.id;
      const item = await delegate.create({ data: body });
      revalidatePath("/");
      return NextResponse.json(item, { status: 201 });
    } catch (error: unknown) {
      const prismaError = error as { code?: string; meta?: unknown; message?: string };
      console.error("CMS create error:", {
        code: prismaError.code,
        meta: prismaError.meta,
        message: prismaError.message,
      });
      return NextResponse.json(
        { error: "Error al crear el elemento", detail: prismaError.code || "unknown" },
        { status: 500 },
      );
    }
  }

  return { GET, POST };
}

// ─── Item Handlers (PUT + DELETE) ───────────────────────────────────────────

/**
 * Creates PUT and DELETE route handlers for a CMS item endpoint.
 *
 * - **PUT**    → updates the item identified by `id` param
 * - **DELETE** → deletes the item identified by `id` param
 */
export function createItemHandlers(delegate: ModelDelegate) {
  async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;

      // ID validation: all CMS models use String @id @default(cuid()) — never parseInt
      if (!id || typeof id !== "string") {
        return NextResponse.json(
          { error: "ID inválido" },
          { status: 400 },
        );
      }

      const body = await request.json();

      const existing = await delegate.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: "Elemento no encontrado", detail: "P2025" },
          { status: 404 },
        );
      }

      const updated = await delegate.update({ where: { id }, data: body });
      revalidatePath("/");
      return NextResponse.json(updated);
    } catch (error: unknown) {
      const prismaError = error as { code?: string; meta?: unknown; message?: string };
      console.error("CMS update error:", {
        code: prismaError.code,
        meta: prismaError.meta,
        message: prismaError.message,
      });
      return NextResponse.json(
        { error: "Error al actualizar el elemento", detail: prismaError.code || "unknown" },
        { status: 500 },
      );
    }
  }

  async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const { id } = await params;

      // ID validation: all CMS models use String @id @default(cuid()) — never parseInt
      if (!id || typeof id !== "string") {
        return NextResponse.json(
          { error: "ID inválido" },
          { status: 400 },
        );
      }

      const existing = await delegate.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: "Elemento no encontrado", detail: "P2025" },
          { status: 404 },
        );
      }

      await delegate.delete({ where: { id } });
      revalidatePath("/");
      return NextResponse.json({ message: "Elemento eliminado exitosamente" });
    } catch (error: unknown) {
      const prismaError = error as { code?: string; meta?: unknown; message?: string };
      console.error("Error en Prisma al eliminar elemento CMS:", {
        code: prismaError.code,
        meta: prismaError.meta,
        message: prismaError.message,
      });

      // Map known Prisma error codes
      if (prismaError.code === "P2025") {
        return NextResponse.json(
          { error: "Elemento no encontrado (P2025)", detail: "P2025" },
          { status: 404 },
        );
      }
      if (prismaError.code === "P2003") {
        return NextResponse.json(
          { error: "No se puede eliminar: existen datos vinculados (P2003)", detail: "P2003" },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "Error al eliminar el elemento", detail: prismaError.code || "unknown" },
        { status: 500 },
      );
    }
  }

  return { PUT, DELETE };
}

// ─── Convenience: wire delegate from db ─────────────────────────────────────

/** Map of model names to their Prisma delegates, for type-safe access */
export const cmsModels = {
  heroSlide: db.cmsHeroSlide,
  specialtyTab: db.cmsSpecialtyTab,
  specialty: db.cmsSpecialty,
  philosophy: db.cmsPhilosophy,
  step: db.cmsStep,
  stat: db.cmsStat,
  testimonial: db.cmsTestimonial,
  siteConfig: db.cmsSiteConfig,
} as const;
