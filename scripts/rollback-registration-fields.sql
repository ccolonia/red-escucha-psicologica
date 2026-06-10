-- ============================================================
-- Rollback: Eliminar funcionalidad de Campos de Registro Dinámicos
-- Ejecutar en producción ANTES de hacer deploy del código nuevo
-- ============================================================

-- 1. Eliminar la tabla CmsRegistrationField por completo
DROP TABLE IF EXISTS "CmsRegistrationField";

-- 2. Eliminar la columna dynamicData del modelo Professional
ALTER TABLE "Professional" DROP COLUMN IF EXISTS "dynamicData";
