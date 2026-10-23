#!/usr/bin/env node
// font_preview.js - draws sample Hungarian text with the generated VLW fonts (fonts_hu.h),
// using the same metrics LovyanGFX uses, and saves a PNG through headless Edge.
//   node font_preview.js [out.png]
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const src = fs.readFileSync(path.join(__dirname, '../../source/planner_cyd/fonts_hu.h'), 'utf8');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'cyd_font_preview.png'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const fonts = {};
for (const m of src.matchAll(/static const uint8_t (\w+)\[\] PROGMEM = \{([^}]*)\}/g))
  fonts[m[1]] = Buffer.from(m[2].match(/0x[0-9a-f]{2}/g).map(h => parseInt(h, 16))).toString('base64');

const SAMPLES = [
  ['HU_R15', 'ÁLLAPOT  ESZKÖZÖK  FÁZISOK  VEZÉRLÉS  ÖSSZESÍTÉS  ÓRA'],
  ['HU_R15', 'Helyiség-toll · Vezethető fal · Kötődoboz · Áramkörök javaslata'],
  ['HU_R15', 'árvíztűrő tükörfúrógép  ÁRVÍZTŰRŐ TÜKÖRFÚRÓGÉP  0123456789'],
  ['HU_B18', 'Villamosság  ·  Nyílászárók  ·  2026. 10. 17. szombat'],
  ['HU_B24', 'Helyiség-toll   Vezethető fal   Ő Ű ő ű'],
];

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#080b12">
<canvas id="c" width="1300" height="520"></canvas><script>
const F=${JSON.stringify(fonts)},S=${JSON.stringify(SAMPLES)};
function parse(b64){const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),v=new DataView(b.buffer);
  const n=v.getInt32(0),size=v.getInt32(8),asc=v.getInt32(16),desc=v.getInt32(20),g={};let p=24+n*28;
  for(let i=0;i<n;i++){const o=24+i*28,u=v.getInt32(o),h=v.getInt32(o+4),w=v.getInt32(o+8),adv=v.getInt32(o+12),dY=v.getInt32(o+16),dX=v.getInt32(o+20);
    g[u]={h,w,adv,dY,dX,off:p};p+=w*h;}
  return {b,g,size,asc,desc};}
const c=document.getElementById('c'),x=c.getContext('2d'),Z=2;
const img=x.createImageData(c.width,c.height);for(let i=0;i<img.data.length;i+=4){img.data[i]=8;img.data[i+1]=11;img.data[i+2]=18;img.data[i+3]=255;}
let y=24;
for(const [id,t] of S){const f=parse(F[id]);y+=f.asc*Z;let cx=16;
  for(const ch of t){const gl=f.g[ch.codePointAt(0)];if(!gl){cx+=f.size*Z/3;continue;}
    for(let r=0;r<gl.h;r++)for(let q=0;q<gl.w;q++){const a=f.b[gl.off+r*gl.w+q];if(!a)continue;
      for(let zy=0;zy<Z;zy++)for(let zx=0;zx<Z;zx++){const px=cx+(gl.dX+q)*Z+zx,py=y+(r-gl.dY)*Z+zy;if(px<0||py<0||px>=c.width||py>=c.height)continue;
        const k=(py*c.width+px)*4;img.data[k]=8+(240-8)*a/255;img.data[k+1]=11+(244-11)*a/255;img.data[k+2]=18+(250-18)*a/255;}}
    cx+=gl.adv*Z;}
  y+=(f.desc+10)*Z;}
x.putImageData(img,0,0);
</script>`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cydprev-'));
fs.writeFileSync(path.join(tmp, 'p.html'), html);
try {
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(tmp, 'prof')}`, '--window-size=1300,520',
    `--screenshot=${out}`, 'file:///' + path.join(tmp, 'p.html').replace(/\\/g, '/')], { stdio: 'ignore', timeout: 60000 });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('wrote', out);
