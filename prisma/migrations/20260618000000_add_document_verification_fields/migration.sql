-- AlterTable: agregar 5 nuevos campos booleanos de verificación de
-- documentación al modelo Professional. licenseVerified ya existe
-- (matrícula) y se reutiliza.
--
-- Todos los campos nuevos tienen default false porque los profesionales
-- existentes todavía no pasaron por la auditoría documental.
--
-- Estos campos son accedidos y mutados EXCLUSIVAMENTE por admin/super_admin.
-- Los endpoints públicos usan select explícito y NO los exponen al frontend
-- del usuario común (ver GET /api/professionals y PATCH /api/professionals).

ALTER TABLE "Professional"
  ADD COLUMN "dniVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "degreeVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "malpracticeInsuranceVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taxRegistrationVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "nationalRegistryVerified" BOOLEAN NOT NULL DEFAULT false;
