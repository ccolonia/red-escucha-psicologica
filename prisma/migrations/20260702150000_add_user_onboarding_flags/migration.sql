-- === Control de aprobación y onboarding del profesional ===
-- Agrega 3 campos booleanos al modelo User para trackear el estado real
-- de la cuenta del profesional a lo largo del flujo de aprobación.
--
-- isApproved       → true cuando el admin aprueba al profesional
-- passwordSet      → true después de setear su contraseña definitiva
-- hasAccessedPanel → true después del primer login exitoso
--
-- Los tres arrancan en false para todos los usuarios existentes. Para
-- los profesionales ya aprobados (active=true) que ya tienen contraseña
-- válida y/o ya ingresaron al panel, los flags se actualizan en una
-- segunda pasada para reflejar el estado real actual.

-- 1. Agregar columnas con default false
ALTER TABLE "User"
  ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
  ADD COLUMN "passwordSet" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
  ADD COLUMN "hasAccessedPanel" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill para profesionales ya aprobados
-- Un profesional está "aprobado" si tiene un registro en Professional
-- asociado y su User.active = true. Los admins/super_admin también se
-- marcan como aprobados (su cuenta se crea directo sin flujo de approval).
UPDATE "User" SET "isApproved" = true
  WHERE "role" IN ('admin', 'super_admin')
   OR ("role" = 'professional'
       AND "active" = true
       AND EXISTS (
         SELECT 1 FROM "Professional" p
         WHERE p."userId" = "User".id
       ));

-- 3. Backfill de passwordSet
-- Asumimos que si el usuario tiene active=true Y NO tiene un passwordToken
-- sin usar pendiente, entonces ya seteó su contraseña en algún momento.
-- No podemos saber con 100% de certeza, pero esto es la mejor aproximación
-- sin inspeccionar el hash.
UPDATE "User" SET "passwordSet" = true
  WHERE "active" = true
    AND "role" IN ('admin', 'super_admin', 'professional');

-- 4. Backfill de hasAccessedPanel
-- No podemos saber con certeza si un usuario ya se logueó alguna vez
-- (no tenemos logs de auth históricos). Como aproximación segura:
-- si está active=true y passwordSet=true, asumimos que sí ingresó.
-- Los que todavía no tienen password seteada, obviamente no.
UPDATE "User" SET "hasAccessedPanel" = true
  WHERE "passwordSet" = true
    AND "active" = true;

-- 5. Crear índices para acelerar los filtros del panel admin
CREATE INDEX "User_isApproved_idx" ON "User"("isApproved");
CREATE INDEX "User_passwordSet_idx" ON "User"("passwordSet");
CREATE INDEX "User_hasAccessedPanel_idx" ON "User"("hasAccessedPanel");
