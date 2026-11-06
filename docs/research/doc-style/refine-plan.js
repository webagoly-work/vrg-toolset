// refine-plan.js — the "Finom" (Refined) render study, 2026-11-06.
// Takes a real Planner alaprajz export (docs/views/fig/cla-plan-1200.svg, the hivatalos look) and re-inks it with the
// Varler Papír tokens: warm ink instead of #111, taupe walls instead of grey poche, muted system colours, Bahnschrift +
// Sitka, a hairline north arrow. String-level only: it shows the target look before any Planner code is touched.
// Run: node docs/research/doc-style/refine-plan.js   → docs/research/doc-style/finom-plan.svg (+ the sheet html is static)
const fs=require('fs'),path=require('path');
const SRC=path.join(__dirname,'../../../Planner/projects/varler-planner/docs/views/fig/cla-plan-1200.svg');
const OUT=path.join(__dirname,'finom-plan.svg');
const T={ink:'#3a3631',ink2:'#6b645b',ink3:'#9b9389',wall:'#cdc3b5',wallEdge:'#a89d8e',paper:'#fff'};

function hex2hsl(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  const r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let s=0,H=0;
  if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);
    H=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);H*=60;}
  return [H,s,l];}
function hsl2hex(H,s,l){const k=n=>(n+H/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return '#'+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
// a system colour keeps its hue (the systems stay apart) but loses ~45% chroma and leans warm
function mute(hex){const [H,s,l]=hex2hsl(hex);if(s<.08)return hex;
  if(l>.85)return hsl2hex(H,s*.45,Math.min(.96,l+.01));          // pale tints → paler
  return hsl2hex(H,s*.55,Math.min(.58,l*1.04+.03));}

let s=fs.readFileSync(SRC,'utf8');
const fixed={'#111':T.ink,'#111111':T.ink,'#9a9a9a':T.wall,'#555':T.ink2,'#fff':T.paper,'#ffffff':T.paper};
s=s.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,6})"/g,(m,a,c)=>{const k=c.toLowerCase();
  if(k==='#9a9a9a')return `${a}="${a==='stroke'?T.wallEdge:T.wall}"`;
  return `${a}="${fixed[k]||mute(k)}"`;});
// type: Bahnschrift everywhere (Sitka has old-style figures: R01 would read Ro1), room names spaced and light
s=s.replace(/font-family="[^"]*"/g,'font-family="Bahnschrift, Segoe UI, Arial, sans-serif"');
s=s.replace(/<text([^>]*?)font-size="7\.88" font-weight="700"([^>]*?)font-family="[^"]*"/g,
  '<text$1font-size="6.6" font-weight="400" letter-spacing="1.3"$2font-family="Bahnschrift, Segoe UI, Arial, sans-serif"');
s=s.replace(/font-size="5\.63" font-weight="400"([^>]*?)fill="#3a3631"/g,'font-size="5.2" font-weight="400"$1fill="'+T.ink2+'"');
// overrides by class: hairline dimensions, an outlined north arrow, softer furniture
s=s.replace(/(<svg x="0" y="0"[^>]*>)<style>/,`$1<style>.ap-dim,.ap-dim *{stroke:${T.ink3}}.ap-north polygon{fill:${T.paper};stroke:${T.ink};stroke-width:.6}`
  +`.ap-art .oa-out,.ap-art .oa-det,.ap-art .oa-hid{stroke:${T.ink2}}.ap-art .oa-out{stroke-width:6}.ap-art .oa-det{stroke-width:4.5}`);
s=s.replace(/<rect width="1400" height="2078" fill="[^"]*"\/>/,'');            // the sheet supplies the paper
// the footer stats line of the export belongs to the old frame
s=s.replace(/<text[^>]*>Alaprajz · [^<]*<\/text>/g,'');
fs.writeFileSync(OUT,s);
console.log('wrote',path.relative(process.cwd(),OUT),(s.length/1024).toFixed(0)+' kB');
