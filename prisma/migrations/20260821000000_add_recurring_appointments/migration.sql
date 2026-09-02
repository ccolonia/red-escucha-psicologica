-- ====================================================================
-- MIGRACIÓN: add_recurring_appointments
-- Tarea 2026-08-21
-- ====================================================================
-- Agrega soporte para series de turnos recurrentes (pacientes fijos),
-- feriados y ausencias de profesionales.
--
-- NUEVOS MODELOS:
--   1. RecurringSeries — serie de turnos semanales para un paciente fijo
--   2. Holiday — feriados nacionales/días no laborables
--   3. ProfessionalAbsence — ausencias programadas del profesional
--
-- CAMBIOS AL MODELO APPOINTMENT:
--   - seriesId: FK opcional hacia RecurringSeries
--   - isOverride: Boolean para sobreturnos manuales
--   - originalDate: fecha original para trazabilidad de reprogramaciones
--
-- NOTA: El campo status ya era String, así que los nuevos valores
-- (skipped_holiday, scheduled) son solo strings — no requieren cambio
-- en el schema, solo documentación en comentarios.
-- ====================================================================

-- === 1. Crear tabla RecurringSeries ===
CREATE TABLE "RecurringSeries" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "modality" TEXT NOT NULL DEFAULT 'P',
    "slotDuration" INTEGER NOT NULL DEFAULT 45,
    "direccionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- Foreign keys
    CONSTRAINT "RecurringSeries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringSeries_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE,

    -- Primary key
    CONSTRAINT "RecurringSeries_pkey" PRIMARY KEY ("id")
);

-- Índices para queries frecuentes
CREATE INDEX "RecurringSeries_professionalId_active_idx" ON "RecurringSeries"("professionalId", "active");
CREATE INDEX "RecurringSeries_patientId_active_idx" ON "RecurringSeries"("patientId", "active");
CREATE INDEX "RecurringSeries_dayOfWeek_active_idx" ON "RecurringSeries"("dayOfWeek", "active");

-- === 2. Crear tabla Holiday ===
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- Primary key
    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- Unique constraint en date (no puede haber dos feriados en la misma fecha)
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- === 3. Crear tabla ProfessionalAbsence ===
CREATE TABLE "ProfessionalAbsence" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- Foreign key
    CONSTRAINT "ProfessionalAbsence_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE,

    -- Primary key
    CONSTRAINT "ProfessionalAbsence_pkey" PRIMARY KEY ("id")
);

-- Índice para buscar ausencias por profesional en un rango de fechas
CREATE INDEX "ProfessionalAbsence_professionalId_startDate_endDate_idx" ON "ProfessionalAbsence"("professionalId", "startDate", "endDate");

-- === 4. Extender tabla Appointment con campos de recurrencia ===
-- Agregar columnas (sin valores default para seriesId y originalDate,
-- con default false para isOverride)
ALTER TABLE "Appointment" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "isOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN "originalDate" TEXT;

-- Foreign key: Appointment.seriesId → RecurringSeries.id
-- onDelete: SetNull — si se borra la serie, los turnos ya creados quedan (no se borran)
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "RecurringSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice para buscar turnos por serie (útil para ver todos los turnos de una serie)
CREATE INDEX "Appointment_seriesId_idx" ON "Appointment"("seriesId");
