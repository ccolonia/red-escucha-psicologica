-- AlterTable: agregar campos de edad y tutor a PatientRequest
--
-- patientAge Int?    — Edad del paciente (1-120). Requerido por backend
--                      cuando la solicitud viene del form público con
--                      reason principal = "solicitar_turno".
-- guardianName String? — Nombre del adulto responsable si el paciente
--                      es menor de 18. Requerido por backend si
--                      patientAge < 18.
--
-- Ambos son opcionales en DB (Int? / String?) porque la validación se
-- hace en el backend, no en el schema. Esto permite que PatientRequests
-- creados por otros flujos (admin manual, etc.) no rompan.

ALTER TABLE "PatientRequest"
  ADD COLUMN "patientAge" INTEGER,
  ADD COLUMN "guardianName" TEXT;
