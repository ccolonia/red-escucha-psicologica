-- AlterTable: agregar campo otherTherapyDetails a Professional
--
-- otherTherapyDetails TEXT — Texto libre que el profesional carga en el
-- form de registro cuando selecciona "Otras terapias" en therapyTypes.
-- Es opcional (NULL) para los profesionales existentes y para los que
-- no eligieron "Otras terapias".
--
-- Justificación de diseño: se mantiene separado del array therapyTypes
-- (que es JSON string serializado) para no romper la pureza de los tags
-- y permitir que el frontend del admin lo muestre como un campo de
-- texto dedicado, no como un item más del array.

ALTER TABLE "Professional"
  ADD COLUMN "otherTherapyDetails" TEXT;
