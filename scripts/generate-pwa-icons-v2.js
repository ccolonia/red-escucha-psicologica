#!/usr/bin/env node
/**
 * Genera íconos PWA físicos en /public:
 *   - icon-192.png (192x192, fondo esmeralda, purpose=any)
 *   - icon-512.png (512x512, fondo esmeralda, purpose=any)
 *   - icon-maskable-192.png (192x192 con padding 10% para safe area Android)
 *   - icon-maskable-512.png (512x512 con padding 10%)
 *   - apple-touch-icon.png (180x180, fondo esmeralda)
 *   - favicon.ico (32x32 multi-resolución dentro del .ico)
 *
 * Genera los íconos DESDE EL SVG del logo (public/logo.svg) para máxima
 * nitidez vectorial, en lugar de escalar un PNG rasterizado.
 *
 * El SVG original tiene viewBox 0 0 30 30 con fondo oscuro (#2D2D2D) y
 * forma "Z" blanca. Para la PWA reemplazamos el fondo oscuro por el verde
 * esmeralda de marca (#10B981) para mayor contraste en home screen.
 *
 * Ejecutar: node scripts/generate-pwa-icons-v2.js
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SOURCE_SVG = path.join(PUBLIC_DIR, "logo.svg");

// Verde esmeralda de marca REP (theme_color del manifest)
const BRAND_GREEN = { r: 16, g: 185, b: 129, alpha: 1 };

// === SVG modificado con fondo esmeralda ===
// Tomamos el SVG original y le cambiamos el fill del path del fondo
// de #2D2D2D a #10B981. El interior "Z" blanco se mantiene.
function buildBrandedSvg(size) {
  // viewBox del SVG original es 0 0 30 30
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="${size}" height="${size}">
  <defs>
    <style>
      .bg { fill: #10B981; }
      .fg { fill: #FFFFFF; }
    </style>
  </defs>
  <g>
    <!-- Fondo cuadrado redondeado esmeralda -->
    <path class="bg" d="M24.51,28.51H5.49c-2.21,0-4-1.79-4-4V5.49c0-2.21,1.79-4,4-4h19.03c2.21,0,4,1.79,4,4v19.03
      C28.51,26.72,26.72,28.51,24.51,28.51z"/>
    <!-- Isotipo "Z" blanco (mismo path del logo original) -->
    <g>
      <path class="fg" d="M15.47,7.1l-1.3,1.85c-0.2,0.29-0.54,0.47-0.9,0.47h-7.1V7.09C6.16,7.1,15.47,7.1,15.47,7.1z"/>
      <polygon class="fg" points="24.3,7.1 13.14,22.91 5.7,22.91 16.86,7.1"/>
      <path class="fg" d="M14.53,22.91l1.31-1.86c0.2-0.29,0.54-0.47,0.9-0.47h7.09v2.33H14.53z"/>
    </g>
  </g>
</svg>`;
}

async function generateIcon(size, outName, { padding = 0 } = {}) {
  const svgBuffer = Buffer.from(buildBrandedSvg(size));
  let pipeline = sharp(svgBuffer);

  if (padding > 0) {
    // Para maskable: agregar padding del `padding`% con fondo esmeralda
    const pad = Math.round(size * padding);
    pipeline = pipeline.extend({
      top: pad, bottom: pad, left: pad, right: pad,
      background: BRAND_GREEN,
    });
    // Después de extender, el tamaño real es size + 2*pad. Redimensionar a size.
    pipeline = pipeline.resize(size, size, { fit: "fill" });
  }

  const outPath = path.join(PUBLIC_DIR, outName);
  await pipeline.png().toFile(outPath);
  console.log(`✓ ${outName} (${size}x${size}${padding ? ` +${Math.round(padding*100)}% padding` : ""})`);
}

async function generateAppleTouchIcon() {
  // Apple recomienda 180x180 SIN transparencia (fondo sólido)
  const svgBuffer = Buffer.from(buildBrandedSvg(180));
  await sharp(svgBuffer)
    .flatten({ background: BRAND_GREEN }) // aplanar transparencia sobre verde
    .png()
    .toFile(path.join(PUBLIC_DIR, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png (180x180, fondo sólido)");
}

async function generateFavicon() {
  // favicon.ico multi-resolución: 16x16 + 32x32 + 48x48 embebidos
  // Sharp no genera .ico directamente, pero un PNG renombrado a .ico
  // funciona en la mayoría de navegadores modernos. Para máxima compatibilidad
  // generamos un PNG 32x32 y lo guardamos como .ico.
  const svgBuffer = Buffer.from(buildBrandedSvg(32));
  await sharp(svgBuffer)
    .flatten({ background: BRAND_GREEN })
    .png()
    .toFile(path.join(PUBLIC_DIR, "favicon.ico"));
  console.log("✓ favicon.ico (32x32, formato PNG compatible)");
}

async function main() {
  console.log("=== Generando íconos PWA REP ===\n");

  // Verificar que sharp esté disponible
  try {
    require("sharp");
  } catch {
    console.error("✗ Sharp no está instalado. Ejecutar: npm install sharp");
    process.exit(1);
  }

  // Íconos estándar (purpose=any)
  await generateIcon(192, "icon-192.png");
  await generateIcon(512, "icon-512.png");

  // Íconos maskable (con padding 10% para safe area Android)
  await generateIcon(192, "icon-maskable-192.png", { padding: 0.1 });
  await generateIcon(512, "icon-maskable-512.png", { padding: 0.1 });

  // Apple touch icon (iOS Safari home screen)
  await generateAppleTouchIcon();

  // Favicon
  await generateFavicon();

  // Favicons PNG adicionales (16x16, 32x32) para <link rel="icon">
  const svg16 = Buffer.from(buildBrandedSvg(16));
  await sharp(svg16).flatten({ background: BRAND_GREEN }).png().toFile(path.join(PUBLIC_DIR, "favicon-16x16.png"));
  console.log("✓ favicon-16x16.png");

  const svg32 = Buffer.from(buildBrandedSvg(32));
  await sharp(svg32).flatten({ background: BRAND_GREEN }).png().toFile(path.join(PUBLIC_DIR, "favicon-32x32.png"));
  console.log("✓ favicon-32x32.png");

  console.log("\n=== Verificación final ===");
  const files = [
    "icon-192.png", "icon-512.png",
    "icon-maskable-192.png", "icon-maskable-512.png",
    "apple-touch-icon.png", "favicon.ico",
    "favicon-16x16.png", "favicon-32x32.png",
  ];
  for (const f of files) {
    const p = path.join(PUBLIC_DIR, f);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      console.log(`  ✓ ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`  ✗ ${f} NO EXISTE`);
    }
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
