#!/usr/bin/env node
/**
 * Genera TODOS los íconos HD de REP desde el isotipo oficial extraído del logo.
 *
 * Fuente: public/images/logo.png (400x138, navbar logo oficial)
 *   ↓ extract leftmost 138x138 square
 *   ↓ public/isotipo-raw.png (138x138 RGBA con transparencia)
 *
 * Salidas en /public:
 *   - favicon.ico (32x32 PNG-compatible, multi-res en .ico real)
 *   - favicon-16x16.png (16x16 HD)
 *   - favicon-32x32.png (32x32 HD)
 *   - icon-192.png (192x192, fondo esmeralda, purpose=any maskable)
 *   - icon-512.png (512x512, fondo esmeralda, purpose=any maskable)
 *   - icon-maskable-192.png (192x192 con padding 20%)
 *   - icon-maskable-512.png (512x512 con padding 20%)
 *   - apple-touch-icon.png (180x180, fondo sólido esmeralda)
 *
 * Calidad HD:
 *   - Sharp usa kernel lanczos3 por defecto para downscaling (mejor nitidez)
 *   - Generamos a 2x y downscaled para antialiasing de mayor calidad
 *   - Sin compresión con pérdida para mantener bordes limpios
 *
 * Ejecutar: node scripts/generate-hd-icons.js
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const LOGO = path.join(PUBLIC_DIR, "images", "logo.png");
const ISOTOPO_RAW = path.join(PUBLIC_DIR, "isotipo-raw.png");

// Colores de marca REP
const BRAND_GREEN = { r: 16, g: 185, b: 129, alpha: 1 };   // #10B981
const BG_OFFWHITE = { r: 250, g: 250, b: 250, alpha: 1 };   // #FAFAFA

// Sharp por defecto usa kernel lanczos3 para downscaling (mejor calidad)
// pero lo explicitamos para claridad
const RESIZE_OPTS = {
  fit: "contain",
  background: { r: 0, g: 0, b: 0, alpha: 0 },
  kernel: "lanczos3",
};

async function extractIsotipo() {
  // El logo es 400x138 (landscape). El isotipo es el cuadrado izquierdo 138x138.
  const meta = await sharp(LOGO).metadata();
  const size = Math.min(meta.height, meta.width); // 138
  const buffer = await sharp(LOGO)
    .extract({ left: 0, top: 0, width: size, height: size })
    .toBuffer();
  return sharp(buffer);
}

/**
 * Genera un ícono cuadrado con fondo esmeralda y el isotipo centrado.
 * El isotipo se redimensiona manteniendo aspect ratio, dentro del tamaño
 * solicitado, con un porcentaje de padding opcional.
 */
async function generateIcon({
  size,
  outName,
  background = BRAND_GREEN,
  paddingPercent = 0, // 0 = sin padding (isotipo ocupa todo el cuadrado)
  isotipoSrc,
}) {
  // Calcular el tamaño del isotipo dentro del cuadrado
  // Si paddingPercent=0.15 → isotipo ocupa 70% del cuadrado (padding 15% cada lado)
  const innerSize = Math.round(size * (1 - paddingPercent * 2));

  // Redimensionar isotipo al tamaño interno con alta calidad
  const isotipoResized = await isotipoSrc
    .clone()
    .resize(innerSize, innerSize, RESIZE_OPTS)
    .toBuffer();

  // Crear fondo esmeralda + composite del isotipo centrado
  const padding = Math.round((size - innerSize) / 2);
  const finalIcon = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: isotipoResized,
        gravity: "center",
        // El offset se maneja automáticamente con gravity: center
      },
    ])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(PUBLIC_DIR, outName));

  const stat = fs.statSync(path.join(PUBLIC_DIR, outName));
  console.log(`✓ ${outName} (${size}x${size}, ${(stat.size / 1024).toFixed(1)} KB${paddingPercent ? `, padding ${Math.round(paddingPercent*100)}%` : ""})`);
  return finalIcon;
}

/**
 * Genera un favicon .ico multi-resolución REAL (no PNG renombrado).
 * Formato ICO: header + dir entries + imágenes PNG embebidas.
 * Soporta 16x16, 32x32, 48x48 en un solo archivo.
 */
