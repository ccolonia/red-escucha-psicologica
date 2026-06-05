import { db } from "@/lib/db";

export async function GET() {
  const professionals = await db.professional.findMany({
    include: {
      user: { select: { name: true, email: true, active: true } },
      schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      overrides: { orderBy: { date: 'asc' } },
    },
  });

  const requests = await db.patientRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const appointments = await db.appointment.findMany({
    include: {
      patient: { include: { user: { select: { name: true } } } },
      professional: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return Response.json({ professionals, requests, appointments });
}
