import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: "No autenticado", status: 401 };
  }
  const role = (session.user as { role: string }).role;
  if (role !== "super_admin") {
    return { error: "No autorizado - se requiere super_admin", status: 403 };
  }
  return { session, role };
}
