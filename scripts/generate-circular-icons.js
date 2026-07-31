#!/usr/bin/env node
/**
 * Genera íconos HD de REP con diseño de SELLO CIRCULAR BLANCO + isotipo centrado.
 *
 * Diseño:
 *   - Fondo: cuadrado con un círculo blanco puro (#FFFFFF) anti-aliased centrado
 *   - Contenido: isotipo oficial REP centrado dentro del círculo
 *   - Padding: ~17% entre el isotipo y el borde del círculo (respiración)
 *   - El círculo ocupa ~90% del cuadrado (dejando margen transparente para
 *     que en pestañas de browser con fondo claro/oscuro se vea impecable)
 *
 * Para íconos maskable (Android home screen): se mantiene el fondo esmeralda
 * sólido cuadrado (requerido por la spec maskable: full-bleed, sin transparencia).
 *
 * Fuente: public/images/logo.png (400x138 landscape)
 *   ↓ extract leftmost 138x138 square = isotipo oficial con transparencia
 *
 * Salidas en /public:
 *   - favicon.ico (16+32+48 px multi-res real .ico, círculo blanco)
 *   - favicon-16x16.png (círculo blanco)
 *   - favicon-32x32.png (círculo blanco)
 *   - icon-192.png (círculo blanco, purpose=any)
 *   - icon-512.png (círculo blanco, purpose=any)
 *   - apple-touch-icon.png (180x180, círculo blanco sobre fondo esmeralda sólido
 *     porque iOS NO soporta transparencia en apple-touch-icon)
 *   - icon-maskable-192.png (cuadrado esmeralda full-bleed, purpose=maskable)
 *   - icon-maskable-512.png (cuadrado esmeralda full-bleed, purpose=maskable)
 *
 * Calidad HD:
 *   - Sharp kernel lanczos3 para downscaling
 *   - Círculo dibujado con SVG vectorial (bordes perfectos, anti-aliasing nativo)
 *   - Compresión PNG nivel 9 + quality 100
 *
 * Ejecutar: node scripts/generate-circular-icons.js
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const LOGO = path.join(PUBLIC_DIR, "images", "logo.png");

// Colores de marca REP
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const BRAND_GREEN = { r: 16, g: 185, b: 129, alpha: 1 };   // #10B981
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const RESIZE_OPTS = {
  fit: "contain",
  background: { r: 0, g: 0, b: 0, alpha: 0 },
  kernel: "lanczos3",
};

// === Extraer isotipo del logo oficial ===
async function extractIsotipo() {
  const meta = await sharp(LOGO).metadata();
  const size = Math.min(meta.height, meta.width); // 138
  const buffer = await sharp(LOGO)
    .extract({ left: 0, top: 0, width: size, height: size })
    .toBuffer();
  return sharp(buffer);
}

// === Generar SVG del círculo blanco ===
// Dibuja un círculo blanco perfecto, anti-aliased, ocupando el 90% del canvas.
// El 10% restante es transparente (para que se vea bien en pestañas oscuras).
function buildCircleSvg(canvasSize, circleRatio = 0.92) {
  const center = canvasSize / 2;
  const radius = (canvasSize * circleRatio) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
  <circle cx="${center}" cy="${center}" r="${radius}" fill="#FFFFFF"/>
</svg>`;
}

// === Generar ícono circular blanco con isotipo centrado ===
// Estrategia:
//   1. Crear canvas transparente
//   2. Composite: círculo blanco (SVG vectorial, anti-aliased)
//   3. Composite: isotipo redimensionado y centrado dentro del círculo
//      El isotipo ocupa ~65% del canvas (dejando ~17% de padding dentro del círculo)
async function generateCircularIcon({
  size,
  outName,
  isotipoSrc,
  circleRatio = 0.92,     // círculo ocupa 92% del canvas
  isotipoRatio = 0.62,    // isotipo ocupa 62% del canvas (padding ~15% dentro del círculo)
  background = TRANSPARENT, // fondo del canvas (transparente por defecto)
}) {
  // 1. Buffer del círculo blanco SVG
  const circleSvg = Buffer.from(buildCircleSvg(size, circleRatio));

  // 2. Redimensionar isotipo al tamaño interno
  const isotipoSize = Math.round(size * isotipoRatio);
  const isotipoResized = await isotipoSrc
    .clone()
    .resize(isotipoSize, isotipoSize, RESIZE_OPTS)
    .toBuffer();

  // 3. Crear canvas con fondo + composite círculo + composite isotipo
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([
      { input: circleSvg, gravity: "center" },
      { input: isotipoResized, gravity: "center" },
    ])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(PUBLIC_DIR, outName));

  const stat = fs.statSync(path.join(PUBLIC_DIR, outName));
  console.log(`✓ ${outName} (${size}x${size}, ${(stat.size / 1024).toFixed(1)} KB)`);
}

// === Generar ícono maskable (cuadrado esmeralda full-bleed) ===
// Para Android home screen: el fondo debe ocupar todo el cuadrado (sin transparencia)
// porque Android aplica una máscara circular y necesita contenido debajo.
async function generateMaskableIcon({ size, outName, isotipoSrc, paddingPercent = 0.20 }) {
  const innerSize = Math.round(size * (1 - paddingPercent * 2));
  const isotipoResized = await isotipoSrc
    .clone()
    .resize(innerSize, innerSize, RESIZE_OPTS)
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_GREEN,
    },
  })
    .composite([{ input: isotipoResized, gravity: "center" }])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(PUBLIC_DIR, outName));

  const stat = fs.statSync(path.join(PUBLIC_DIR, outName));
  console.log(`✓ ${outName} (${size}x${size}, ${(stat.size / 1024).toFixed(1)} KB, maskable full-bleed)`);
}

// === Generar buffer circular (para embeber en .ico multi-res) ===
async function generateCircularBuffer({ size, isotipoSrc, circleRatio = 0.92, isotipoRatio = 0.62 }) {
  const circleSvg = Buffer.from(buildCircleSvg(size, circleRatio));
  const isotipoSize = Math.round(size * isotipoRatio);
  const isotipoResized = await isotipoSrc
    .clone()
    .resize(isotipoSize, isotipoSize, RESIZE_OPTS)
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: TRANSPARENT,
    },
  })
    .composite([
      { input: circleSvg, gravity: "center" },
      { input: isotipoResized, gravity: "center" },
    ])
    .png({ quality: 100 })
    .toBuffer();
}

// === Generar favicon.ico REAL multi-resolución ===
// Formato ICO: header (6 bytes) + dir entries (16 bytes c/u) + imágenes PNG embebidas
async function generateRealIco(isotipoSrc) {
  const sizes = [16, 32, 48];
  const pngBuffers = [];
  for (const s of sizes) {
    // Para tamaños pequeños (16, 32), agrandar ligeramente el isotipo para que se vea
    const isotipoRatio = s <= 32 ? 0.70 : 0.62;
    const circleRatio = s <= 32 ? 0.95 : 0.92;
    const buf = await generateCircularBuffer({ size: s, isotipoSrc, circleRatio, isotipoRatio });
    pngBuffers.push({ size: s, buffer: buf });
  }

  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = pngBuffers.length;
  const imagesOffset = headerSize + dirEntrySize * numImages;

  let currentOffset = imagesOffset;
  const dirEntries = [];
  for (const { size, buffer } of pngBuffers) {
    dirEntries.push({
      width: size === 256 ? 0 : size,
      height: size === 256 ? 0 : size,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      bytesInRes: buffer.length,
      imageOffset: currentOffset,
    });
    currentOffset += buffer.length;
  }

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(numImages, 4);

  const dirBuf = Buffer.alloc(dirEntrySize * numImages);
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
  console.log(`✓ favicon.ico (multi-res: ${sizes.join(", ")} px, círculo blanco, ${(icoBuffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log("=== Generando íconos circulares HD REP ===\n");

  const isotipoSrc = await extractIsotipo();
  console.log("✓ Isotipo extraído del logo oficial\n");

  // === Favicons (círculo blanco, transparente fuera del círculo) ===
  console.log("--- Favicons (círculo blanco) ---");
  await generateRealIco(isotipoSrc);
  await generateCircularIcon({ size: 16, outName: "favicon-16x16.png", isotipoSrc, isotipoRatio: 0.70, circleRatio: 0.95 });
  await generateCircularIcon({ size: 32, outName: "favicon-32x32.png", isotipoSrc, isotipoRatio: 0.68, circleRatio: 0.94 });

  // === Íconos PWA purpose=any (círculo blanco) ===
  console.log("\n--- Íconos PWA (círculo blanco, purpose=any) ---");
  await generateCircularIcon({ size: 192, outName: "icon-192.png", isotipoSrc, isotipoRatio: 0.62, circleRatio: 0.92 });
  await generateCircularIcon({ size: 512, outName: "icon-512.png", isotipoSrc, isotipoRatio: 0.62, circleRatio: 0.92 });

  // === Apple Touch Icon (iOS NO soporta transparencia → fondo esmeralda sólido + círculo blanco) ===
  console.log("\n--- Apple Touch Icon (iOS, fondo esmeralda + círculo blanco) ---");
  await generateCircularIcon({
    size: 180,
    outName: "apple-touch-icon.png",
    isotipoSrc,
    isotipoRatio: 0.60,
    circleRatio: 0.95,
    background: BRAND_GREEN, // fondo sólido esmeralda (iOS no soporta alpha)
  });

  // === Íconos maskable (Android, cuadrado esmeralda full-bleed) ===
  console.log("\n--- Íconos maskable (cuadrado esmeralda full-bleed, purpose=maskable) ---");
  await generateMaskableIcon({ size: 192, outName: "icon-maskable-192.png", isotipoSrc, paddingPercent: 0.20 });
  await generateMaskableIcon({ size: 512, outName: "icon-maskable-512.png", isotipoSrc, paddingPercent: 0.20 });

  console.log("\n=== Verificación final ===");
  const files = [
    "favicon.ico", "favicon-16x16.png", "favicon-32x32.png",
    "icon-192.png", "icon-512.png",
    "icon-maskable-192.png", "icon-maskable-512.png",
    "apple-touch-icon.png",
  ];
  for (const f of files) {
    const p = path.join(PUBLIC_DIR, f);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      // Skip metadata para .ico (sharp no lo lee)
      if (f.endsWith(".ico")) {
        console.log(`  ✓ ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
      } else {
        const meta = await sharp(p).metadata();
        console.log(`  ✓ ${f} (${meta.width}x${meta.height}, ${(stat.size / 1024).toFixed(1)} KB)`);
      }
    } else {
      console.log(`  ✗ ${f} NO EXISTE`);
    }
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
