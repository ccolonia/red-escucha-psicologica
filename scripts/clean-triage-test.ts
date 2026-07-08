/**
 * Script de limpieza selectiva para probar el circuito de Triage desde cero.
 *
 * OBJETIVO: Borrar todos los turnos y pacientes de prueba, preservando:
 *   - Profesionales y sus configuraciones (Professional, ProfessionalSchedule,
 *     ScheduleOverride, ProfessionalAddress)
 *   - Usuarios admin/super_admin/professional
 *   - Tablas maestras (Specialty, etc.)
 *   - Consultas de PatientRequest que NO son de test:
 *       * Jorgelina Games
 *       * Tobías Martín Nieva
 *       * Velazquez Mabel
 *   - ContactRequest (no se tocan)
 *
 * ORDEN DE BORRADO (evitar errores de FK):
 *   1. Appointment (depende de Patient y Professional)
 *   2. PatientRequest WHERE name NOT IN (preservados) — solo borra las de test
 *   3. Patient (todos)
 *   4. User WHERE role = 'patient' (todos los usuarios-paciente)
 *   5. PasswordToken huérfanos
 *
 * TRANSACCIONAL: si algo falla, se hace rollback y la DB queda intacta.
 *
 * Ejecutar con:
 *   npx tsx scripts/clean-triage-test.ts
 *
 * ⚠️  SCRIPT DESTRUCTIVO — Solo usar en entorno de testeo/staging.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  log: ["error"],
});

// === Nombres de PatientRequest que NO se deben borrar ===
// Estas son consultas reales que no están involucradas con el triage de test.
// Se preservan intactas. El match se hace por nombre EXACTO (case-insensitive).
const PRESERVED_PATIENT_REQUEST_NAMES = [
  "Jorgelina Games",
  "Tobías Martín Nieva",
  "Velazquez Mabel",
];

async function cleanTriageTest() {
  console.log("==============================================");
  console.log("  LIMPIEZA SELECTIVA — Circuit de Triage (test)");
  console.log("==============================================\n");

  console.log("📋 Consultas de PatientRequest a PRESERVAR:");
  PRESERVED_PATIENT_REQUEST_NAMES.forEach((name) => {
    console.log(`   • ${name}`);
  });
  console.log("");

  try {
    // === Conteos PRE-limpieza para verificar al final ===
    const beforeCounts = {
      appointments: await db.appointment.count(),
      patientRequests: await db.patientRequest.count(),
      patients: await db.patient.count(),
      patientUsers: await db.user.count({ where: { role: "patient" } }),
      professionals: await db.professional.count(),
      professionalUsers: await db.user.count({
        where: { role: { in: ["professional", "admin", "super_admin"] } },
      }),
      schedules: await db.professionalSchedule.count(),
      overrides: await db.scheduleOverride.count(),
      addresses: await db.professionalAddress.count(),
      contactRequests: await db.contactRequest.count(),
    };

    console.log("📊 Estado ANTES de la limpieza:");
    console.log(`   Appointments:           ${beforeCounts.appointments}`);
    console.log(`   PatientRequests:        ${beforeCounts.patientRequests}`);
    console.log(`   Patients:               ${beforeCounts.patients}`);
    console.log(`   Users (patient):        ${beforeCounts.patientUsers}`);
    console.log(`   Professionals:          ${beforeCounts.professionals} (protegidos)`);
    console.log(`   Users (admin/prof):     ${beforeCounts.professionalUsers} (protegidos)`);
    console.log(`   Schedules:              ${beforeCounts.schedules} (protegidos)`);
    console.log(`   Overrides:              ${beforeCounts.overrides} (protegidos)`);
    console.log(`   Addresses:              ${beforeCounts.addresses} (protegidos)`);
    console.log(`   ContactRequests:        ${beforeCounts.contactRequests} (protegidos)`);
    console.log("");

    // === TRANSACCIÓN: todo o nada ===
    const result = await db.$transaction(async (tx) => {
      console.log("🔧 Iniciando transacción...\n");

      // ── 1. Appointment (Turnos agendados) ──────────────────────
      // Se borran TODOS los appointments (turnos de prueba).
      const deletedAppointments = await tx.appointment.deleteMany({});
      console.log(
        `✅ Appointments eliminados: ${deletedAppointments.count} registro(s)`
      );

      // ── 2. PatientRequest (Solicitudes de triage) ──────────────
      // Se borran SOLO las que NO están en la lista de preservados.
      // Las consultas de Jorgelina, Tobías y Mabel se preservan.
      const preservedNamesLower = PRESERVED_PATIENT_REQUEST_NAMES.map((n) =>
        n.toLowerCase()
      );

      // Log informativo: cuáles se van a preservar
      const allRequests = await tx.patientRequest.findMany({
        select: { id: true, name: true, email: true, status: true },
      });
      const toPreserve = allRequests.filter((r) =>
        preservedNamesLower.includes(r.name.toLowerCase())
      );
      const toDelete = allRequests.filter(
        (r) => !preservedNamesLower.includes(r.name.toLowerCase())
      );

      console.log(
        `   PatientRequests a PRESERVAR: ${toPreserve.length} registro(s)`
      );
      toPreserve.forEach((r) => {
        console.log(`     • ${r.name} <${r.email}> [${r.status}]`);
      });

      const deletedRequests = await tx.patientRequest.deleteMany({
        where: {
          name: {
            notIn: PRESERVED_PATIENT_REQUEST_NAMES,
          },
        },
      });
      console.log(
        `✅ PatientRequests eliminados (test): ${deletedRequests.count} registro(s)`
      );

      // ── 3. Patient (Registros de pacientes) ────────────────────
      // Se borran TODOS los pacientes (los de prueba).
      const deletedPatients = await tx.patient.deleteMany({});
      console.log(
        `✅ Patients eliminados: ${deletedPatients.count} registro(s)`
      );

      // ── 4. User con rol 'patient' ──────────────────────────────
      // Se borran TODOS los usuarios-paciente (los de prueba).
      // NO se tocan los usuarios con rol 'professional', 'admin' o 'super_admin'.
      const deletedUsers = await tx.user.deleteMany({
        where: { role: "patient" },
      });
      console.log(
        `✅ Users (role=patient) eliminados: ${deletedUsers.count} registro(s)`
      );

      // ── 5. PasswordToken huérfanos (seguridad) ─────────────────
      // Los PasswordToken con onDelete: Cascade se borran con el User,
      // pero por si quedaran huérfanos de alguna transacción fallida.
      const deletedTokens = await tx.passwordToken.deleteMany({});
      console.log(
        `✅ PasswordTokens eliminados: ${deletedTokens.count} registro(s)`
      );

      return {
        deletedAppointments: deletedAppointments.count,
        deletedRequests: deletedRequests.count,
        deletedPatients: deletedPatients.count,
        deletedUsers: deletedUsers.count,
        deletedTokens: deletedTokens.count,
        preservedCount: toPreserve.length,
      };
    });

    // === Verificación POST-limpieza (fuera de la transacción) ===
    console.log("\n==============================================");
    console.log("  LIMPIEZA COMPLETADA EXITOSAMENTE");
    console.log("==============================================\n");

    const afterCounts = {
      appointments: await db.appointment.count(),
      patientRequests: await db.patientRequest.count(),
      patients: await db.patient.count(),
      patientUsers: await db.user.count({ where: { role: "patient" } }),
      professionals: await db.professional.count(),
      professionalUsers: await db.user.count({
        where: { role: { in: ["professional", "admin", "super_admin"] } },
      }),
      schedules: await db.professionalSchedule.count(),
      overrides: await db.scheduleOverride.count(),
      addresses: await db.professionalAddress.count(),
      contactRequests: await db.contactRequest.count(),
    };

    console.log("📊 Estado DESPUÉS de la limpieza:");
    console.log(`   Appointments:           ${afterCounts.appointments}`);
    console.log(`   PatientRequests:        ${afterCounts.patientRequests} (preservados)`);
    console.log(`   Patients:               ${afterCounts.patients}`);
    console.log(`   Users (patient):        ${afterCounts.patientUsers}`);
    console.log(
      `   Professionals:          ${afterCounts.professionals} (debe ser igual: ${beforeCounts.professionals}) ✓`
    );
    console.log(
      `   Users (admin/prof):     ${afterCounts.professionalUsers} (debe ser igual: ${beforeCounts.professionalUsers}) ✓`
    );
    console.log(
      `   Schedules:              ${afterCounts.schedules} (debe ser igual: ${beforeCounts.schedules}) ✓`
    );
    console.log(
      `   Overrides:              ${afterCounts.overrides} (debe ser igual: ${beforeCounts.overrides}) ✓`
    );
    console.log(
      `   Addresses:              ${afterCounts.addresses} (debe ser igual: ${beforeCounts.addresses}) ✓`
    );
    console.log(
      `   ContactRequests:        ${afterCounts.contactRequests} (debe ser igual: ${beforeCounts.contactRequests}) ✓`
    );

    console.log("\n📋 Resumen de borrados:");
    console.log(`   Appointments:           ${result.deletedAppointments}`);
    console.log(`   PatientRequests (test): ${result.deletedRequests}`);
    console.log(`   PatientRequests (preservados): ${result.preservedCount}`);
    console.log(`   Patients:               ${result.deletedPatients}`);
    console.log(`   Users (patient):        ${result.deletedUsers}`);
    console.log(`   PasswordTokens:         ${result.deletedTokens}`);

    // === Validación de integridad ===
    const professionalsOK = afterCounts.professionals === beforeCounts.professionals;
    const schedulesOK = afterCounts.schedules === beforeCounts.schedules;
    const overridesOK = afterCounts.overrides === beforeCounts.overrides;
    const addressesOK = afterCounts.addresses === beforeCounts.addresses;
    const contactsOK = afterCounts.contactRequests === beforeCounts.contactRequests;

    if (
      professionalsOK &&
      schedulesOK &&
      overridesOK &&
      addressesOK &&
      contactsOK &&
      afterCounts.appointments === 0 &&
      afterCounts.patients === 0 &&
      afterCounts.patientUsers === 0
    ) {
      console.log("\n🎉 Limpieza exitosa — DB lista para testear triage desde cero.");
      console.log("   Profesionales, schedules y consultas reales: INTACTOS.");
    } else {
      console.log("\n⚠️  Revisar: algunas validaciones de integridad no pasaron.");
      if (!professionalsOK) console.log("   ❌ Professionals count cambió");
      if (!schedulesOK) console.log("   ❌ Schedules count cambió");
      if (!overridesOK) console.log("   ❌ Overrides count cambió");
      if (!addressesOK) console.log("   ❌ Addresses count cambió");
      if (!contactsOK) console.log("   ❌ ContactRequests count cambió");
    }
  } catch (error) {
    console.error("\n❌ ERROR durante la limpieza:");
    console.error(error);
    console.error("\n🔴 La transacción fue revertida. La DB queda intacta.");
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

cleanTriageTest();
