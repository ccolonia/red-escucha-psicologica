-- AlterTable: Add modality column to Appointment
ALTER TABLE "Appointment" ADD COLUMN "modality" TEXT NOT NULL DEFAULT 'P';

-- CreateTable: ProfessionalSchedule
CREATE TABLE "ProfessionalSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professionalId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 45,
    "modality" TEXT NOT NULL DEFAULT 'ambas',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProfessionalSchedule_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ScheduleOverride
CREATE TABLE "ScheduleOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professionalId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "slotDuration" INTEGER,
    "modality" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleOverride_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: Unique schedule per professional/day/startTime
CREATE UNIQUE INDEX "ProfessionalSchedule_professionalId_dayOfWeek_startTime_key" ON "ProfessionalSchedule"("professionalId", "dayOfWeek", "startTime");
