// ==========================================================================
// 06f-finom.js — the "Finom" Alaprajz look + the classical-plan round (CE-1, CE-5, CE-7), 2026-11-06
//                (prefixes fnm / FNM_, ce / CE_)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Why: docs/research/2026-11-06_varler-document-style.md (D1–D12) and 2026-11-06_classical-electrical-plan-review.md.
//   Finom   state.apFinom on the Alaprajz style: the same geometry and ISO pens, re-inked with the Varler Papír tokens —
//           warm ink instead of #111, taupe walls instead of grey poché, the systems at ~55 % chroma, Bahnschrift, hairline
//           dimensions, an outlined north arrow — and a frameless paper sheet with a described legend. Off = the hivatalos
//           Alaprajz exactly as before (the goldens never see this module unless a fixture sets apFinom).
//   CE-5    CE-Q1 = B: on a renovation plan (some endpoint on a Meglévő layer) the printed Alaprajz shows existing points in
//           black (ink), new / changed points in red, a removed point crossed out in ink; replace = an ink square.
//   CE-1    CE-Q2 = B: switch groups lettered A, B, C… per floor; a lamp shows its leg's letter, a switch every letter it
//           switches ("A,B"). Printed through the V9b placer, so they keep off codes, dimensions and each other.
//   CE-7    the Finom sheet's legend: the symbols actually drawn, their name, the HU switch code, the standard height.

const FNM={ink:'#3a3631',ink2:'#6b645b',ink3:'#9b9389',rule:'#d9d3ca',wall:'#cdc3b5',wallEdge:'#a89d8e',paper:'#ffffff',
  vez:'#b5452f',vezTint:'#f6e4df',
  sans:'Bahnschrift, Segoe UI, Arial, sans-serif',serif:'Sitka Banner, Sitka Display, Constantia, Georgia, serif',
  serifT:'Sitka Text, Sitka Small, Constantia, Georgia, serif'};
const CE_HIV={keep:'#111111',neu:'#c62828',neuTint:'#fbe3e1'};   // the same change colouring on the hivatalos Alaprajz
function fnmOn(){return alaprajzOn()&&!!state.apFinom;}

// ---- colour helpers ----
function fnmHsl(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  const r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let s=0,H=0;
  if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);H=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);H*=60;}
  return [H,s,l];}
