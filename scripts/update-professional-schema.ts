/**
 * Script de migración: Agrega campos internalNotes y evaluationStatus al modelo Professional.
 *
 * Ejecutar con:
 *   npx tsx scripts/update-professional-schema.ts
 *
 * Operaciones:
 *   1. ALTER TABLE "Professional" ADD COLUMN "internalNotes" TEXT;
 *   2. ALTER TABLE "Professional" ADD COLUMN "evaluationStatus" TEXT;
 *
 * Es seguro (idempotente): usa IF NOT EXISTS a nivel de aplicación
 * para no fallar si las columnas ya existen.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  log: ["error"],
});

async function migrate() {
  console.log("==============================================");
  console.log("  MIGRACIÓN: internalNotes + evaluationStatus");
  console.log("  Modelo: Professional");
  console.log("==============================================\n");

  try {
    // 1. Agregar internalNotes
    console.log("➤ Agregando columna 'internalNotes'...");
    await db.$executeRawUnsafe(`
      ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
    `);
    console.log("✅ Columna 'internalNotes' OK");

    // 2. Agregar evaluationStatus
    console.log("➤ Agregando columna 'evaluationStatus'...");
    await db.$executeRawUnsafe(`
      ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "evaluationStatus" TEXT;
    `);
    console.log("✅ Columna 'evaluationStatus' OK");

    // 3. Verificar que las columnas existen
    console.log("\n➤ Verificando estructura...");
    const columns: Array<{ column_name: string; data_type: string }> =
      await db.$queryRawUnsafe(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'Professional'
          AND column_name IN ('internalNotes', 'evaluationStatus')
        ORDER BY column_name;
      `);

    console.log("\nColumnas verificadas:");
    for (const col of columns) {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    }

    if (columns.length === 2) {
      console.log("\n==============================================");
      console.log("  MIGRACIÓN COMPLETADA EXITOSAMENTE");
      console.log("  2 columnas nuevas en Professional");
      console.log("==============================================\n");
    } else {
      console.log(
        `\n⚠️ Se esperaban 2 columnas, se encontraron ${columns.length}. Revisar manualmente.`
      );
    }
  } catch (error) {
    console.error("\n❌ ERROR durante la migración:");
    console.error(error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

migrate();
