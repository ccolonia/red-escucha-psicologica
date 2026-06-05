import { db } from "@/lib/db";

export async function GET() {
  const schedules = await db.professionalSchedule.findMany({
    include: { professional: { include: { user: { select: { name: true } } } } },
    orderBy: [{ professional: { specialty: 'asc' } }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  const requests = await db.patientRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return Response.json({ schedules, requests });
}