function fnmHex(H,s,l){const k=n=>(n+H/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return '#'+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
// a system colour keeps its hue (the systems stay apart) at ~55 % chroma; pale tints get paler
function fnmMute(hex){const [H,s,l]=fnmHsl(hex);if(s<.08)return hex;
  if(l>.85)return fnmHex(H,s*.45,Math.min(.96,l+.01));
  return fnmHex(H,s*.55,Math.min(.58,l*1.04+.03));}
const FNM_FIXED={'#111':FNM.ink,'#111111':FNM.ink,'#000':FNM.ink,'#000000':FNM.ink,'#555':FNM.ink2,'#555555':FNM.ink2,'#333':FNM.ink,'#333333':FNM.ink};
const FNM_TOKENS=new Set([FNM.ink,FNM.ink2,FNM.ink3,FNM.wall,FNM.wallEdge,FNM.paper,FNM.vez,FNM.vezTint,'#fff']);
function fnmCol(c,attr){const k=c.toLowerCase();if(FNM_TOKENS.has(k))return c;
  if(k==='#9a9a9a'||k===AP_POCHE)return attr==='stroke'?FNM.wallEdge:FNM.wall;
  return FNM_FIXED[k]||fnmMute(k);}

// ---- Finom: the scene re-ink (one pass over the finished scene string; draw() calls it before paintLayers) ----
let FNM_RV=null;   // the renovation flag, computed once per draw (reset here, read by ceChgWrap)
function fnmInk(s){FNM_RV=null;return fnmOn()?fnmInkStr(s):s;}
// the re-ink itself, no guard (the export legend re-inks single symbols after the view state is restored)
function fnmInkStr(s){
  const room=bpFS(AP_TXT.room);
  s=s.replace(/(fill|stroke|stop-color)="(#[0-9a-fA-F]{3,6})"/g,(m,a,c)=>a+'="'+fnmCol(c,a)+'"')
     .replace(/(fill|stroke):(#[0-9a-fA-F]{3,6})/g,(m,a,c)=>a+':'+fnmCol(c,a))
     .replace(/font-family="[^"]*"/g,'font-family="'+FNM.sans+'"')
     .replace(new RegExp('font-size="'+room+'" font-weight="700"','g'),'font-size="'+(room*.92).toFixed(2)+'" font-weight="400" letter-spacing="'+(room*.18).toFixed(2)+'"')
     .replace(/font-weight="700"/g,'font-weight="500"');
  const st=`<style>.ap-dim,.ap-dim *{stroke:${FNM.ink3}}.ap-north polygon{fill:${FNM.paper};stroke:${FNM.ink};stroke-width:${bpSW(AP_PEN.hid)}}`
    +`.ap-lead{stroke:${FNM.ink3}}.ap-art .oa-out,.ap-art .oa-det,.ap-art .oa-hid{stroke:${FNM.ink2}}</style>`;
  return st+s;}

// ---- CE-5: new / existing on the printed plan ----
function ceRenov(){if(FNM_RV===null)FNM_RV=typeof vstIsExistLayer==='function'&&data.devices.some(d=>d&&vstIsExistLayer(d.layer));return FNM_RV;}
// every colour of a symbol to one ink (white halos and fills stay), pale fills to a tint
function ceRecolor(svg,ink,tint){return svg.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,6})"/g,(m,a,c)=>{const k=c.toLowerCase();
  if(k==='#fff'||k==='#ffffff'||k==='none')return m;const l=fnmHsl(k)[2];return a+'="'+(a==='fill'&&l>.82?tint:ink)+'"';});}
// called by apDevWrap for every endpoint the Alaprajz draws
function ceChgWrap(d,svg){if(!svg||!alaprajzOn()||!ceRenov())return svg;
  const fin=!!state.apFinom,keepC=fin?FNM.ink:CE_HIV.keep,neuC=fin?FNM.vez:CE_HIV.neu,neuT=fin?FNM.vezTint:CE_HIV.neuTint;
  const ex=typeof vstExistOf==='function'?vstExistOf(d):null;
  if(!ex)return ceRecolor(svg,neuC,neuT);
  let out=ceRecolor(svg,keepC,'#ffffff');if(ex==='keep')return out;
  const b=planToBase(d.x,d.y,dz(d.level,d.h||0)),R=v=>+bpU(v).toFixed(2),x=b[0],y=b[1],sw=bpSW(AP_PEN.beyond);
  if(ex==='remove')return out+`<g class="ce-rm" stroke="${keepC}" stroke-width="${sw}" stroke-linecap="round"><line x1="${x-R(2.6)}" y1="${y-R(2.6)}" x2="${x+R(2.6)}" y2="${y+R(2.6)}"/>`
    +`<line x1="${x-R(2.6)}" y1="${y+R(2.6)}" x2="${x+R(2.6)}" y2="${y-R(2.6)}"/></g>`;
  return out+`<rect class="ce-rp" x="${x-R(2.8)}" y="${y-R(2.8)}" width="${R(5.6)}" height="${R(5.6)}" fill="none" stroke="${keepC}" stroke-width="${sw}"/>`;}

