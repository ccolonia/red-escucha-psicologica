/**
 * Script de limpieza selectiva de datos de prueba
 *
 * Borra: Appointments, PatientRequests, Patients (y sus Users con role "patient"),
 *         PasswordTokens, AttendanceSessions, AttendanceSheets, ContactRequests
 * Preserva: Professionals, ProfessionalSchedules, ScheduleOverrides,
 *           Users admin/super_admin/professional, CMS tables, CmsSiteConfig
 *
 * Uso: npx tsx scripts/clean-test-data.ts           (dry-run, sin cambios)
 *      npx tsx scripts/clean-test-data.ts --confirm  (ejecuta borrado real)
 *      npm run clean:test                            (dry-run)
 *      npm run clean:test:confirm                    (ejecuta borrado real)
 */

// Force-load project .env with override BEFORE Prisma is imported
// The monorepo root .env has a different DATABASE_URL that must NOT be used
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env"), override: true });

// Verify DATABASE_URL is the PostgreSQL one (not the SQLite one from root)
if (!process.env.DATABASE_URL?.startsWith("postgresql://")) {
  console.error("ERROR: DATABASE_URL no es PostgreSQL. Verificá el archivo .env");
  console.error("Valor actual:", process.env.DATABASE_URL?.substring(0, 30));
  process.exit(1);
}

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  LIMPIEZA SELECTIVA DE DATOS DE PRUEBA - REP");
  console.log("═══════════════════════════════════════════════════════");
  console.log();

  // ── Paso 0: Contar registros antes del borrado ──
  const beforeCounts = {
    appointments: await db.appointment.count(),
    patientRequests: await db.patientRequest.count(),
    attendanceSessions: await db.attendanceSession.count(),
    attendanceSheets: await db.attendanceSheet.count(),
    patients: await db.patient.count(),
    contactRequests: await db.contactRequest.count(),
    passwordTokens: await db.passwordToken.count(),
    patientUsers: await db.user.count({ where: { role: "patient" } }),
  };

  console.log("Registros actuales:");
  console.log(`   Turnos (Appointment):        ${beforeCounts.appointments}`);
  console.log(`   Solicitudes Triage:          ${beforeCounts.patientRequests}`);
  console.log(`   Sesiones Asistencia:         ${beforeCounts.attendanceSessions}`);
  console.log(`   Planillas Asistencia:        ${beforeCounts.attendanceSheets}`);
  console.log(`   Pacientes (Patient):         ${beforeCounts.patients}`);
  console.log(`   Contactos:                   ${beforeCounts.contactRequests}`);
  console.log(`   Tokens de contraseña:        ${beforeCounts.passwordTokens}`);
  console.log(`   Usuarios con rol "patient":  ${beforeCounts.patientUsers}`);
  console.log();

  // ── Paso 1: Confirmación de seguridad ──
  const args = process.argv.slice(2);
  if (!args.includes("--confirm")) {
    console.log(">> MODO DRY-RUN (sin cambios). Para ejecutar realmente:");
    console.log("   npx tsx scripts/clean-test-data.ts --confirm");
    console.log();
    console.log("Tablas PROTEGIDAS (no se modifican):");
    console.log("   [OK] Professional");
    console.log("   [OK] ProfessionalSchedule");
    console.log("   [OK] ScheduleOverride");
    console.log("   [OK] User (admin, super_admin, professional)");
    console.log("   [OK] CmsHeroSlide, CmsSpecialtyTab, CmsSpecialty, etc.");
    console.log("   [OK] CmsSiteConfig");
    console.log();
    return;
  }

  console.log("Ejecutando limpieza con transaccion...");
  console.log();

  try {
    const result = await db.$transaction(async (tx) => {
      // ── 1. Borrar Appointments (turnos) ──
      // Depende de Patient y Professional → borrar primero
      const deletedAppointments = await tx.appointment.deleteMany({});
      console.log(`   [OK] Turnos eliminados:           ${deletedAppointments.count}`);

      // ── 2. Borrar PatientRequests (cola de Triage) ──
      // Tiene FK opcional a Professional y Appointment → seguro borrar después de Appointments
      const deletedPatientRequests = await tx.patientRequest.deleteMany({});
      console.log(`   [OK] Solicitudes Triage eliminadas: ${deletedPatientRequests.count}`);

      // ── 3. Borrar AttendanceSessions ──
      // Depende de AttendanceSheet → borrar antes que la hoja
      const deletedSessions = await tx.attendanceSession.deleteMany({});
      console.log(`   [OK] Sesiones asistencia eliminadas: ${deletedSessions.count}`);

      // ── 4. Borrar AttendanceSheets ──
      // Depende de Professional → seguro borrar
      const deletedSheets = await tx.attendanceSheet.deleteMany({});
      console.log(`   [OK] Planillas asistencia eliminadas: ${deletedSheets.count}`);

      // ── 5. Borrar ContactRequests ──
      // Sin dependencias → seguro borrar
      const deletedContacts = await tx.contactRequest.deleteMany({});
      console.log(`   [OK] Contactos eliminados:         ${deletedContacts.count}`);

      // ── 6. Borrar PasswordTokens ──
      // Depende de User → borrar antes de Users
      const deletedTokens = await tx.passwordToken.deleteMany({});
      console.log(`   [OK] Tokens contraseña eliminados:  ${deletedTokens.count}`);

      // ── 7. Borrar Patients ──
      // Ya no hay Appointments que dependan de ellos → seguro borrar
      const deletedPatients = await tx.patient.deleteMany({});
      console.log(`   [OK] Pacientes eliminados:         ${deletedPatients.count}`);

      // ── 8. Borrar Users con role "patient" ──
      // Ya no hay Patients que dependan de ellos → seguro borrar
      const deletedPatientUsers = await tx.user.deleteMany({
        where: { role: "patient" },
      });
      console.log(`   [OK] Usuarios patient eliminados:  ${deletedPatientUsers.count}`);

      return {
        appointments: deletedAppointments.count,
        patientRequests: deletedPatientRequests.count,
        attendanceSessions: deletedSessions.count,
        attendanceSheets: deletedSheets.count,
        contactRequests: deletedContacts.count,
        passwordTokens: deletedTokens.count,
        patients: deletedPatients.count,
        patientUsers: deletedPatientUsers.count,
      };
    }, {
      maxWait: 10000,  // Max time to wait for transaction to start: 10s
      timeout: 30000,  // Max time for transaction to complete: 30s
    });

    console.log();
    console.log("═══════════════════════════════════════════════════════");
    console.log("  LIMPIEZA COMPLETADA EXITOSAMENTE");
    console.log("═══════════════════════════════════════════════════════");
    console.log();
    console.log("Resumen de registros eliminados:");
    console.log(`   Turnos:                ${result.appointments}`);
    console.log(`   Solicitudes Triage:    ${result.patientRequests}`);
    console.log(`   Sesiones Asistencia:   ${result.attendanceSessions}`);
    console.log(`   Planillas Asistencia:  ${result.attendanceSheets}`);
    console.log(`   Contactos:             ${result.contactRequests}`);
    console.log(`   Tokens Contraseña:     ${result.passwordTokens}`);
    console.log(`   Pacientes:             ${result.patients}`);
    console.log(`   Usuarios patient:      ${result.patientUsers}`);

    // ── Verificación post-limpieza ──
    const afterCounts = {
      professionals: await db.professional.count(),
      schedules: await db.professionalSchedule.count(),
      overrides: await db.scheduleOverride.count(),
      adminUsers: await db.user.count({
        where: { role: { in: ["admin", "super_admin", "professional"] } },
      }),
    };

    console.log();
    console.log("Tablas PRESERVADAS (sin cambios):");
    console.log(`   Profesionales:          ${afterCounts.professionals}`);
    console.log(`   Horarios configurados:  ${afterCounts.schedules}`);
    console.log(`   Overrides de agenda:    ${afterCounts.overrides}`);
    console.log(`   Usuarios protegidos:    ${afterCounts.adminUsers}`);
  } catch (error) {
    console.error();
    console.error("ERROR: La transaccion fallo. No se realizaron cambios.");
    console.error("La base de datos permanece en su estado original.");
    console.error();
    console.error("Detalle del error:", error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("Error inesperado:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
