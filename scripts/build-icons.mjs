// Draws the SchoolHub app icons (gold open book in a gold ring on black) as
// PNG files, without any image library: node scripts/build-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GOLD = [212, 175, 55];
const BG = [5, 5, 5];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixels) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    pixels.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Coverage (0..1) of the gold artwork at a point in unit coordinates. */
function art(x, y, scale) {
  const cx = 0.5, cy = 0.5;
  const d = Math.hypot((x - cx) / scale, (y - cy) / scale);
  if (Math.abs(d - 0.36) < 0.018) return 0.55; // ring
  const ux = (x - cx) / scale + 0.5, uy = (y - cy) / scale + 0.5;
  const left = [[0.30, 0.37], [0.485, 0.41], [0.485, 0.66], [0.30, 0.62]];
  const right = [[0.515, 0.41], [0.70, 0.37], [0.70, 0.62], [0.515, 0.66]];
  if (inPolygon(ux, uy, left) || inPolygon(ux, uy, right)) return 1;
  return 0;
}

function render(size, scale) {
  const px = Buffer.alloc(size * size * 3);
  const ss = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        cover += art((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, scale);
      }
      cover /= ss * ss;
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] + (GOLD[c] - BG[c]) * cover);
    }
  }
  return png(size, px);
}

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'icon-192.png'), render(192, 1));
writeFileSync(path.join(out, 'icon-512.png'), render(512, 1));
// Maskable icons keep the artwork inside the central safe zone.
writeFileSync(path.join(out, 'icon-maskable-512.png'), render(512, 0.8));
writeFileSync(path.join(out, 'apple-touch-icon.png'), render(180, 0.9));
console.log('Icons written to', out);
