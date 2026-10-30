#!/usr/bin/env node
// make_fonts.js - builds the CYD's Hungarian fonts (source/planner_cyd/fonts_hu.h).
//
// The LovyanGFX built-in fonts are ASCII only, so ő, ű and the accented capitals cannot be
// drawn. This rasterises Liberation Sans (SIL Open Font License 1.1, from the vendored pdf.js)
// in headless Chrome, anti-aliased, and writes the glyphs as VLW fonts (the smooth-font
// format LovyanGFX loads from flash). Only the glyphs the UI needs: ASCII, the Hungarian
// accented letters and a few symbols, so each font is a few tens of KB.
//
// The OFL reserves the name "Liberation" for unmodified fonts, so these are called HuSans.
// Its licence goes next to the header as fonts_hu_OFL.txt.
//
//   node make_fonts.js                     uses Edge (the portable Chrome's sandbox cannot run from H:)
//   node make_fonts.js --chrome <path>     or any Chrome / Edge
//
// Run it again only to change the sizes or the glyph set; the generated header is committed.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '../../../..');
const FONT_DIR = path.join(REPO, 'Vendor/pdfjs/standard_fonts');
const OUT = path.join(__dirname, '../../source/planner_cyd/fonts_hu.h');
const OFL_OUT = path.join(__dirname, '../../source/planner_cyd/fonts_hu_OFL.txt');
const argv = process.argv.slice(2);
const CHROME = argv.includes('--chrome') ? argv[argv.indexOf('--chrome') + 1]
  : ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', path.join(REPO, '../tools/chrome/chrome.exe')].find(p => fs.existsSync(p));

// name in the header, ttf, pixel size (CSS px = em), what it replaces in the UI
const FONTS = [
  { id: 'HU_R15', ttf: 'LiberationSans-Regular.ttf', px: 15, note: 'body text (was Font2)' },
  { id: 'HU_R12', ttf: 'LiberationSans-Regular.ttf', px: 12, note: 'button labels that do not fit at 15 px' },
  { id: 'HU_B18', ttf: 'LiberationSans-Bold.ttf', px: 18, note: 'titles (was FreeSansBold9pt7b)' },
  { id: 'HU_B24', ttf: 'LiberationSans-Bold.ttf', px: 24, note: 'the running tool (was FreeSansBold12pt7b)' }
];
let CHARS = '';
for (let c = 0x20; c <= 0x7e; c++) CHARS += String.fromCharCode(c);
CHARS += 'áéíóöőúüűÁÉÍÓÖŐÚÜŰ°–…·×';

if (!CHROME) { console.error('No Chrome/Edge found; pass --chrome <path>.'); process.exit(1); }

// ---- the page that rasterises: one canvas per glyph, alpha from the red channel
function pageHtml() {
  const fonts = FONTS.map(f => ({ id: f.id, px: f.px, b64: fs.readFileSync(path.join(FONT_DIR, f.ttf)).toString('base64') }));
  return `<!doctype html><meta charset="utf-8"><body><pre id="out">pending</pre><script>
const FONTS=${JSON.stringify(fonts)};const CHARS=${JSON.stringify(CHARS)};
(async()=>{const res={};
for(const f of FONTS){
  const ff=new FontFace('F'+f.id,'url(data:font/ttf;base64,'+f.b64+')');await ff.load();document.fonts.add(ff);
  const S=f.px*3,pad=f.px,cv=document.createElement('canvas');cv.width=S;cv.height=S;
  const g=cv.getContext('2d',{willReadFrequently:true});g.font=f.px+'px "F'+f.id+'"';
  const asc=Math.round(g.measureText('d').actualBoundingBoxAscent),desc=Math.round(g.measureText('p').actualBoundingBoxDescent);
  const glyphs=[];
  for(const ch of CHARS){
    g.fillStyle='#000';g.fillRect(0,0,S,S);g.fillStyle='#fff';g.textBaseline='alphabetic';g.fillText(ch,pad,pad*2);
    const adv=Math.round(g.measureText(ch).width),d=g.getImageData(0,0,S,S).data;
    let x0=S,y0=S,x1=-1,y1=-1;
    for(let y=0;y<S;y++)for(let x=0;x<S;x++)if(d[(y*S+x)*4]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1<0){glyphs.push({u:ch.codePointAt(0),w:0,h:0,adv,dY:0,dX:0,a:''});continue;}
    const w=x1-x0+1,h=y1-y0+1,a=[];
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)a.push(d[(y*S+x)*4]);
    glyphs.push({u:ch.codePointAt(0),w,h,adv,dY:pad*2-y0,dX:x0-pad,a:btoa(String.fromCharCode(...a))});
  }
  res[f.id]={px:f.px,asc,desc,glyphs};
}
document.getElementById('out').textContent=JSON.stringify(res);})().catch(e=>{document.getElementById('out').textContent='ERR '+e;});
</script>`;
}

// ---- VLW: 6 x int32 header, 7 x int32 metrics per glyph, then the 8-bit alpha bitmaps (big-endian)
function vlw(f) {
  const gl = f.glyphs.slice().sort((a, b) => a.u - b.u);
  const head = Buffer.alloc(24 + gl.length * 28);
  head.writeInt32BE(gl.length, 0); head.writeInt32BE(11, 4); head.writeInt32BE(f.px, 8);
  head.writeInt32BE(0, 12); head.writeInt32BE(f.asc, 16); head.writeInt32BE(f.desc, 20);
  const maps = [];
  gl.forEach((g, i) => {
    const o = 24 + i * 28;
    [g.u, g.h, g.w, g.adv, g.dY, g.dX, 0].forEach((v, k) => head.writeInt32BE(v, o + k * 4));
    maps.push(Buffer.from(g.a, 'base64'));
  });
  return Buffer.concat([head, ...maps]);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cydfont-'));
const html = path.join(tmp, 'fonts.html');
fs.writeFileSync(html, pageHtml());
const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${path.join(tmp, 'profile')}`,
  '--virtual-time-budget=20000', '--dump-dom', 'file:///' + html.replace(/\\/g, '/')], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120000 });
const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
if (!m || !m[1].startsWith('{')) { console.error('Rasteriser said:', m ? m[1].slice(0, 300) : dom.slice(0, 300)); process.exit(1); }
const res = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));

let out = `// fonts_hu.h - GENERATED by app/tools/make_fonts.js, do not edit.
// HuSans: VLW smooth fonts rasterised from Liberation Sans (SIL Open Font License 1.1,
// see fonts_hu_OFL.txt). Glyphs: ASCII, ${'áéíóöőúüű ÁÉÍÓÖŐÚÜŰ'} and ° – … · ×.
#pragma once
#include <stdint.h>
`;
for (const f of FONTS) {
  const b = vlw(res[f.id]);
  out += `\n// ${f.id}: ${f.px} px, ${res[f.id].glyphs.length} glyphs, ${b.length} bytes - ${f.note}\nstatic const uint8_t ${f.id}[] PROGMEM = {\n`;
  for (let i = 0; i < b.length; i += 24) out += '  ' + [...b.subarray(i, i + 24)].map(x => '0x' + x.toString(16).padStart(2, '0')).join(',') + ',\n';
  out += '};\n';
  console.log(`${f.id}: ${f.px}px, ascent ${res[f.id].asc}, descent ${res[f.id].desc}, ${b.length} bytes`);
}
fs.writeFileSync(OUT, out);
fs.copyFileSync(path.join(FONT_DIR, 'LICENSE_LIBERATION'), OFL_OUT);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', path.relative(REPO, OUT));
