import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/admin/lead-finder — Listar prospectos con filtros
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const region = searchParams.get("region") || "";
    const prospectRole = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }
    if (region) where.region = region;
    if (prospectRole) where.role = prospectRole;
    if (status) where.status = status;

    const prospects = await db.professionalProspect.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(prospects);
  } catch (error) {
    console.error("LeadFinder GET error:", error);
    return NextResponse.json({ error: "Error al obtener prospectos" }, { status: 500 });
  }
}

// POST /api/admin/lead-finder — Crear prospecto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const { fullName, email, phone, prospectRole, region, location, address, notes, source } = body;

    if (!fullName || !phone) {
      return NextResponse.json({ error: "Nombre y teléfono son obligatorios" }, { status: 400 });
    }

    const prospect = await db.professionalProspect.create({
      data: {
        fullName,
        email: email || null,
        phone,
        role: prospectRole || "PSYCHOLOGIST",
        region: region || "CABA",
        location: location || "",
        address: address || null,
        notes: notes || null,
        source: source || "MANUAL_ENTRY",
      },
    });

    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    console.error("LeadFinder POST error:", error);
    return NextResponse.json({ error: "Error al crear prospecto" }, { status: 500 });
  }
}

// PATCH /api/admin/lead-finder — Actualizar prospecto
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const { id, status, notes, fullName, email, phone, region, location, address } = body;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) data.email = email || null;
    if (phone !== undefined) data.phone = phone;
    if (region !== undefined) data.region = region;
    if (location !== undefined) data.location = location;
    if (address !== undefined) data.address = address || null;

    const updated = await db.professionalProspect.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("LeadFinder PATCH error:", error);
    return NextResponse.json({ error: "Error al actualizar prospecto" }, { status: 500 });
  }
}

// DELETE /api/admin/lead-finder?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    await db.professionalProspect.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LeadFinder DELETE error:", error);
    return NextResponse.json({ error: "Error al eliminar prospecto" }, { status: 500 });
  }
}
