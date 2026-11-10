// tray.js — the tray icon (WP-04): menu Ablak · Munka · Overlay · Frissítés · Kilépés, double-click shows the window.
// createTray({ Tray, Menu, nativeImage, iconPath, handlers }) with handlers = { mode(m), show(), refresh(), quit() }.
'use strict';
const fs = require('fs'), zlib = require('zlib');

// A plain 32x32 square in the D0 accent colour (--mv-accent #93d3e6), written as PNG bytes: no drawing tools.
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
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function squarePng(size = 32, rgb = [0x93, 0xd3, 0xe6]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;      // 8-bit RGB
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) { row[1 + x * 3] = rgb[0]; row[2 + x * 3] = rgb[1]; row[3 + x * 3] = rgb[2]; }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function menuTemplate(h, current = 'ablak') {
  const radio = (label, m) => ({ label, type: 'radio', checked: current === m, click: () => h.mode(m) });
  return [
    radio('Ablak', 'ablak'),
    radio('Munka (teljes képernyő)', 'munka'),
    radio('Overlay (mindig felül)', 'overlay'),
    { type: 'separator' },
    { label: 'Frissítés', click: () => h.refresh() },
    { label: 'Kilépés', click: () => h.quit() },
  ];
}

function createTray({ Tray, Menu, nativeImage, iconPath, handlers }) {
  let img = null;
  try { if (iconPath && fs.existsSync(iconPath)) img = nativeImage.createFromPath(iconPath); } catch (e) {}
  if (!img || (img.isEmpty && img.isEmpty())) img = nativeImage.createFromBuffer(squarePng());
  const tray = new Tray(img);
  tray.setToolTip('VRG Irányítópult');
  const setMode = m => tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(handlers, m)));
  setMode('ablak');
  tray.on('double-click', () => handlers.show());
  return { tray, setMode, destroy: () => { try { tray.destroy(); } catch (e) {} } };
}

module.exports = { createTray, menuTemplate, squarePng };
