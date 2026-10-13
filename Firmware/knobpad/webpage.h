// VRG Knob Pad — the config page served at "/". UI text is Hungarian; ids match knobpad.ino.
#pragma once

const char PAGE_HTML[] PROGMEM = R"rawliteral(<!doctype html>
<html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VRG Knob Pad</title>
<style>
:root{--bg:#14100c;--panel:#1d1712;--ink:#f4e9d6;--muted:#a8977d;--accent:#e6a532;--line:#3a2f22;--ok:#9ed46f;--bad:#e88b73}
@media (prefers-color-scheme:light){:root{--bg:#f4efe6;--panel:#fff;--ink:#221c14;--muted:#6d6252;--accent:#a9781a;--line:#d8cdb8;--ok:#3c6a22;--bad:#8f3016}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,Segoe UI,Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:16px}
header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--accent);padding-bottom:8px;margin-bottom:14px}
h1{font-size:19px;margin:0}h1 span{color:var(--accent)}
.meta{color:var(--muted);font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px}
.card h2{font-size:13px;margin:0 0 8px;color:var(--accent);letter-spacing:.06em;text-transform:uppercase}
.live{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
.last{font-size:20px;font-weight:700}
.count{color:var(--muted);font-size:12px}
label{display:block;font-size:12px;color:var(--muted);margin:8px 0 3px}
select{width:100%;padding:7px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font-size:14px}
.status{margin-top:14px;font-size:12px;color:var(--muted)}
.ok{color:var(--ok)}.bad{color:var(--bad)}
button{margin-top:16px;background:transparent;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:7px 12px;cursor:pointer}
</style></head><body><div class="wrap">
<header><h1>VRG <span>Knob Pad</span></h1><div class="meta" id="meta">…</div></header>
<div class="grid" id="grid"></div>
<div class="status" id="status">Kapcsolódás…</div>
<button id="wifi">WiFi újrabeállítása</button>
</div>
<script>
const ROT={none:'Nincs',vol:'Hangerő',scroll:'Görgetés',hscroll:'Vízszintes görgetés',zoom:'Nagyítás (Ctrl + görgő)',
 arrow_ud:'Nyilak fel / le',arrow_lr:'Nyilak balra / jobbra',track:'Előző / következő szám',bright:'Képernyő-fényerő',
 f13_14:'F13 / F14',f15_16:'F15 / F16',f17_18:'F17 / F18',f19_20:'F19 / F20',f21_22:'F21 / F22',f23_24:'F23 / F24'};
const PRESS={none:'Nincs',mute:'Némítás',play:'Lejátszás / szünet',next:'Következő szám',prev:'Előző szám',enter:'Enter',esc:'Esc'};
for(let n=13;n<=24;n++)PRESS['f'+n]='F'+n;
const opts=m=>Object.entries(m).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
const grid=document.getElementById('grid'),status=document.getElementById('status');
grid.innerHTML=[1,2,3].map(i=>`<div class="card"><h2>${i}. gomb</h2>
 <div class="live"><span class="last" id="last${i}">–</span><span class="count" id="count${i}"></span></div>
 <label>Forgatás</label><select id="rot${i}">${opts(ROT)}</select>
 <label>Megnyomás</label><select id="press${i}">${opts(PRESS)}</select></div>`).join('');
let editing=0,noteUntil=0;
const note=h=>{status.innerHTML=h;noteUntil=Date.now()+2500;};
for(const i of [1,2,3])for(const f of ['rot','press']){
 const el=document.getElementById(f+i);
 el.addEventListener('focus',()=>editing=i);el.addEventListener('blur',()=>editing=0);
 el.addEventListener('change',async()=>{
  try{const r=await fetch(`/set?enc=${i}&${f}=${el.value}`,{method:'POST'});
   note(r.ok?'<span class="ok">Elmentve a gombba.</span>':'<span class="bad">Mentés sikertelen ('+r.status+').</span>');}
  catch(e){note('<span class="bad">Nincs kapcsolat a gombbal.</span>');}
 });
}
async function poll(){
 try{const s=await (await fetch('/state')).json();
  document.getElementById('meta').textContent=`${s.host}.local · ${s.ip} · v${s.fw}`;
  s.enc.forEach((e,k)=>{const i=k+1;
   document.getElementById('last'+i).textContent=e.last;
   document.getElementById('count'+i).textContent=e.count+' kattanás';
   if(editing!==i){document.getElementById('rot'+i).value=e.rot;document.getElementById('press'+i).value=e.press;}});
  if(Date.now()>noteUntil)status.textContent='Élő kapcsolat.';
 }catch(e){status.innerHTML='<span class="bad">Nincs kapcsolat a gombbal.</span>';}
 setTimeout(poll,300);
}
poll();
document.getElementById('wifi').onclick=async()=>{
 if(!confirm('A gomb elfelejti a WiFi-t és újraindul beállító módban ("VRG-Knobs-Setup" hálózat). Folytatod?'))return;
 await fetch('/wifi-reset',{method:'POST'}).catch(()=>{});
 status.textContent='Újraindul beállító módban…';
};
</script></body></html>)rawliteral";
