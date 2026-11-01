#!/usr/bin/env node
/* Draws the app icon: a tick ring and a V, kept inside the maskable safe zone. Writes icon.svg and renders the
   PNGs here, with no browser or image library: PWA icons into www/icons, launcher icons into android-res. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUND = [0x12, 0x1b, 0x22];
const CYAN = [0x7e, 0xd3, 0xdf];
const CORNER = 96;
const TICK = 8;
const STROKE = 36;

const point = (a, r) => [256 + r * Math.cos(a), 256 + r * Math.sin(a)];
const TICKS = Array.from({ length: 48 }, (_, i) => {
  const a = (i * Math.PI) / 24;
  return [point(a, i % 12 === 0 ? 150 : 162), point(a, 176)];
});
const V = [[[176, 180], [256, 340]], [[256, 340], [336, 180]]];

function distance(x, y, [[ax, ay], [bx, by]]) {
  const [dx, dy] = [bx - ax, by - ay];
  const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - u * dx, y - ay - u * dy);
}

/* distance outside the rounded square, negative inside */
function outside(x, y, radius) {
  const [qx, qy] = [Math.abs(x - 256) - 256 + radius, Math.abs(y - 256) - 256 + radius];
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function rgba(size, radius) {
  const px = Buffer.alloc(size * size * 4);
  const scale = 512 / size;
  const cover = (d, half) => Math.max(0, Math.min(1, (half - d) / scale + 0.5));
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const [x, y] = [(i + 0.5) * scale, (j + 0.5) * scale];
      const tick = Math.max(...TICKS.map((s) => cover(distance(x, y, s), TICK / 2)));
      const v = Math.max(...V.map((s) => cover(distance(x, y, s), STROKE / 2)));
      const ink = Math.max(tick, v);
      const o = (j * size + i) * 4;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(GROUND[c] + (CYAN[c] - GROUND[c]) * ink);
      px[o + 3] = Math.round(255 * Math.max(0, Math.min(1, 0.5 - outside(x, y, radius) / scale)));
    }
  }
  return px;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([head, body, crc]);
}

function png(size, radius) {
  const px = rgba(size, radius);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let j = 0; j < size; j++) px.copy(raw, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function write(file, data) {
  const out = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, data);
}

const hex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
const lines = (segments) => segments.map(([a, b]) => `M${a.map((n) => n.toFixed(1)).join(' ')}L${b.map((n) => n.toFixed(1)).join(' ')}`).join('');
write('www/icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${CORNER}" fill="${hex(GROUND)}"/>`
  + `<path d="${lines(TICKS)}" stroke="${hex(CYAN)}" stroke-width="${TICK}" fill="none"/><path d="${lines(V)}" stroke="${hex(CYAN)}" stroke-width="${STROKE}" stroke-linecap="round" fill="none"/></svg>\n`);
for (const size of [180, 192, 512]) write(`www/icons/icon-${size}.png`, png(size, CORNER));
write('www/icons/maskable-512.png', png(512, 0));
for (const [dpi, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  write(`android-res/mipmap-${dpi}/ic_launcher.png`, png(size, CORNER));
}
console.log('icons written');
