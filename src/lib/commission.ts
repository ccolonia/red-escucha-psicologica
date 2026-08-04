/**
 * Utilidad para cálculo de comisión REP dinámica por profesional.
 *
 * Reglas de negocio (prioridad descendente):
 *  1. Si el profesional tiene `commissionRate` explícito (no null) → usar ese valor
 *  2. Si `profession` es "Psiquiatra" (case-insensitive) → 0.20 (20%)
 *  3. Default → 0.30 (30%) para psicólogos y resto
 *
 * Retrocompatibilidad: profesionales existentes sin commissionRate ni profession
 * → asumen 0.30 (30%), manteniendo sus cálculos intactos.
 */

export type CommissionInput = {
  commissionRate?: number | null;
  profession?: string | null;
};

/**
 * Devuelve la tasa de comisión REP (0-1) para un profesional.
 * Ej: 0.30 = 30%, 0.20 = 20%
 */
export function getCommissionRate(prof: CommissionInput): number {
  // 1. Override explícito
  if (prof.commissionRate != null && !Number.isNaN(prof.commissionRate)) {
    return prof.commissionRate;
  }
  // 2. Psiquiatra → 20%
  if (prof.profession && prof.profession.toLowerCase().includes("psiquiatr")) {
    return 0.20;
  }
  // 3. Default → 30% (psicólogos y resto)
  return 0.30;
}

/**
 * Devuelve el porcentaje entero (0-100) para mostrar en UI.
 * Ej: 0.30 → 30, 0.20 → 20
 */
export function getCommissionPercentage(prof: CommissionInput): number {
  return Math.round(getCommissionRate(prof) * 100);
}

/**
 * Calcula la comisión REP y el honorario profesional para un monto dado.
 *
 * @param patientFee - Honorario cobrado al paciente (ej: 70000)
 * @param prof - Datos del profesional (commissionRate + profession)
 * @returns { repFee, professionalFee, rate }
 *   repFee = Math.round(patientFee * rate)
 *   professionalFee = patientFee - repFee
 */
export function calculateFees(
  patientFee: number,
  prof: CommissionInput
): { repFee: number; professionalFee: number; rate: number } {
  const rate = getCommissionRate(prof);
  const repFee = Math.round(patientFee * rate);
  const professionalFee = patientFee - repFee;
  return { repFee, professionalFee, rate };
}
