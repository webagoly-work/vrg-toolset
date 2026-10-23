#!/usr/bin/env node
// label_fit.js - how the CYD lays out each MAKROK label (the same rules as drawBtnLabel in
// pages.ino): 15 px on two lines, else 12 px on three, else 12 px with long words hyphenated at
// a Hungarian syllable break (the most even one that fits; characters only as a last resort);
// lines break at spaces and after '-'; 68 px per line (76 px button - 8).
//
//   node label_fit.js              list every default / preset label and the try it needed
//   node label_fit.js --png <out>  also draw the buttons with the real font bitmaps (headless Edge)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const src = fs.readFileSync(path.join(__dirname, '../../source/planner_cyd/fonts_hu.h'), 'utf8');
const RAW = {};
for (const m of src.matchAll(/static const uint8_t (\w+)\[\] PROGMEM = \{([^}]*)\}/g))
  RAW[m[1]] = Buffer.from(m[2].match(/0x[0-9a-f]{2}/g).map(h => parseInt(h, 16)));
function adv(id) {
  const b = RAW[id], n = b.readInt32BE(0), a = {};
  for (let i = 0; i < n; i++) a[b.readInt32BE(24 + i * 28)] = b.readInt32BE(24 + i * 28 + 12);
  return t => [...t].reduce((w, c) => w + (a[c.codePointAt(0)] || 4), 0);
}
const W = { HU_R15: adv('HU_R15'), HU_R12: adv('HU_R12') };
const MAXW = 68;
const TRIES = [{ font: 'HU_R15', maxLines: 2, lineH: 17, brk: false }, { font: 'HU_R12', maxLines: 3, lineH: 14, brk: false }, { font: 'HU_R12', maxLines: 3, lineH: 14, brk: true }];

// Hungarian syllable breaks: a digraph (cs dz dzs gy ly ny sz ty zs) is one letter, and between
// two vowels the last consonant starts the next syllable. Character offsets, 2+ letters each side.
const VOWELS = new Set([...'aáeéiíoóöőuúüűAÁEÉIÍOÓÖŐUÚÜŰ']);
const DIGRAPHS = ['dzs', 'cs', 'dz', 'gy', 'ly', 'ny', 'sz', 'ty', 'zs'];
function syllableBreaks(word) {
  const ch = [...word], starts = [], isV = [];
  for (let i = 0; i < ch.length;) {
    let took = 1;
    for (const d of DIGRAPHS) if (ch.slice(i, i + d.length).join('').toLowerCase() === d) { took = d.length; break; }
    starts.push(i); isV.push(VOWELS.has(ch[i])); i += took;
  }
  const at = [];
  for (let i = 1; i < starts.length; i++) {
    if (!isV[i] || isV[i - 1]) continue;
    let j = i - 1; while (j > 0 && !isV[j - 1]) j--;
    const b = starts[i - 1];
    if (j > 0 && b >= 2 && ch.length - b >= 2) at.push(b);
  }
  return at;
}

function wrap(s, width, maxLines, brk) {
  const out = [''];
  const toks = [];
  for (const word of s.split(' ').filter(Boolean)) for (const t of word.split(/(?<=-)/)) toks.push(t);
  for (const tok of toks) {
    let n = out.length - 1;
    if (out[n]) {
      const cand = out[n] + (out[n].endsWith('-') ? '' : ' ') + tok;
      if (width(cand) <= MAXW) { out[n] = cand; continue; }
      if (out.length >= maxLines) return null;
      out.push(''); n++;
    }
    if (width(tok) <= MAXW) { out[n] = tok; continue; }
    if (!brk) return null;
    // the most even syllable break where both halves fit
    let best = null;
    for (const b of syllableBreaks(tok)) {
      const p1 = [...tok].slice(0, b).join('') + '-', p2 = [...tok].slice(b).join('');
      const w1 = width(p1), w2 = width(p2);
      if (w1 <= MAXW && w2 <= MAXW && (!best || Math.abs(w1 - w2) < best.d)) best = { p1, p2, d: Math.abs(w1 - w2) };
    }
    if (best) {
      out[out.length - 1] = best.p1;
      if (out.length >= maxLines) return null;
      out.push(best.p2);
      continue;
    }
    let rest = [...tok];
    while (rest.length) {
      let k = 1;
      while (k < rest.length && width(rest.slice(0, k + 1).join('') + (k + 1 < rest.length ? '-' : '')) <= MAXW) k++;
      if (k < rest.length) { out[out.length - 1] = rest.slice(0, k).join('') + '-'; if (out.length >= maxLines) return null; out.push(''); }
      else out[out.length - 1] = rest.join('');
      rest = rest.slice(k);
    }
  }
  return out.filter(Boolean);
}

function layout(label) {
  for (let i = 0; i < TRIES.length; i++) {
    const t = TRIES[i], ls = wrap(label, W[t.font], t.maxLines, t.brk);
    if (ls) return Object.assign({ tryNo: i + 1, lines: ls }, t);
  }
  return { tryNo: 4, lines: [label], font: 'HU_R12', lineH: 14 };
}

