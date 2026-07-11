-- === Agregar campo DNI al modelo Patient ===
-- DNI argentino: 7-8 dígitos numéricos (sin puntos ni guiones)
-- Ej: 12345678, 34567890. Null si el paciente todavía no cargó su DNI.

ALTER TABLE "Patient"
  ADD COLUMN "dni" TEXT;
