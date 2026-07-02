-- === Saneamiento de arrays legacy de tags ===
-- Resuelve el bug "Dirigido a" mostrando etiquetas raras en el panel admin
-- (Mayores, Niños, Familiar, Pareja, etc. — valores que ya NO existen en
-- las listas canónicas del formulario de registro).
--
-- Causa: registros previos al último ordenamiento/normalización de arrays
-- quedaron con valores sueltos en therapyTypes / targetAudience /
-- therapyModality que no coinciden con las opciones actuales. El admin
-- los muestra igual porque los lee tal cual están en la DB.
--
-- Solución: para cada array, dejar SOLO los valores que estén en la lista
-- canónica. Si después de filtrar queda vacío, setear a NULL.
--
-- Listas canónicas (deben coincidir con los arrays en professional-register.tsx):
--   targetAudience: Adolescentes, Adultos, Adultos mayores, Familias,
--                   Jóvenes, Niños/as, Orientación a padres, Parejas
--   therapyTypes: Adicciones, Deportología, EMDR, Logoterapia, Mindfulness,
--                 Neuropsicología, Otras terapias, Psicooncología, Psicoanálisis,
--                 Psicocorporal Reichiana, Psicodrama, Psicología clínica,
--                 Psicología deportiva, Psicología forense, Psicología geriátrica,
--                 Psicología laboral / organizacional, Psicología perinatal,
--                 Psicología positiva, Psicoterapia Integral, Psiconutrición,
--                 Terapia cognitivo-conductual, Terapia constructivista,
--                 Terapia gestáltica, Terapia humanista, Terapia junguiana,
--                 Terapia sistémica, Terapia transpersonal, Terapias vinculares,
--                 Trastornos alimentarios
--   therapyModality: Asesoría a Empresas, Discapacidad, Evaluaciones,
--                    Individual, Orientación a Padres, Orientación Vocacional,
--                    Pericias, Terapia Grupal, Vincular
--
-- Nota: NO tocamos 'zones' porque es una lista abierta (el profesional
-- puede tener cualquier zona geográfica) y 'specialty' porque es un
-- SELECT de un solo valor, no un array.
--
-- Implementación: usamos una función SQL que recibe el JSON string del
-- array y la lista canónica como arreglo PostgreSQL, filtra los valores
-- case-insensitive, y devuelve el JSON string saneado (o NULL si vacío).

-- Función helper: filtra un JSON array de strings dejando solo los
-- valores que están en la lista canónica (case-insensitive).
-- Devuelve NULL si el resultado es un array vacío.
CREATE OR REPLACE FUNCTION filter_json_array_to_canonical(
  raw_json TEXT,
  canonical TEXT[]
) RETURNS TEXT AS $$
DECLARE
  parsed JSONB;
  item TEXT;
  lower_canonical TEXT[];
  kept TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Si el campo está vacío o no es JSON válido, devolver NULL
  IF raw_json IS NULL OR trim(raw_json) = '' OR raw_json = 'null' THEN
    RETURN NULL;
  END IF;

  BEGIN
    parsed := raw_json::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END IF;

  -- Si no es un array, devolver NULL
  IF jsonb_typeof(parsed) <> 'array' THEN
    RETURN NULL;
  END IF;

  -- Precomputar la lista canónica en minúsculas para comparación case-insensitive
  SELECT array_agg(lower(c)) INTO lower_canonical FROM unnest(canonical) AS c;

  -- Iterar sobre los elementos del array
  FOR item IN SELECT jsonb_array_elements_text(parsed) LOOP
    IF item IS NOT NULL AND trim(item) <> ''
       AND lower(trim(item)) = ANY(lower_canonical) THEN
      kept := kept || trim(item);
    END IF;
  END LOOP;

  -- Si no quedó nada, devolver NULL. Si no, devolver como JSON string.
  IF array_length(kept, 1) IS NULL THEN
    RETURN NULL;
  ELSE
    -- Dedup preservando el orden
    RETURN (SELECT jsonb_agg(DISTINCT x ORDER BY x) FROM unnest(kept) AS x)::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- === Aplicar saneamiento a todos los profesionales ===

-- 1. targetAudience (Dirigido a)
UPDATE "Professional"
SET "targetAudience" = filter_json_array_to_canonical(
  "targetAudience",
  ARRAY[
    'Adolescentes', 'Adultos', 'Adultos mayores', 'Familias',
    'Jóvenes', 'Niños/as', 'Orientación a padres', 'Parejas'
  ]
)
WHERE "targetAudience" IS NOT NULL;

-- 2. therapyTypes (Tipos de terapia)
UPDATE "Professional"
SET "therapyTypes" = filter_json_array_to_canonical(
  "therapyTypes",
  ARRAY[
    'Adicciones', 'Deportología', 'EMDR', 'Logoterapia', 'Mindfulness',
    'Neuropsicología', 'Otras terapias', 'Psicooncología', 'Psicoanálisis',
    'Psicocorporal Reichiana', 'Psicodrama', 'Psicología clínica',
    'Psicología deportiva', 'Psicología forense', 'Psicología geriátrica',
    'Psicología laboral / organizacional', 'Psicología perinatal',
    'Psicología positiva', 'Psicoterapia Integral', 'Psiconutrición',
    'Terapia cognitivo-conductual', 'Terapia constructivista',
    'Terapia gestáltica', 'Terapia humanista', 'Terapia junguiana',
    'Terapia sistémica', 'Terapia transpersonal', 'Terapias vinculares',
    'Trastornos alimentarios'
  ]
)
WHERE "therapyTypes" IS NOT NULL;

-- 3. therapyModality (Modalidad de terapia)
UPDATE "Professional"
SET "therapyModality" = filter_json_array_to_canonical(
  "therapyModality",
  ARRAY[
    'Asesoría a Empresas', 'Discapacidad', 'Evaluaciones',
    'Individual', 'Orientación a Padres', 'Orientación Vocacional',
    'Pericias', 'Terapia Grupal', 'Vincular'
  ]
)
WHERE "therapyModality" IS NOT NULL;

-- Nota: la función filter_json_array_to_canonical se queda creada en la DB
-- por si se quiere reutilizar en el futuro. Si se quiere eliminar:
-- DROP FUNCTION IF EXISTS filter_json_array_to_canonical(TEXT, TEXT[]);