async function generateRealIco(isotipoSrc) {
  // Generar los 3 tamaños como buffers PNG
  const sizes = [16, 32, 48];
  const pngBuffers = [];
  for (const s of sizes) {
    const buf = await generateIconBuffer({ size: s, isotipoSrc, background: BRAND_GREEN });
    pngBuffers.push({ size: s, buffer: buf });
  }

  // Construir el archivo .ico
  // Header: 6 bytes
  // Dir entries: 16 bytes cada una × N
  // Imágenes: los PNGs concatenados
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = pngBuffers.length;
  const dirSize = dirEntrySize * numImages;
  const imagesOffset = headerSize + dirSize;

  // Calcular offsets de cada imagen
  let currentOffset = imagesOffset;
  const dirEntries = [];
  for (const { size, buffer } of pngBuffers) {
    dirEntries.push({
      width: size === 256 ? 0 : size,  // 0 means 256
      height: size === 256 ? 0 : size,
      colorCount: 0, // 0 = no palette (true color)
      reserved: 0,
      planes: 1,
      bitCount: 32,
      bytesInRes: buffer.length,
      imageOffset: currentOffset,
    });
    currentOffset += buffer.length;
  }

  // Construir buffers
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type = 1 (ICO)
  header.writeUInt16LE(numImages, 4); // count

  const dirBuf = Buffer.alloc(dirSize);
  let pos = 0;
  for (const e of dirEntries) {
    dirBuf.writeUInt8(e.width, pos);
    dirBuf.writeUInt8(e.height, pos + 1);
    dirBuf.writeUInt8(e.colorCount, pos + 2);
    dirBuf.writeUInt8(e.reserved, pos + 3);
    dirBuf.writeUInt16LE(e.planes, pos + 4);
    dirBuf.writeUInt16LE(e.bitCount, pos + 6);
    dirBuf.writeUInt32LE(e.bytesInRes, pos + 8);
    dirBuf.writeUInt32LE(e.imageOffset, pos + 12);
    pos += dirEntrySize;
  }

  const icoBuffer = Buffer.concat([header, dirBuf, ...pngBuffers.map(p => p.buffer)]);
  const outPath = path.join(PUBLIC_DIR, "favicon.ico");
  fs.writeFileSync(outPath, icoBuffer);
  console.log(`✓ favicon.ico (multi-res: ${sizes.join(", ")} px, ${(icoBuffer.length / 1024).toFixed(1)} KB)`);
}

/**
 * Genera un ícono como Buffer (en memoria, para usar en .ico multi-res).
 */
async function generateIconBuffer({ size, isotipoSrc, background = BRAND_GREEN }) {
  const innerSize = size; // Sin padding para favicon (más pequeño posible)
  const isotipoResized = await isotipoSrc
    .clone()
    .resize(innerSize, innerSize, RESIZE_OPTS)
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: isotipoResized, gravity: "center" }])
    .png({ quality: 100 })
    .toBuffer();
}

async function main() {
  console.log("=== Generando íconos HD REP desde isotipo oficial ===\n");

  // 1. Extraer isotipo del logo oficial
  const isotipoSrc = await extractIsotipo();

  // Guardar isotipo-raw.png como referencia (sin fondo)
  await isotipoSrc.clone().png().toFile(ISOTOPO_RAW);
  console.log(`✓ isotipo-raw.png (referencia, transparente)\n`);

  // 2. Favicons (HD)
  console.log("--- Favicons ---");
  await generateRealIco(isotipoSrc);

  // favicon-16x16.png y favicon-32x32.png (HD, con fondo esmeralda para consistencia)
  await generateIcon({ size: 16, outName: "favicon-16x16.png", isotipoSrc, background: BRAND_GREEN });
  await generateIcon({ size: 32, outName: "favicon-32x32.png", isotipoSrc, background: BRAND_GREEN });

  // 3. Íconos PWA HD (fondo esmeralda, sin padding → purpose="any maskable")
  console.log("\n--- Íconos PWA HD (purpose=any maskable) ---");
  await generateIcon({ size: 192, outName: "icon-192.png", isotipoSrc, background: BRAND_GREEN, paddingPercent: 0.10 });
  await generateIcon({ size: 512, outName: "icon-512.png", isotipoSrc, background: BRAND_GREEN, paddingPercent: 0.10 });

  // 4. Íconos maskable separados (con más padding para safe area Android)
  console.log("\n--- Íconos maskable (safe area Android 20%) ---");
  await generateIcon({ size: 192, outName: "icon-maskable-192.png", isotipoSrc, background: BRAND_GREEN, paddingPercent: 0.20 });
  await generateIcon({ size: 512, outName: "icon-maskable-512.png", isotipoSrc, background: BRAND_GREEN, paddingPercent: 0.20 });

  // 5. Apple touch icon (180x180, fondo sólido, sin transparencia)
  console.log("\n--- Apple Touch Icon (iOS) ---");
  await generateIcon({ size: 180, outName: "apple-touch-icon.png", isotipoSrc, background: BRAND_GREEN, paddingPercent: 0.12 });

  // 6. Limpieza: remover archivos de preview temporales
  const tempFiles = ["isotipo-512-preview.png"];
  for (const f of tempFiles) {
    const p = path.join(PUBLIC_DIR, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  console.log("\n=== Verificación final ===");
  const files = [
    "favicon.ico", "favicon-16x16.png", "favicon-32x32.png",
    "icon-192.png", "icon-512.png",
    "icon-maskable-192.png", "icon-maskable-512.png",
    "apple-touch-icon.png",
    "isotipo-raw.png",
  ];
  for (const f of files) {
    const p = path.join(PUBLIC_DIR, f);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      const meta = await sharp(p).metadata();
      console.log(`  ✓ ${f} (${meta.width}x${meta.height}, ${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`  ✗ ${f} NO EXISTE`);
    }
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
