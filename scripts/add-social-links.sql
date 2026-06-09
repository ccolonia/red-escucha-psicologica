-- ============================================================
-- Script: Insertar claves de redes sociales en CmsSiteConfig
-- Proyecto: Red Escucha Psicológica (REP)
-- Fecha: 2026-06-10
-- Descripción: Agrega las 4 claves de redes sociales
--   con valor vacío (para que no se muestren por defecto)
--   en el grupo "social" de CmsSiteConfig.
-- ============================================================

-- Usar upsert para evitar errores si ya existen
INSERT INTO "CmsSiteConfig" (id, key, value, group, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'social_facebook_url', '', 'social', NOW(), NOW()),
  (gen_random_uuid(), 'social_instagram_url', '', 'social', NOW(), NOW()),
  (gen_random_uuid(), 'social_tiktok_url', '', 'social', NOW(), NOW()),
  (gen_random_uuid(), 'social_linkedin_url', '', 'social', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  group = EXCLUDED.group,
  "updatedAt" = NOW();
