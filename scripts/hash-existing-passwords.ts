/**
 * Script to migrate existing plaintext passwords to bcrypt hashes.
 * Run with: npx tsx scripts/hash-existing-passwords.ts
 * 
 * This is a one-time migration script. After running it, all passwords
 * in the database will be securely hashed with bcrypt.
 * 
 * IMPORTANT: Run this AFTER deploying the code changes that use bcrypt.
 * The code supports both hashed and plaintext passwords during the transition
 * thanks to the isHashed() check in the comparePassword flow.
 */

import { db } from "../src/lib/db";
import { hashPassword, isHashed } from "../src/lib/password";

async function hashExistingPasswords() {
  console.log("🔐 Iniciando migración de contraseñas a bcrypt...");

  const users = await db.user.findMany({
    select: { id: true, email: true, password: true },
  });

  console.log(`📊 Encontrados ${users.length} usuarios`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    if (isHashed(user.password)) {
      console.log(`⏭️  Saltando ${user.email} (ya hasheada)`);
      skipped++;
      continue;
    }

    const hashedPassword = await hashPassword(user.password);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log(`✅ Migrada contraseña de ${user.email}`);
    migrated++;
  }

  console.log(`\n📈 Resumen:`);
  console.log(`   Migradas: ${migrated}`);
  console.log(`   Saltadas (ya hasheadas): ${skipped}`);
  console.log(`   Total: ${users.length}`);

  await db.$disconnect();
}

hashExistingPasswords().catch((e) => {
  console.error("❌ Error en migración:", e);
  process.exit(1);
});
