#!/usr/bin/env node
/**
 * Analiza el logo oficial REP (public/images/logo.png, 400x138 landscape)
 * para identificar la región del isotipo (símbolo cuadrado a la izquierda).
 *
 * Estrategia: el logo es 400x138. El isotipo ocupa aproximadamente el
 * tercio izquierdo (0-138px de ancho), lo que sería un cuadrado de 138x138.
 * Extraemos esa región y la usamos como base para todos los íconos.
 */
const sharp = require("sharp");
const path = require("path");

const LOGO = path.join(__dirname, "..", "public", "images", "logo.png");

async function main() {
  const meta = await sharp(LOGO).metadata();
  console.log(`Logo oficial: ${meta.width}x${meta.height}`);

  // Extraer el cuadrado izquierdo (isotipo)
  // El logo es 400x138 → isotipo está en x=0..138, y=0..138
  const size = Math.min(meta.height, meta.width); // 138
  const isotipo = await sharp(LOGO)
    .extract({ left: 0, top: 0, width: size, height: size })
    .toBuffer();

  // Guardar como referencia para inspección
  await sharp(isotipo).png().toFile(path.join(__dirname, "..", "public", "isotipo-raw.png"));
  console.log(`✓ Isotipo extraído: ${size}x${size} → public/isotipo-raw.png (referencia)`);

  // También extraer el isotipo escalado a 512x512 para inspección
  await sharp(isotipo)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(__dirname, "..", "public", "isotipo-512-preview.png"));
  console.log(`✓ Preview 512x512 → public/isotipo-512-preview.png`);
}

main().catch(e => { console.error(e); process.exit(1); });
