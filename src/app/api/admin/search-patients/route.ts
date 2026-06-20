import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/search-patients?q=...
//
// Busca pacientes existentes por nombre, apellido o email para el
// autocompletado del Dialog de asignación rápida. Devuelve top 10
// resultados con id, name, email y phone para que el frontend pueda
// autocompletar el form.
//
// Response:
//   200 + [{ id, name, email, phone }] — lista de pacientes (máx 10)
//   401/403 — no autenticado / no admin
//   500 — error

export async function GET(request: NextRequest) {
  unstable_noStore();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user as { role: string }).role;
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    // Buscar pacientes por name o email del User asociado.
    // Usamos OR con contains insensitive para match flexible.
    const patients = await db.patient.findMany({
      where: {
        OR: [
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      take: 10,
      orderBy: { user: { name: "asc" } },
    });

    // Mapear a formato plano para el frontend
    const results = patients.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      email: p.user.email,
      phone: p.user.phone || "",
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in search-patients:", error);
    return NextResponse.json(
      { error: "Error al buscar pacientes" },
      { status: 500 }
    );
  }
}