// ---- CE-1: switch-group letters, one series per floor (A … Z, AA …) ----
function ceLetter(i){let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
// {lamp: id → letter, sw: id → 'A,B'} for a level; a leg = a lamp group (d.grp) or a lone lamp, lettered only when a switch
// switches it; order = reading order of the leg's top-left lamp (plan y, then x), so the letters follow the drawing
function ceLetters(level){const lamps=new Map(),legs=new Map(),sws=[];
  for(const d of data.devices){if(!d||d.level!==level)continue;
    if(typeof lswLamp==='function'?lswLamp(d):(typeof epIsLamp==='function'&&epIsLamp(d)))lamps.set(d.id,d);
    else if(epCodeOf(d)==='SWI'&&Array.isArray(d.ctl)&&d.ctl.length)sws.push(d);}
  const legOf=l=>l.grp||('L:'+l.id);
  for(const s of sws)for(const id of s.ctl){const l=lamps.get(id);if(!l)continue;const k=legOf(l);
    if(!legs.has(k))legs.set(k,{k,x:l.x,y:l.y});else{const g=legs.get(k);if(l.y<g.y-1||(Math.abs(l.y-g.y)<=1&&l.x<g.x)){g.x=l.x;g.y=l.y;}}}
  const ord=[...legs.values()].sort((a,b)=>Math.abs(a.y-b.y)>150?a.y-b.y:a.x-b.x);
  const L=new Map();ord.forEach((g,i)=>L.set(g.k,ceLetter(i)));
  const lamp=new Map(),sw=new Map();
  for(const l of lamps.values()){const t=L.get(legOf(l));if(t)lamp.set(l.id,t);}
  for(const s of sws){const t=[...new Set(s.ctl.map(id=>lamps.get(id)).filter(Boolean).map(l=>L.get(legOf(l))).filter(Boolean))]
    .sort((a,b)=>a.length-b.length||a.localeCompare(b));if(t.length)sw.set(s.id,t.join(','));}
  return {lamp,sw,n:ord.length};}
// apAnnotSvg calls this after the endpoint codes: one placed letter per lettered endpoint (state.apLetters !== false)
function ceLetterItems(S,Pl,fs,L){if(state.apLetters===false||!S||!S.drawn)return;const T=ceLetters(state.active);if(!T.n)return;
  const col=state.apFinom?FNM.ink:'#111';
  for(const e of S.drawn){const t=T.lamp.get(e.d.id)||T.sw.get(e.d.id);if(!t)continue;const b=apSvgBox(e.svg);if(!b)continue;
    Pl.add({x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,r:Math.max(b[2]-b[0],b[3]-b[1])/2+bpU(.25),lines:[{t,fs:fs(AP_TXT.code*1.25),w:700,col}],
      pref:[315,45,225,135],kind:'grp'});L.grp=(L.grp||0)+1;}}

// ---- the Finom paper sheet (V9c geometry, Varler Papír dress) ----
// No frame. The drawing area is as large as the hivatalos sheet's (whatever fits there fits here): a 20 mm left margin,
// the title band on top, the title strip at the foot. The legend flows into the free space the drawing leaves — a side
// column when ≥ 60 mm is free on the right, else a band under the drawing, else the right half of the title band.
const FNM_PAPER={l:20,r:10,top:26,foot:20,col:62,gap:7};
function fnmPaperArea(w,h){const P=FNM_PAPER;return {x:P.l,y:P.top,w:w-P.l-P.r,h:h-P.top-P.foot};}
function fnmT(x,y,s,t,o){o=o||{};return '<text x="'+(+x.toFixed(3))+'" y="'+(+y.toFixed(3))+'" font-size="'+s+'"'+(o.anchor?' text-anchor="'+o.anchor+'"':'')
  +(o.ls?' letter-spacing="'+o.ls+'"':'')+(o.it?' font-style="italic"':'')+' font-weight="'+(o.w||400)+'" font-family="'+(o.ff||FNM.sans)+'" fill="'+(o.c||FNM.ink)+'">'+t+'</text>';}
// CE-7: one row per symbol kind drawn (code + switch type), with its standard height
function fnmLegendRows(S){const rows=[],seen=new Set();
  for(const e of (S&&S.drawn)||[]){const d=e.d,c=epCodeOf(d)||d.type,swt=c==='SWI'&&d.swType?String(d.swType):'',key=c+'|'+swt;if(seen.has(key))continue;seen.add(key);
    const E=typeof epEntryOf==='function'?epEntryOf(d):null,st=swt?SWITCH_TYPES.find(t=>t.k===swt):null;
    rows.push({e,code:c,name:st?st.l:(E?E.n:(DEV[d.type]||d.type)),h:E&&E.h?E.h:null});}
  return rows.sort((a,b)=>a.code.localeCompare(b.code)||a.name.localeCompare(b.name));}
// the legend as a list of row items {h (mm), draw(x, y) → svg}; fnmFlow lays them into columns inside a box
function fnmLegendItems(o,k){const f=v=>+v.toFixed(3),it=[];const head=t=>it.push({h:5.4,head:1,draw:(x,y)=>fnmT(x,y+2.6,2.1,t,{ls:0.55,c:FNM.ink2})});
  const txt=t=>it.push({h:3.9,draw:(x,y)=>fnmT(x,y+2.6,2.2,t,{c:FNM.ink2})});
  const hl=(a,b,c,d,col)=>'<line x1="'+f(a)+'" y1="'+f(b)+'" x2="'+f(c)+'" y2="'+f(d)+'" stroke="'+(col||FNM.ink)+'" stroke-width="0.25"/>';
  const sym=()=>{it.push({h:2,draw:()=>''});head('JELKULCS');
  for(const r of fnmLegendRows(o.stats))it.push({h:5.4,draw:(x,y)=>{const b=apSvgBox(r.e.svg);let s='';
    if(b){const mx=(b[0]+b[2])/2,my=(b[1]+b[3])/2;s='<g transform="translate('+f(x+3)+','+f(y+2.6)+') scale('+(+k.toPrecision(8))+') translate('+f(-mx)+','+f(-my)+')">'
      +(state.apFinom?fnmInkStr(r.e.svg).replace(/^<style>[\s\S]*?<\/style>/,''):r.e.svg)+'</g>';}
    return s+fnmT(x+8.5,y+2.2,2.45,esc(r.name))+fnmT(x+8.5,y+5,1.85,esc(r.code+(r.h?' · H '+Math.round(r.h/10):'')),{c:FNM.ink3,ls:0.2});}});};
  if(ceRenov()){head('VÁLTOZÁSOK');
    const row=(sym,t,c)=>it.push({h:4.8,draw:(x,y)=>sym(x,y+2)+fnmT(x+8.5,y+2.9,2.45,t,{c:c||FNM.ink})});
    row((x,y)=>'<circle cx="'+f(x+3)+'" cy="'+f(y)+'" r="1.4" fill="none" stroke="'+FNM.ink+'" stroke-width="0.25"/>','meglévő, megmarad');
    row((x,y)=>'<circle cx="'+f(x+3)+'" cy="'+f(y)+'" r="1.4" fill="none" stroke="'+FNM.vez+'" stroke-width="0.25"/>','új vagy módosított pont',FNM.vez);
    row((x,y)=>hl(x+1.6,y-1.4,x+4.4,y+1.4)+hl(x+1.6,y+1.4,x+4.4,y-1.4),'bontandó');
    row((x,y)=>'<rect x="'+f(x+1.5)+'" y="'+f(y-1.5)+'" width="3" height="3" fill="none" stroke="'+FNM.ink+'" stroke-width="0.25"/>','cserélendő');}
  const T=ceLetters(state.active);
  if(T.n&&state.apLetters!==false){it.push({h:2,draw:()=>''});head('KAPCSOLÓCSOPORTOK');
    txt('A, B, C …: a lámpán a csoportja,');txt('a kapcsolón minden csoport, amit kapcsol.');txt('Szintenként külön sorozat · '+T.n+' csoport.');}
  it.push({h:2,draw:()=>''});head('MAGASSÁGOK');txt('H = szabványmagasság, cm;');txt('az ettől eltérő pont a rajzon H= jelet kap.');
  sym();return it[0]&&it[0].h<=2&&!it[0].head?it.slice(1):it;}
// lay items into columns of FNM_PAPER.col mm inside {x, y, w, h}; a head never ends a column; returns {svg, cols, left}
function fnmFlow(items,boxes){const P=FNM_PAPER;let s='',bi=0,box=boxes[0],x=box.x,y=box.y,cols=1,left=0;
  for(let i=0;i<items.length;i++){const t=items[i],nh=t.head&&items[i+1]?items[i+1].h:0;
    if(y+t.h+nh>box.y+box.h&&y>box.y){x+=P.col;y=box.y;cols++;}
    while(box&&(x+P.col-6>box.x+box.w+1e-6||t.h+nh>box.h)){box=boxes[++bi];if(box){x=box.x;y=box.y;cols++;}}
    if(!box){left=items.length-i;break;}
    if(y===box.y&&t.h<=2&&!t.head)continue;
    s+=t.draw(x,y);y+=t.h;}
  return {svg:s,cols,left};}
function fnmPaperSheet(R,o){const P=FNM_PAPER,W=o.paper.w,H=o.paper.h,A=fnmPaperArea(W,H),k=o.k,[x0,y0,x1,y1]=o.box,f=v=>+v.toFixed(3);
  const dw=(x1-x0)*k,dh=(y1-y0)*k,{t1,t2}=viewSheetTitles(R,o),items=fnmLegendItems(o,k);
  const hl=(a,b,c,d,sw,col)=>'<line x1="'+f(a)+'" y1="'+f(b)+'" x2="'+f(c)+'" y2="'+f(d)+'" stroke="'+(col||FNM.ink2)+'" stroke-width="'+(sw||0.18)+'"/>';
  const dot=(x,y)=>'<circle cx="'+f(x)+'" cy="'+f(y)+'" r="0.55" fill="#fff" stroke="'+FNM.ink2+'" stroke-width="0.18"/>';
  // where the legend goes (D-FNM-1): the right side, under the drawing, or the title band
  let ox,oy,box,where;const freeR=A.w-dw,freeB=A.h-dh;
  if(freeR>=P.col-2){ox=A.x;oy=A.y+(A.h-dh)/2;box={x:A.x+dw+P.gap,y:A.y,w:A.w-dw-P.gap,h:A.h};where='side';}
  else if(freeB>=18){ox=A.x+(A.w-dw)/2;oy=A.y;box={x:A.x,y:A.y+dh+P.gap-2,w:A.w,h:freeB-P.gap+2};where='foot';}
  else{ox=A.x+(A.w-dw)/2;oy=A.y+(A.h-dh)/2;box={x:W/2,y:6,w:W/2-P.r,h:P.top-8};where='top';}
  const L=fnmFlow(items,where==='top'?[box]:[box,{x:W*0.46,y:5,w:W*0.54-P.r,h:P.top-7}]);   // overflow: the title band's right part
  let s=where==='side'?hl(box.x-P.gap/2,A.y,box.x-P.gap/2,A.y+A.h,0.18,FNM.rule):where==='foot'?hl(A.x,box.y-2.5,A.x+A.w,box.y-2.5,0.18,FNM.rule):'';
  s+=L.svg+(L.left?fnmT(box.x+box.w,box.y+box.h,1.9,'+ '+L.left+' sor nem fért el',{anchor:'end',c:FNM.ink3}):'');
  // the title: the incoming line from the paper edge, ending on a terminal (D4)
  const ty=13;s+=hl(0,ty-2.1,P.l-4.2,ty-2.1)+dot(P.l-3.6,ty-2.1)
    +fnmT(P.l,ty,6.2,t1,{ff:FNM.serif,ls:1.1})+fnmT(P.l,ty+6,3,t2,{ff:FNM.serifT,it:1,c:FNM.ink2});
  // the foot: label over value pairs on one rule, the scale bar with terminals, the maker
  const fy=H-P.foot+4;s+=hl(P.l,fy,W-P.r,fy,0.25,FNM.ink2);
  const cells=[['LÉPTÉK','1 : '+o.N],['LAP',esc(o.paper.name)],['DÁTUM',esc(o.date||'')],['VÁGÁS',(o.stats&&o.stats.cut?o.stats.cut:apCut())+' mm']];
  let fx=P.l;cells.forEach(([h,v])=>{s+=fnmT(fx,fy+4,1.8,h,{ls:0.5,c:FNM.ink3})+fnmT(fx,fy+8.6,3.1,v);fx+=26;});
  const M=1000/o.N,bx=fx+8,by=fy+6.4;s+=hl(bx,by,bx+5*M,by,0.25,FNM.ink2);
  for(const i of [0,1,2,5])s+=dot(bx+i*M,by)+fnmT(bx+i*M,by+3.4,1.9,i+(i===5?' m':''),{anchor:'middle',c:FNM.ink3});
  s+=fnmT(W-P.r,fy+8.2,2.6,'VARLER PLANNER',{anchor:'end',ff:FNM.serif,ls:0.9,c:FNM.ink2});
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'mm" height="'+H+'mm" viewBox="0 0 '+W+' '+H+'">'
    +'<rect width="'+W+'" height="'+H+'" fill="#fff"/>'
    +'<g class="vw-plan" transform="translate('+f(ox)+','+f(oy)+') scale('+(+k.toPrecision(8))+') translate('+f(-x0)+','+f(-y0)+')">'+R.body+'</g>'
    +'<g class="fnm-sheet">'+s+'</g></svg>';
  return {W,H,svg,mm:true,area:A,draw:[dw,dh],map:(px,py)=>[ox+(px-x0)*k,oy+(py-y0)*k],legend:{where,cols:L.cols,left:L.left,rows:items.length}};}

// ---- switches: the Alaprajz row checkbox, the palette ----
function fnmSet(on){state.apFinom=!!on;if($('apFinom'))$('apFinom').checked=state.apFinom;draw();
  if($('hud'))$('hud').textContent=state.apFinom?'Finom alaprajz — meleg tinta, taupe falak; az export Finom lapot ad.':'Hivatalos alaprajz.';
  if(typeof vexpFitSync==='function')vexpFitSync();return state.apFinom;}
function ceLettersSet(on){state.apLetters=!!on;if($('apLetters'))$('apLetters').checked=state.apLetters;draw();return state.apLetters;}
registerActions([
  {id:'view.finom',label:'Finom alaprajz',icon:'🖋',group:'Nézet',alias:'finom refined varler papir alaprajz stilus look',
   hint:'Az Alaprajz meleg tintával, taupe falakkal és halkabb rendszerszínekkel; az Alaprajz-lap export Finom lapot ad jelkulccsal.',
   need:'Alaprajz stílusban (2D) érhető el.',when:()=>state.style==='alaprajz',run:()=>fnmSet(!state.apFinom)},
  {id:'view.apLetters',label:'Kapcsolócsoport-betűk',icon:'🔤',group:'Nézet',alias:'betu kapcsolocsoport letter group A B',
   hint:'A lámpákon és kapcsolókon a kapcsolócsoport betűje (A, B, C …, szintenként) az Alaprajzon.',
   need:'Alaprajz stílusban (2D) érhető el.',when:()=>state.style==='alaprajz',run:()=>ceLettersSet(state.apLetters===false)}]);

window.fnmInk=fnmInk;window.fnmInkStr=fnmInkStr;window.fnmOn=fnmOn;window.fnmPaperSheet=fnmPaperSheet;window.fnmPaperArea=fnmPaperArea;window.fnmSet=fnmSet;
window.ceLetters=ceLetters;window.ceLetter=ceLetter;window.ceChgWrap=ceChgWrap;window.FNM=FNM;
