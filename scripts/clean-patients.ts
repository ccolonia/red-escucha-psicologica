/**
 * Script de mantenimiento: Limpieza de datos de pacientes y turnos.
 * Borra ÚNICAMENTE los datos de pacientes y sus interacciones.
 * Las configuraciones de profesionales (Professional, ProfessionalSchedule,
 * ScheduleOverride, AttendanceSheet, AttendanceSession) NO se tocan.
 *
 * Orden de eliminación (hijos → padres) para respetar FK:
 *   1. Appointment        (turnos agendados)
 *   2. PatientRequest     (solicitudes de triage)
 *   3. Patient            (registros de pacientes)
 *   4. User (role=patient)(usuarios con rol paciente)
 *   5. PasswordToken      (tokens de pacientes, cascade pero explícito)
 *   6. ContactRequest     (solicitudes de contacto de pacientes)
 *
 * Ejecutar con:
 *   npx tsx scripts/clean-patients.ts
 *
 * ⚠️  SCRIPT DESTRUCTIVO — Solo usar en entorno de testeo/staging.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  log: ["error"],
});

async function cleanPatients() {
  console.log("==============================================");
  console.log("  LIMPIEZA DE BASE DE DATOS — Solo Pacientes");
  console.log("==============================================\n");

  try {
    // ── 1. Appointment (Turnos agendados) ──────────────────────
    const deletedAppointments = await db.appointment.deleteMany({});
    console.log(
      `✅ Appointments eliminados: ${deletedAppointments.count} registro(s)`
    );

    // ── 2. PatientRequest (Solicitudes de triage) ──────────────
    const deletedRequests = await db.patientRequest.deleteMany({});
    console.log(
      `✅ PatientRequests eliminados: ${deletedRequests.count} registro(s)`
    );

    // ── 3. Patient (Registros de pacientes) ────────────────────
    const deletedPatients = await db.patient.deleteMany({});
    console.log(
      `✅ Patients eliminados: ${deletedPatients.count} registro(s)`
    );

    // ── 4. User con rol 'patient' ──────────────────────────────
    const deletedUsers = await db.user.deleteMany({
      where: { role: "patient" },
    });
    console.log(
      `✅ Users (role=patient) eliminados: ${deletedUsers.count} registro(s)`
    );

    // ── 5. PasswordToken huérfanos (seguridad) ─────────────────
    // Los PasswordToken con onDelete: Cascade se borran con el User,
    // pero por si quedaran huérfanos de alguna transacción fallida:
    const deletedTokens = await db.passwordToken.deleteMany({});
    console.log(
      `✅ PasswordTokens eliminados: ${deletedTokens.count} registro(s)`
    );

    // ── 6. ContactRequest (solicitudes de contacto) ────────────
    const deletedContacts = await db.contactRequest.deleteMany({});
    console.log(
      `✅ ContactRequests eliminados: ${deletedContacts.count} registro(s)`
    );

    console.log("\n==============================================");
    console.log("  LIMPIEZA COMPLETADA EXITOSAMENTE");
    console.log("  Profesionales y configuraciones: INTACTOS");
    console.log("==============================================\n");

    // Verificación post-limpieza
    const remainingAppointments = await db.appointment.count();
    const remainingRequests = await db.patientRequest.count();
    const remainingPatients = await db.patient.count();
    const remainingPatientUsers = await db.user.count({
      where: { role: "patient" },
    });

    console.log("Verificación post-limpieza:");
    console.log(`  Appointments restantes:  ${remainingAppointments}`);
    console.log(`  PatientRequests restantes: ${remainingRequests}`);
    console.log(`  Patients restantes:      ${remainingPatients}`);
    console.log(`  Users (patient) restantes: ${remainingPatientUsers}`);

    if (
      remainingAppointments === 0 &&
      remainingRequests === 0 &&
      remainingPatients === 0 &&
      remainingPatientUsers === 0
    ) {
      console.log("\n🎉 Base de datos limpia — lista para testear desde cero.");
    } else {
      console.log(
        "\n⚠️  Quedan registros residuales. Revisar manualmente."
      );
    }
  } catch (error) {
    console.error("\n❌ ERROR durante la limpieza:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

cleanPatients();