const { PRESETS, DEFAULTS } = require('../bridge/macros');
const all = [...new Map([...DEFAULTS, ...PRESETS].map(p => [p.label, p])).values()];
const NAMES = ['', '15 px, 2 lines', '12 px, 3 lines', '12 px, hyphenated', 'CUT'];
const count = [0, 0, 0, 0, 0];
for (const p of all) {
  const l = layout(p.label);
  count[l.tryNo]++;
  if (l.tryNo > 1) console.log(`${NAMES[l.tryNo].padEnd(18)} ${p.label.padEnd(22)} -> ${l.lines.join(' / ')}`);
}
console.log(`${all.length} labels: ${count[1]} at 15 px, ${count[2]} at 12 px, ${count[3]} hyphenated, ${count[4]} cut`);

const pi = process.argv.indexOf('--png');
if (pi > 0) {
  const out = path.resolve(process.argv[pi + 1]);
  const cells = all.map(p => ({ color: p.color, l: layout(p.label) }));
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><canvas id="c"></canvas><script>
const F=${JSON.stringify({ HU_R15: RAW.HU_R15.toString('base64'), HU_R12: RAW.HU_R12.toString('base64') })},C=${JSON.stringify(cells)};
function parse(b64){const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),v=new DataView(b.buffer),n=v.getInt32(0),g={};let p=24+n*28;
  for(let i=0;i<n;i++){const o=24+i*28;g[v.getInt32(o)]={h:v.getInt32(o+4),w:v.getInt32(o+8),adv:v.getInt32(o+12),dY:v.getInt32(o+16),dX:v.getInt32(o+20),off:p};p+=v.getInt32(o+4)*v.getInt32(o+8);}
  return {b,g,asc:v.getInt32(16),desc:v.getInt32(20)};}
const FT={HU_R15:parse(F.HU_R15),HU_R12:parse(F.HU_R12)},Z=2,COLS=6,BW=76,BH=67,GX=80,GY=71;
const c=document.getElementById('c');c.width=(COLS*GX+4)*Z;c.height=(Math.ceil(C.length/COLS)*GY+4)*Z;
const x=c.getContext('2d'),img=x.createImageData(c.width,c.height);
function px(X,Y,r,g,b,a){if(X<0||Y<0||X>=c.width/Z||Y>=c.height/Z)return;for(let zy=0;zy<Z;zy++)for(let zx=0;zx<Z;zx++){const k=((Y*Z+zy)*c.width+X*Z+zx)*4;
  img.data[k]=img.data[k]*(1-a)+r*a;img.data[k+1]=img.data[k+1]*(1-a)+g*a;img.data[k+2]=img.data[k+2]*(1-a)+b*a;img.data[k+3]=255;}}
for(let i=0;i<img.data.length;i+=4)img.data[i+3]=255;
C.forEach((cell,i)=>{const bx=4+(i%COLS)*GX,by=4+Math.floor(i/COLS)*GY,v=parseInt(cell.color.slice(1),16),r=v>>16,g=(v>>8)&255,b=v&255;
  for(let y=0;y<BH;y++)for(let X=0;X<BW;X++){const cx=Math.min(X,BW-1-X),cy=Math.min(y,BH-1-y);if(cx<6&&cy<6&&Math.hypot(6-cx,6-cy)>6)continue;px(bx+X,by+y,r,g,b,1);}
  const dark=(r*299+g*587+b*114)/1000>160,ink=dark?[8,11,18]:[240,244,250],f=FT[cell.l.font],n=cell.l.lines.length;
  cell.l.lines.forEach((line,j)=>{const w=[...line].reduce((s,ch)=>s+(f.g[ch.codePointAt(0)]||{adv:4}).adv,0);
    const cy=by+BH/2-(n-1)*cell.l.lineH/2+j*cell.l.lineH,base=Math.round(cy+(f.asc-f.desc)/2);let X=Math.round(bx+BW/2-w/2);
    for(const ch of line){const gl=f.g[ch.codePointAt(0)];if(!gl){X+=4;continue;}
      for(let r2=0;r2<gl.h;r2++)for(let q=0;q<gl.w;q++){const a=f.b[gl.off+r2*gl.w+q]/255;if(a)px(X+gl.dX+q,base-gl.dY+r2,ink[0],ink[1],ink[2],a);}X+=gl.adv;}});});
x.putImageData(img,0,0);</script>`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cydlab-'));
  fs.writeFileSync(path.join(tmp, 'p.html'), html);
  const w = (6 * 80 + 4) * 2, h = (Math.ceil(cells.length / 6) * 71 + 4) * 2;
  try {
    execFileSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(tmp, 'prof')}`,
      `--window-size=${w},${h}`, `--screenshot=${out}`, 'file:///' + path.join(tmp, 'p.html').replace(/\\/g, '/')], { stdio: 'ignore', timeout: 60000 });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log('wrote', out);
}
process.exit(count[4] ? 1 : 0);
