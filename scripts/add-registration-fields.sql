-- ============================================================
-- Script: Crear tabla CmsRegistrationField y seed inicial
-- Proyecto: Red Escucha Psicológica (REP)
-- Fecha: 2026-06-10
-- Descripción: Crear la tabla para campos dinámicos del
--   formulario de registro de profesionales, e insertar
--   los campos por defecto (Datos Personales).
-- ============================================================

-- NOTA: Esta tabla se crea automáticamente por Prisma migrate.
-- Si ya se corrió la migración, solo ejecutar los INSERT de abajo.

-- Seed de campos de registro por defecto
INSERT INTO "CmsRegistrationField" (id, label, "fieldKey", "fieldType", options, required, active, placeholder, "helperText", "order", section, "createdAt", "updatedAt")
VALUES
  ('reg-title', 'Título', 'title', 'select', '["Lic.","Dr.","Dra.","Ninguno"]', true, true, 'Seleccionar', NULL, 0, 'personal', NOW(), NOW()),
  ('reg-first-name', 'Nombre', 'first_name', 'text', NULL, true, true, 'Tu nombre', NULL, 1, 'personal', NOW(), NOW()),
  ('reg-last-name', 'Apellido', 'last_name', 'text', NULL, true, true, 'Tu apellido', NULL, 2, 'personal', NOW(), NOW()),
  ('reg-phone', 'Teléfono', 'phone', 'text', NULL, true, true, '1149999999 (sin 0 ni 15)', 'Ingresá tu número con código de área sin el 0 y sin el 15', 3, 'personal', NOW(), NOW()),
  ('reg-cuil', 'CUIT / CUIL', 'cuil', 'text', NULL, false, true, '20-12345678-9', NULL, 4, 'personal', NOW(), NOW()),
  ('reg-gender', 'Sexo', 'gender', 'select', '["Femenino","Masculino","Otro"]', false, true, 'Seleccionar', NULL, 5, 'personal', NOW(), NOW())
ON CONFLICT ("fieldKey") DO UPDATE SET
  label = EXCLUDED.label,
  "fieldType" = EXCLUDED."fieldType",
  options = EXCLUDED.options,
  required = EXCLUDED.required,
  placeholder = EXCLUDED.placeholder,
  "helperText" = EXCLUDED."helperText",
  "order" = EXCLUDED."order",
  section = EXCLUDED.section,
  "updatedAt" = NOW();
