#!/usr/bin/env node
/**
 * Genera íconos PWA (192x192 y 512x512) para REP.
 * Usa el logo cuadrado existente (apple-touch-icon.png, 180x180) como base
 * y lo redimensiona a los tamaños requeridos por el manifest.
 *
 * Ejecutar: node scripts/generate-pwa-icons.js
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SOURCE = path.join(__dirname, "..", "public", "apple-touch-icon.png");
const OUT_192 = path.join(__dirname, "..", "public", "icon-192x192.png");
const OUT_512 = path.join(__dirname, "..", "public", "icon-512x512.png");

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("✗ No se encontró el ícono fuente:", SOURCE);
    process.exit(1);
  }

  // Generar 192x192 con fondo esmeralda (matching theme_color del manifest)
  await sharp(SOURCE)
    .resize(192, 192, { fit: "contain", background: { r: 16, g: 185, b: 129, alpha: 1 } })
    .png()
    .toFile(OUT_192);
  console.log("✓ Generado:", path.relative(process.cwd(), OUT_192));

  // Generar 512x512 con mismo fondo
  await sharp(SOURCE)
    .resize(512, 512, { fit: "contain", background: { r: 16, g: 185, b: 129, alpha: 1 } })
    .png()
    .toFile(OUT_512);
  console.log("✓ Generado:", path.relative(process.cwd(), OUT_512));

  // Generar maskable (con padding del 10% para safe area en Android)
  await sharp(SOURCE)
    .resize(512, 512, { fit: "contain", background: { r: 16, g: 185, b: 129, alpha: 1 } })
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 16, g: 185, b: 129, alpha: 1 } })
    .png()
    .toFile(path.join(__dirname, "..", "public", "icon-maskable-512x512.png"));
  console.log("✓ Generado: public/icon-maskable-512x512.png");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
