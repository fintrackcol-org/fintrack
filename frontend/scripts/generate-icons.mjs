/**
 * Genera los íconos de la PWA (public/icons) y las pantallas de carga de iOS (public/splash)
 * a partir de la misma geometría de LogoMark (src/components/common/Logo.jsx).
 * Sin dependencias: dibuja cada píxel y escribe el PNG con node:zlib.
 *
 * Uso (desde frontend/, con Node 22.2 o superior por zlib.crc32): npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Mismos valores que LogoMark, en su cuadrícula de 32 × 32.
const GRID = 32;
const TILE_RADIUS = 8;
const VIOLET = [0x61, 0x42, 0xff];
const MINT = [0x2f, 0xd6, 0xa3];
// La "r": asta de (9.75, 21.5) a (9.75, 16.25) y brazo de radio 5.75 hasta (15.5, 10.5); trazo de 4.25.
const STEM = { x: 9.75, top: 16.25, bottom: 21.5 };
const ARM = { cx: 15.5, cy: 16.25, radius: 5.75 };
const STROKE = 4.25;
const COIN = { cx: 22, cy: 10.5, radius: 2.375 };

// Fondo de las pantallas de carga: coincide con background_color del manifest.
const SPLASH_BACKGROUND = [0, 0, 0];
const SPLASH_SIZES = [
  [750, 1334],
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1290, 2796],
  [1640, 2360],
];

// Matriz de Bayer: reparte el redondeo a 8 bits para que el degradado no forme escalones visibles.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Distancia con signo a un rectángulo redondeado: negativa adentro, positiva afuera. */
function roundedRectDistance(px, py, x, y, width, height, radius) {
  const qx = Math.abs(px - (x + width / 2)) - width / 2 + radius;
  const qy = Math.abs(py - (y + height / 2)) - height / 2 + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Distancia con signo a la "r" (trazo de puntas redondas): negativa adentro. */
function letterDistance(px, py) {
  const stem = Math.hypot(px - STEM.x, py - Math.min(Math.max(py, STEM.top), STEM.bottom));
  const dx = px - ARM.cx;
  const dy = py - ARM.cy;
  // El brazo es el cuarto de círculo de arriba a la izquierda; fuera de él manda la punta más cercana.
  const arm =
    dx <= 0 && dy <= 0
      ? Math.abs(Math.hypot(dx, dy) - ARM.radius)
      : Math.min(Math.hypot(px - STEM.x, py - STEM.top), Math.hypot(dx, dy + ARM.radius));
  return Math.min(stem, arm) - STROKE / 2;
}

/** Cobertura del píxel (0 a 1) según su distancia al borde, medida en píxeles: suaviza el contorno. */
const coverage = (distance) => Math.min(Math.max(0.5 - distance, 0), 1);

const mix = (from, to, amount) => from + (to - from) * amount;

/**
 * Pinta el logo sobre un lienzo RGBA.
 * @param {{ pixels: Float64Array, width: number, height: number }} canvas
 * @param {{ left: number, top: number, size: number, artScale?: number, rounded?: boolean }} options
 * `artScale` encoge solo la r y la moneda (ícono maskable); `rounded: false` llena el cuadro entero.
 */
function drawLogo({ pixels, width, height }, { left, top, size, artScale = 1, rounded = true }) {
  const scale = size / GRID;
  const radius = rounded ? TILE_RADIUS * scale : 0;
  const endX = Math.min(width, Math.ceil(left + size));
  const endY = Math.min(height, Math.ceil(top + size));

  for (let y = Math.max(0, Math.floor(top)); y < endY; y += 1) {
    for (let x = Math.max(0, Math.floor(left)); x < endX; x += 1) {
      const px = x + 0.5 - left;
      const py = y + 0.5 - top;
      const tile = coverage(roundedRectDistance(px, py, 0, 0, size, size, radius));
      if (tile === 0) continue;

      const color = [...VIOLET];

      // La r y la moneda se escalan respecto al centro del cuadro.
      const artX = (px - size / 2) / (scale * artScale) + GRID / 2;
      const artY = (py - size / 2) / (scale * artScale) + GRID / 2;
      const artPixel = 1 / (scale * artScale);
      const white = coverage(letterDistance(artX, artY) / artPixel);
      const mint = coverage((Math.hypot(artX - COIN.cx, artY - COIN.cy) - COIN.radius) / artPixel);
      for (let channel = 0; channel < 3; channel += 1) {
        color[channel] = mix(mix(color[channel], 255, white), MINT[channel], mint);
      }

      const offset = (y * width + x) * 4;
      const below = pixels[offset + 3];
      const alpha = tile + below * (1 - tile);
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] =
          (color[channel] * tile + pixels[offset + channel] * below * (1 - tile)) / alpha;
      }
      pixels[offset + 3] = alpha;
    }
  }
}

function createCanvas(width, height, background) {
  const pixels = new Float64Array(width * height * 4);
  if (background) {
    for (let offset = 0; offset < pixels.length; offset += 4) {
      pixels.set([...background, 1], offset);
    }
  }
  return { pixels, width, height };
}

function pngChunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/** Convierte el lienzo a PNG. Sin transparencia usa RGB: iOS pide el apple-touch-icon opaco. */
function encodePng({ pixels, width, height }, { transparent }) {
  const channels = transparent ? 4 : 3;
  const rowLength = width * channels + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowLength;
    for (let x = 0; x < width; x += 1) {
      const threshold = (BAYER[y % 4][x % 4] + 0.5) / 16;
      const source = (y * width + x) * 4;
      const target = rowStart + 1 + x * channels;
      for (let channel = 0; channel < 3; channel += 1) {
        raw[target + channel] = Math.min(Math.floor(pixels[source + channel] + threshold), 255);
      }
      if (transparent) raw[target + 3] = Math.round(pixels[source + 3] * 255);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits por canal
  header[9] = transparent ? 6 : 2; // 6: RGBA, 2: RGB

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function save(relativePath, canvas, { transparent = false } = {}) {
  const path = join(PUBLIC_DIR, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(canvas, { transparent }));
  console.log(`  ${relativePath}`);
}

function icon(relativePath, size, options) {
  const canvas = createCanvas(size, size);
  drawLogo(canvas, { left: 0, top: 0, size, ...options });
  save(relativePath, canvas, { transparent: options.rounded !== false });
}

function splash(width, height) {
  const canvas = createCanvas(width, height, SPLASH_BACKGROUND);
  const size = Math.round(Math.min(width * 0.28, height * 0.14));
  drawLogo(canvas, { left: Math.round((width - size) / 2), top: Math.round((height - size) / 2), size });
  save(`splash/splash-${width}x${height}.png`, canvas);
}

console.log('Generando íconos y pantallas de carga:');
icon('icons/icon-192.png', 192, {});
icon('icons/icon-512.png', 512, {});
// Sin esquinas: iOS y Android recortan el ícono con su propia máscara.
icon('icons/apple-touch-icon.png', 180, { rounded: false });
// La r y la moneda más pequeñas para que quepan en la zona segura (círculo central del 80 %).
icon('icons/maskable-512.png', 512, { rounded: false, artScale: 0.8 });
for (const [width, height] of SPLASH_SIZES) splash(width, height);
