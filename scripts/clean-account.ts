/**
 * Script para buscar y limpiar la cuenta carlaincolonia@gmail.com
 * que quedó registrada pero no aparece en el panel de profesionales
 * (probablemente porque licenseVerified=false y el panel filtra por
 * licenseVerified=true).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

async function cleanAccount() {
  const email = "carlaincolonia@gmail.com";
  console.log(`==============================================`);
  console.log(`  Búsqueda y limpieza de cuenta: ${email}`);
  console.log(`==============================================\n`);

  try {
    // 1. Buscar el usuario
    const user = await db.user.findUnique({
      where: { email },
      include: {
        professional: true,
        patient: true,
      },
    });

    if (!user) {
      console.log("❌ No se encontró ningún usuario con ese email.");
      console.log("  ¿Seguro que es el email correcto?");
      return;
    }

    console.log("📊 Usuario encontrado:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.active}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log("");

    if (user.professional) {
      console.log("📋 Profesional asociado:");
      console.log(`   ID: ${user.professional.id}`);
      console.log(`   License: ${user.professional.license}`);
      console.log(`   LicenseVerified: ${user.professional.licenseVerified}`);
      console.log(`   Specialty: ${user.professional.specialty}`);
      console.log("");
    }

    if (user.patient) {
      console.log("📋 Paciente asociado:");
      console.log(`   ID: ${user.patient.id}`);
      console.log("");
    }

    // 2. Contar dependencias
    const appointments = user.professional
      ? await db.appointment.count({ where: { professionalId: user.professional.id } })
      : 0;
    const schedules = user.professional
      ? await db.professionalSchedule.count({ where: { professionalId: user.professional.id } })
      : 0;
    const overrides = user.professional
      ? await db.scheduleOverride.count({ where: { professionalId: user.professional.id } })
      : 0;
    const addresses = user.professional
      ? await db.professionalAddress.count({ where: { professionalId: user.professional.id } })
      : 0;

    console.log("🔗 Dependencias:");
    console.log(`   Appointments: ${appointments}`);
    console.log(`   Schedules: ${schedules}`);
    console.log(`   Overrides: ${overrides}`);
    console.log(`   Addresses: ${addresses}`);
    console.log("");

    // 3. Eliminar TODO en orden (respetando FK)
    console.log("🔧 Eliminando registros...\n");

    if (user.professional) {
      // Appointments
      if (appointments > 0) {
        await db.appointment.deleteMany({ where: { professionalId: user.professional.id } });
        console.log(`✅ Appointments eliminados: ${appointments}`);
      }

      // Attendance sheets
      const sheets = await db.attendanceSheet.count({ where: { professionalId: user.professional.id } });
      if (sheets > 0) {
        await db.attendanceSheet.deleteMany({ where: { professionalId: user.professional.id } });
        console.log(`✅ AttendanceSheets eliminados: ${sheets}`);
      }

      // Addresses
      if (addresses > 0) {
        await db.professionalAddress.deleteMany({ where: { professionalId: user.professional.id } });
        console.log(`✅ Addresses eliminados: ${addresses}`);
      }

      // Overrides
      if (overrides > 0) {
        await db.scheduleOverride.deleteMany({ where: { professionalId: user.professional.id } });
        console.log(`✅ Overrides eliminados: ${overrides}`);
      }

      // Schedules
      if (schedules > 0) {
        await db.professionalSchedule.deleteMany({ where: { professionalId: user.professional.id } });
        console.log(`✅ Schedules eliminados: ${schedules}`);
      }

      // Professional
      await db.professional.delete({ where: { id: user.professional.id } });
      console.log(`✅ Professional eliminado`);
    }

    if (user.patient) {
      // Patient appointments
      const patientAppts = await db.appointment.count({ where: { patientId: user.patient.id } });
      if (patientAppts > 0) {
        await db.appointment.deleteMany({ where: { patientId: user.patient.id } });
        console.log(`✅ Patient appointments eliminados: ${patientAppts}`);
      }

      await db.patient.delete({ where: { id: user.patient.id } });
      console.log(`✅ Patient eliminado`);
    }

    // Password tokens
    const tokens = await db.passwordToken.count({ where: { userId: user.id } });
    if (tokens > 0) {
      await db.passwordToken.deleteMany({ where: { userId: user.id } });
      console.log(`✅ PasswordTokens eliminados: ${tokens}`);
    }

    // User
    await db.user.delete({ where: { id: user.id } });
    console.log(`✅ User eliminado`);

    console.log("\n🎉 Cuenta eliminada completamente. Ya podés registrarte de nuevo.");

    // Verificación
    const check = await db.user.findUnique({ where: { email } });
    if (!check) {
      console.log("✅ Verificación: el email está disponible para nuevo registro.");
    } else {
      console.log("⚠️ El email sigue existiendo en la DB.");
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

cleanAccount();
