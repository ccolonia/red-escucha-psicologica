/**
 * Fuente Única de Verdad (Single Source of Truth) para las opciones de
 * Especialidad, Tipo de Terapia, Público Objetivo y Modalidades de Terapia.
 *
 * Importar este archivo desde:
 *   - professional-register.tsx (registro público)
 *   - professional-dashboard.tsx (Mi Perfil / Identidad Profesional)
 *   - admin-agenda-central.tsx (filtros de Agenda Central)
 *   - admin-dashboard.tsx (alta/edición de profesionales desde admin)
 *
 * NUNCA duplicar estas listas en los componentes. Si se necesita agregar
 * una nueva opción, hacerlo ACÁ y se propaga a todos los componentes.
 */

// === Especialidades (combobox select) ===
export const SPECIALTIES = [
  // Ordenadas alfabéticamente (es_AR, sin tildes)
  "Acoso Laboral",
  "Adicciones",
  "Ansiedad y Ataques de Pánico",
  "Autolesiones e Ideación Suicida",
  "Bullying",
  "Coparentalidad",
  "Duelo y Pérdida",
  "Hebefrenia",
  "Neuropsicología",
  "Pacientes Judicializados",
  "Psicología Clínica",
  "Psiquiatría Clínica",
  "Psicología de la Salud",
  "Psicología Deportiva",
  "Psicología Educacional",
  "Psicología Forense",
  "Psicología Geriátrica",
  "Psicología Laboral / Organizacional",
  "Psicología Perinatal",
  "Psicología Social / Comunitaria",
  "Psicología Transcultural",
  "Psiconutrición",
  "Psicooncología",
  "Psicosis y Esquizofrenia",
  "Revinculaciones",
  "Sexología / Terapia Sexual",
  "Síndrome de Burnout",
  "Trastorno Límite de la Personalidad (TLP)",
  "Trastorno Obsesivo-Compulsivo (TOC)",
  "Trastornos Alimentarios",
  "Violencia y Abuso Sexual",
];

// === Tipos de Terapia (checkboxes) ===
export const THERAPY_TYPES = [
  "Adicciones",
  "Ataques de Pánico",
  "Deportología",
  "EMDR",
  "Logoterapia",
  "Mindfulness",
  "Neuropsicología",
  "Otras terapias",
  "Psicooncología",
  "Psicoanálisis",
  "Psicocorporal Reichiana",
  "Psicodrama",
  "Psicología clínica",
  "Psicología deportiva",
  "Psicología forense",
  "Psicología geriátrica",
  "Psicología laboral / organizacional",
  "Psicología perinatal",
  "Psicología positiva",
  "Psicoterapia Integral",
  "Psiconutrición",
  "Psiquiatría de Enlace o Interconsulta",
  "Psiquiatría Forense o Legal",
  "Psiquiatría Infanto-Juvenil",
  "Terapia cognitivo-conductual",
  "Terapia constructivista",
  "Terapia gestáltica",
  "Terapia humanista",
  "Terapia junguiana",
  "Terapia sistémica",
  "Terapia transpersonal",
  "Terapias vinculares",
  "Trastorno bipolar",
  "Trastorno de ansiedad",
  "Trastorno de personalidad",
  "Trastorno obsesivo compulsivo",
  "Trastornos alimentarios",
];

// === Público Objetivo (checkboxes) ===
export const TARGET_AUDIENCES = [
  "Adolescentes",
  "Adultos",
  "Adultos mayores",
  "Bebés",
  "Familias",
  "Jóvenes",
  "Niños/as",
  "Orientación a padres",
  "Parejas",
];

// === Modalidades de Terapia ===
export const THERAPY_MODALITIES = [
  "Asesoría a Empresas",
  "Discapacidad",
  "Evaluaciones",
  "Individual",
  "Orientación a Padres",
  "Orientación Vocacional",
  "Pericias",
  "Terapia Grupal",
  "Vincular",
];

// === Profesiones (para el campo profession) ===
export const PROFESSIONS = [
  "Psicólogo/a",
  "Psiquiatra",
];

// === Títulos / Prefijos Académicos (para el campo title) ===
export const TITLES = [
  "Lic.",
  "Dr.",
  "Dra.",
  "Psic.",
  "Dr. en Psicología",
  "Dra. en Psicología",
  "Médico Psiquiatra",
  "Médica Psiquiatra",
  "Ninguno",
];
