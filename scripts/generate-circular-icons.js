#!/usr/bin/env node
/**
 * Genera íconos HD de REP con isotipo MAXIMIZADO dentro del círculo blanco.
 *
 * Problema anterior: el isotipo ocupaba solo 62% del canvas → se veía chico e ilegible.
 * Solución: crop ajustado al bounding box del isotipo + escala al 88% del círculo.
 *
 * Diseño:
 *   - Canvas transparente cuadrado
 *   - Círculo blanco puro (#FFFFFF) ocupando 95% del canvas
 *   - Isotipo oficial REP recortado a su bounding box y escalado a 88% del canvas
 *     (≈5% de margen entre el isotipo y el borde del círculo)
 *
 * Para tamaños pequeños (16, 32):
 *   - Renderizar a 4x (64, 128) y downscalear con sharpening
 *   - Esto engrosa visualmente los trazos finos del isotipo
 *
 * Salidas en /public:
 *   - favicon.ico (16+32+48 multi-res real)
 *   - favicon-16x16.png, favicon-32x32.png
 *   - icon-192.png, icon-512.png (purpose=any)
 *   - apple-touch-icon.png (180x180, fondo esmeralda + círculo blanco)
 *   - icon-maskable-192.png, icon-maskable-512.png (purpose=maskable, cuadrado esmeralda)
 *
 * Ejecutar: node scripts/generate-circular-icons.js
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const LOGO = path.join(PUBLIC_DIR, "images", "logo.png");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const BRAND_GREEN = { r: 16, g: 185, b: 129, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const RESIZE_OPTS = {
  fit: "contain",
  background: { r: 0, g: 0, b: 0, alpha: 0 },
  kernel: "lanczos3",
};

// === Extraer isotipo con crop ajustado al bounding box ===
// En lugar de tomar el cuadrado 138x138 completo (que tiene mucho espacio vacío),
// detectamos los píxeles no transparentes y recortamos al bounding box exacto.
// Esto maximiza el tamaño del isotipo cuando lo escalamos después.
//
// Devuelve la ruta a un archivo PNG temporal. Esto evita problemas de
// reutilización de buffers en sharp cuando el mismo isotipo se procesa
// múltiples veces en paralelo.
async function extractIsotipoTight() {
  const meta = await sharp(LOGO).metadata();
  const size = Math.min(meta.height, meta.width); // 138

  // Extraer el cuadrado crudo
  const rawBuffer = await sharp(LOGO)
    .extract({ left: 0, top: 0, width: size, height: size })
    .toBuffer();

  // Analizar píxeles para encontrar el bounding box del contenido no transparente
  const { data, info } = await sharp(rawBuffer)
    .resize(64, 64, RESIZE_OPTS)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      const a = data[idx + 3];
      if (a > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const scaleX = size / info.width;
  const scaleY = size / info.height;
  const margin = 2;
  const cropLeft = Math.max(0, Math.floor(minX * scaleX) - margin);
  const cropTop = Math.max(0, Math.floor(minY * scaleY) - margin);
  const cropRight = Math.min(size, Math.ceil(maxX * scaleX) + margin);
  const cropBottom = Math.min(size, Math.ceil(maxY * scaleY) + margin);
  const cropWidth = cropRight - cropLeft;
  const cropHeight = cropBottom - cropTop;

  console.log(`  Isotipo tight crop: ${cropWidth}x${cropHeight} (de ${size}x${size})`);

  // Guardar el tight crop como archivo temporal para leerlo fresco en cada uso
  const tempPath = path.join(require("os").tmpdir(), "rep-isotipo-tight.png");
  await sharp(rawBuffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .png()
    .toFile(tempPath);

  return tempPath;
}

// === Generar SVG del círculo blanco ===
function buildCircleSvg(canvasSize, circleRatio = 0.95) {
  const center = canvasSize / 2;
  const radius = (canvasSize * circleRatio) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
  <circle cx="${center}" cy="${center}" r="${radius}" fill="#FFFFFF"/>
</svg>`;
}

// === Generar ícono circular con isotipo maximizado ===
// Para tamaños pequeños, renderizamos a 4x y downscaleamos con sharpening
// para engrosar visualmente los trazos finos.
async function generateCircularIcon({
  size,
  outName,
  isotipoSrc,
  circleRatio = 0.95,     // círculo ocupa 95% del canvas
  isotipoRatio = 0.88,    // isotipo ocupa 88% del canvas (≈5% margen dentro del círculo)
  background = TRANSPARENT,
  sharpen = false,        // aplicar sharpening para versiones pequeñas
}) {
  // Para tamaños pequeños, renderizar a 4x y downscalear
  const renderSize = size < 64 ? size * 4 : size;
  const finalRenderSize = renderSize;

  // 1. Círculo blanco rasterizado a PNG (evita problemas de SVG en composite)
  const circleSvg = Buffer.from(buildCircleSvg(finalRenderSize, circleRatio));
  const circlePng = await sharp(circleSvg)
    .resize(finalRenderSize, finalRenderSize, { fit: "fill" })
    .png()
    .toBuffer();

  // 2. Isotipo escalado al tamaño interno (88% del canvas)
  const isotipoSize = Math.round(finalRenderSize * isotipoRatio);
  let isotipoPipeline = sharp(isotipoSrc)
    .resize(isotipoSize, isotipoSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    });

  // Aplicar sharpening para versiones pequeñas (engrosa trazos finos)
  if (sharpen) {
    isotipoPipeline = isotipoPipeline.sharpen({
      sigma: 1.2,
      m1: 1.0,
      m2: 0.5,
    });
  }
  const isotipoResized = await isotipoPipeline.toBuffer();

  // 3. Composite: fondo + círculo PNG + isotipo
  // Materializar el composite ANTES de hacer el resize final (mismo fix que
  // generateCircularBuffer: sharp falla si se encadena .composite().resize())
  const compositedBuffer = await sharp({
    create: {
      width: finalRenderSize,
      height: finalRenderSize,
      channels: 4,
      background,
    },
  })
    .composite([
      { input: circlePng, gravity: "center" },
      { input: isotipoResized, gravity: "center" },
    ])
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();

  // Si renderizamos a 4x, downscalear al tamaño final con lanczos3
  let pipeline;
  if (renderSize > size) {
    pipeline = sharp(compositedBuffer).resize(size, size, { ...RESIZE_OPTS, kernel: "lanczos3" });
  } else {
    pipeline = sharp(compositedBuffer);
  }

  await pipeline.toFile(path.join(PUBLIC_DIR, outName));
  const stat = fs.statSync(path.join(PUBLIC_DIR, outName));
  console.log(`✓ ${outName} (${size}x${size}, ${(stat.size / 1024).toFixed(1)} KB${sharpen ? ", sharpened" : ""})`);
}

// === Generar buffer circular (para .ico multi-res) ===
async function generateCircularBuffer({
  size,
  isotipoSrc,
  circleRatio = 0.95,
  isotipoRatio = 0.88,
  sharpen = false,
}) {
  const renderSize = size < 64 ? size * 4 : size;

  // Rasterizar el SVG del círculo a PNG primero (evita problemas de dimensiones
  // intrínsecas del SVG al compositar)
  const circleSvg = Buffer.from(buildCircleSvg(renderSize, circleRatio));
  const circlePng = await sharp(circleSvg)
    .resize(renderSize, renderSize, { fit: "fill" })
    .png()
    .toBuffer();

  const isotipoSize = Math.round(renderSize * isotipoRatio);
  let isotipoPipeline = sharp(isotipoSrc)
    .resize(isotipoSize, isotipoSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    });
  if (sharpen) {
    isotipoPipeline = isotipoPipeline.sharpen({ sigma: 1.2, m1: 1.0, m2: 0.5 });
  }
  const isotipoResized = await isotipoPipeline.toBuffer();

  let pipeline = sharp({
    create: {
      width: renderSize,
      height: renderSize,
      channels: 4,
      background: TRANSPARENT,
    },
  })
    .composite([
      { input: circlePng, gravity: "center" },
      { input: Buffer.from(isotipoResized), gravity: "center" },
    ])
    .png({ quality: 100 });

  // Materializar el composite ANTES de hacer el resize final.
  // Si encadenamos .composite().resize(), sharp revalida las dimensiones
  // de los inputs del composite contra el tamaño final (más pequeño) y falla.
  const compositedBuffer = await pipeline.toBuffer();

  if (renderSize > size) {
    return sharp(compositedBuffer)
      .resize(size, size, { ...RESIZE_OPTS, kernel: "lanczos3" })
      .png({ quality: 100 })
      .toBuffer();
  }

  return compositedBuffer;
}

// === Generar favicon.ico REAL multi-resolución ===
async function generateRealIco(isotipoSrc) {
  const sizes = [16, 32, 48];
  const pngBuffers = [];
  for (const s of sizes) {
    // Sharpening para 16 y 32 (no para 48 que ya es más grande)
    const sharpen = s <= 32;
    const buf = await generateCircularBuffer({
      size: s,
      isotipoSrc,
      circleRatio: 0.96,
      isotipoRatio: s <= 16 ? 0.92 : 0.90,  // aún más grande en 16x16
      sharpen,
    });
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
  console.log(`✓ favicon.ico (multi-res: ${sizes.join(", ")} px, isotipo maximizado, ${(icoBuffer.length / 1024).toFixed(1)} KB)`);
}

// === Generar ícono maskable (cuadrado esmeralda full-bleed) ===
async function generateMaskableIcon({ size, outName, isotipoSrc, paddingPercent = 0.15 }) {
  // Padding reducido al 15% (antes 20%) para que el isotipo sea más grande
  const innerSize = Math.round(size * (1 - paddingPercent * 2));
  const isotipoResized = await sharp(isotipoSrc)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
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

async function main() {
  console.log("=== Generando íconos circulares HD (isotipo maximizado) ===\n");

  console.log("Extrayendo isotipo con crop ajustado al bounding box...");
  const isotipoSrc = await extractIsotipoTight();
  console.log("✓ Isotipo extraído y recortado\n");

  // === Favicons (círculo blanco, isotipo maximizado, sharpening en chicos) ===
  console.log("--- Favicons (isotipo 88-92% del círculo) ---");
  await generateRealIco(isotipoSrc);
  await generateCircularIcon({
    size: 16, outName: "favicon-16x16.png", isotipoSrc,
    circleRatio: 0.96, isotipoRatio: 0.92, sharpen: true,
  });
  await generateCircularIcon({
    size: 32, outName: "favicon-32x32.png", isotipoSrc,
    circleRatio: 0.96, isotipoRatio: 0.90, sharpen: true,
  });

  // === Íconos PWA purpose=any (círculo blanco, isotipo 88%) ===
  console.log("\n--- Íconos PWA (isotipo 88% del círculo) ---");
  await generateCircularIcon({
    size: 192, outName: "icon-192.png", isotipoSrc,
    circleRatio: 0.95, isotipoRatio: 0.88,
  });
  await generateCircularIcon({
    size: 512, outName: "icon-512.png", isotipoSrc,
    circleRatio: 0.95, isotipoRatio: 0.88,
  });

  // === Apple Touch Icon (iOS, fondo esmeralda + círculo blanco) ===
  console.log("\n--- Apple Touch Icon (iOS) ---");
  await generateCircularIcon({
    size: 180, outName: "apple-touch-icon.png", isotipoSrc,
    circleRatio: 0.96, isotipoRatio: 0.88,
    background: BRAND_GREEN,
  });

  // === Íconos maskable (Android, cuadrado esmeralda full-bleed) ===
  console.log("\n--- Íconos maskable (cuadrado esmeralda, padding 15%) ---");
  await generateMaskableIcon({ size: 192, outName: "icon-maskable-192.png", isotipoSrc, paddingPercent: 0.15 });
  await generateMaskableIcon({ size: 512, outName: "icon-maskable-512.png", isotipoSrc, paddingPercent: 0.15 });

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
      if (f.endsWith(".ico")) {
        console.log(`  ✓ ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
      } else {
        const meta = await sharp(p).metadata();
        console.log(`  ✓ ${f} (${meta.width}x${meta.height}, ${(stat.size / 1024).toFixed(1)} KB)`);
      }
    }
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
