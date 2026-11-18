// Renders the web app's home-screen icons (WP M36): one 180 px apple-touch-icon per palette (iOS rounds the corners
// itself and ignores SVG), and a 512 px maskable icon in Mélyvíz. Same mark and colours as the Android launcher icons
// (both come from palettes.json / img/mark.svg, written by Mobile/catalogue/icon-gen.js). Needs Playwright (dev only):
//   node Mobile/web/tools/icons.js
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const WEB = path.resolve(__dirname, '..');
const P = JSON.parse(fs.readFileSync(path.join(WEB, 'palettes.json'), 'utf8'));
const mark = fs.readFileSync(path.join(WEB, 'img/mark.svg'), 'utf8');
const vb = mark.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number), d = mark.match(/ d="([^"]+)"/)[1];

const svg = (bg, fg, size, share) => {
  const h = size * share, w = h * vb[2] / vb[3];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/>` +
    `<svg x="${(size - w) / 2}" y="${(size - h) / 2}" width="${w}" height="${h}" viewBox="${vb.join(' ')}"><path fill="${fg}" fill-rule="evenodd" d="${d}"/></svg></svg>`;
};

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ deviceScaleFactor: 1 });
  const shot = async (s, size, file) => {
    await pg.setViewportSize({ width: size, height: size });
    await pg.setContent(`<html><body style="margin:0">${s}</body></html>`);
    await pg.screenshot({ path: path.join(WEB, 'icons', file), clip: { x: 0, y: 0, width: size, height: size } });
  };
  for (const p of P.palettes) await shot(svg(p.colors.abyss, p.colors.glow, 180, 0.62), 180, `touch-${p.id}.png`);
  const m = P.palettes.find(p => p.id === P.default);
  await shot(svg(m.colors.abyss, m.colors.glow, 512, 0.52), 512, 'icon-512.png');      // maskable: the mark inside the safe circle
  await b.close();
  console.log(`icons: ${P.palettes.length} touch icons + icon-512.png`);
})();
