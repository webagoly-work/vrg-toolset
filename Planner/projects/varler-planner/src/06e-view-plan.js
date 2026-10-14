// ==========================================================================
// 06e-view-plan.js — Alaprajz: the cut-plane floor plan (Views WP V9a, docs/views/WORKPLAN.md § V9a)
//                    (prefixes ap / AP_)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A 2D style (state.style 'alaprajz', 2D only) that replaces the scene geometry, like the blueprint does, and draws the
// active level cut at state.planCutH:
//   walls    cut (z0 < c < top) → poché + ONE contour around their union · beyond (top ≤ c) → outline · above → dashed
//   openings in a cut wall (its opnHost only): cut (sill < c < top) → a gap + its symbol · otherwise hidden → white dashes over the poché
//   objects  above the cut → dashed footprint · else the V8 top view where OBJART has one · else a white footprint
//   endpoints (draw()'s own loop): above the cut → not drawn, counted in the HUD (D-V9-5 3C); no kind codes under the symbols
// The clean output (state.apAll off) keeps only the geometry, the draft and the endpoints: no routes, notes, measures,
// stack layers, and no text at all until V9b places room tags and codes with a collision-avoiding placer.
// Pens are the blueprint's paper millimetres (state.bpScale), weights per PRIMER §4.5: cut 0.5 > beyond 0.25 > furniture
// 0.18 > hidden 0.13. The front of an object comes from apFront (D-V9-3 A).

const AP_PEN={cut:0.5,beyond:0.25,glass:0.18,obj:0.18,det:0.13,hid:0.13};   // paper mm
const AP_POCHE='#9a9a9a';   // D-V9-5 1B: mid-grey, so endpoints on the walls read
const AP_DOOR_PEN={c:'#111',sw:bpSW,body:AP_PEN.beyond,thin:AP_PEN.glass,wall:AP_PEN.cut,fill:'#fff',arc:''};
let AP_LAST=null;   // the stats of the last Alaprajz render (tests, HUD)

function alaprajzOn(){return state.style==='alaprajz'&&state.pitch>=88;}
function apCut(){const v=+state.planCutH;return v>0?Math.max(100,Math.min(2700,v)):1200;}
function apCutSet(v){state.planCutH=Math.max(100,Math.min(2700,Math.round(+v||1200)));apSyncRow();draw();apHud();}
function apSyncRow(){const on=state.style==='alaprajz';if($('apCutRow'))$('apCutRow').style.display=on?'flex':'none';
  if($('apCut'))$('apCut').value=apCut();if($('apCutN'))$('apCutN').value=apCut();}
function apHud(){if(!$('hud'))return;const S=AP_LAST;
  $('hud').textContent=alaprajzOn()?'Alaprajz — vágás '+apCut()+' mm'+(S?' · végpontok a vágás alatt '+S.dev.full+' · a vágás fölött '+S.dev.above+' rejtve':'')
    :'Alaprajz — 2D felülnézetben jelenik meg; 3D-ben a normál rajz marad.';}

// against the cut c: a wall {z0, h} and an opening (sill, top)
function apWallState(r,level,c){const z0=r.z0||0,top=z0+(r.h||wallH(level));return z0<c&&c<top?'cut':top<=c?'beyond':'above';}
function apOpenRange(o){const win=o.type==='window',sill=o.sill!=null?o.sill:(win?WIN_SILL:0);return [sill,sill+(o.h||(win?WIN_H:DOOR_H))];}
function apOpenState(o,c){const [a,b]=apOpenRange(o);return a<c&&c<b?'cut':'hidden';}

// D-V9-3 A: the front of an object, a unit vector in plan mm. o.front (0 → −y, 90 → +x, 180 → +y, 270 → −x) wins;
// else its back goes to the nearest wall whose face is ≤ 600 mm from the footprint box and whose span overlaps it
// (within 100 mm of the nearest, the one with the longest overlap); else local −d (ang 0 → −y).
const AP_FRONT={0:[0,-1],90:[1,0],180:[0,1],270:[-1,0]};
function apFront(o){
  if(o.front!=null&&AP_FRONT[o.front])return AP_FRONT[o.front].slice();
  const P=objFootprint(o),bx0=Math.min(...P.map(p=>p[0])),bx1=Math.max(...P.map(p=>p[0])),by0=Math.min(...P.map(p=>p[1])),by1=Math.max(...P.map(p=>p[1]));
  const cand=[];
  for(const r of (WALLS[o.level]||[])){const horiz=(r.x1-r.x0)>=(r.y1-r.y0);
    if(horiz){const ov=Math.min(bx1,r.x1)-Math.max(bx0,r.x0);if(ov<=0)continue;
      if(r.y1<=by0+50)cand.push({gap:Math.max(0,by0-r.y1),ov,f:[0,1]});
      else if(r.y0>=by1-50)cand.push({gap:Math.max(0,r.y0-by1),ov,f:[0,-1]});}
    else{const ov=Math.min(by1,r.y1)-Math.max(by0,r.y0);if(ov<=0)continue;
      if(r.x1<=bx0+50)cand.push({gap:Math.max(0,bx0-r.x1),ov,f:[1,0]});
      else if(r.x0>=bx1-50)cand.push({gap:Math.max(0,r.x0-bx1),ov,f:[-1,0]});}}
  const near=cand.filter(k=>k.gap<=600);
  if(near.length){const g0=Math.min(...near.map(k=>k.gap));return near.filter(k=>k.gap<=g0+100).sort((a,b)=>b.ov-a.ov)[0].f.slice();}
  const a=o.ang||0;return [+Math.sin(a).toFixed(12),+(-Math.cos(a)).toFixed(12)];}

// the art of an object placed in the plan: the T view's (x, y) (front edge at y = 0, back at −d) → plan mm → base units.
// world = c + f·(d/2 + y) + r·x with r = (f.y, −f.x), then the 2D projection (affine at pitch 90)
function apArtMatrix(o,f,depth){const z=dz(o.level,0),s0=planToBase(0,0,z),X=planToBase(1000,0,z),Y=planToBase(0,1000,z);
  const sx=[(X[0]-s0[0])/1000,(X[1]-s0[1])/1000],sy=[(Y[0]-s0[0])/1000,(Y[1]-s0[1])/1000],r=[f[1],-f[0]];
  const T=[o.x+f[0]*depth/2,o.y+f[1]*depth/2];
  return [sx[0]*r[0]+sy[0]*r[1],sx[1]*r[0]+sy[1]*r[1],sx[0]*f[0]+sy[0]*f[1],sx[1]*f[0]+sy[1]*f[1],
    s0[0]+sx[0]*T[0]+sy[0]*T[1],s0[1]+sx[1]*T[0]+sy[1]*T[1]];}
function apArtSize(o,f){const a=o.ang||0,along=Math.abs(f[0]*Math.cos(a)+f[1]*Math.sin(a))>=0.5;   // front along the w axis → swap
  return along?{w:o.d||600,d:o.w||600,h:o.ht||600}:{w:o.w||600,d:o.d||600,h:o.ht||600};}

// the style sheet: art pens in art millimetres (the matrix carries the plan scale), the above-cut endpoint look
function apCss(){const k=bpScaleN()*bpFine(),m=v=>+(v*k).toFixed(3);
  return `<style>.ap-art .oa-out,.ap-art .oa-det,.ap-art .oa-hid{fill:none;stroke:#111;stroke-linecap:round;stroke-linejoin:round}`+
    `.ap-art .oa-out{stroke-width:${m(AP_PEN.obj)}}.ap-art .oa-det{stroke-width:${m(AP_PEN.det)}}`+
    `.ap-art .oa-hid{stroke-width:${m(AP_PEN.hid)};stroke-dasharray:${m(1.2)} ${m(.8)}}.ap-art .oa-fill{fill:#fff}</style>`;}

function drawAlaprajzGeom(){const level=state.active,z=dz(level,0),c=apCut();
  const S={cut:c,walls:{cut:0,beyond:0,above:0},open:{cut:0,hidden:0},obj:{art:0,outline:0,above:0},fronts:[],dev:{full:0,above:0},drawn:[],stairs:0};
  const dash=`${bpU(1.2).toFixed(3)} ${bpU(.8).toFixed(3)}`;
  let s=apCss();
  // rooms and floors: white
  (ROOMSB[level]||[]).forEach((rm,i)=>{if(state.soloRoom&&!soloRoomIs({src:'B',i,level}))return;
    s+=`<polygon points="${p2b(rm.poly.map(p=>[p[0],p[1],z]))}" fill="#fff" stroke="none"/>`;});
  data.floors.forEach((fl,i)=>{if(fl.level!==level||!fl.poly||fl.poly.length<3||fl.stage==='outline')return;if(state.soloRoom&&!soloRoomIs({src:'F',i,level}))return;
    s+=`<polygon points="${p2b(fl.poly.map(p=>[p[0],p[1],z]))}" fill="#fff" stroke="none"/>`;});
  // objects, under the walls
  data.objects.forEach(o=>{if(o.level!==level||!layerShows(o,'object'))return;if(isGenObject(o)&&!genObjectsVisible())return;
    const z0=o.z||0,fp=p2b(objFootprint(o));
    if(z0>=c){S.obj.above++;s+=lyrWrap(o,'object',`<polygon points="${fp}" fill="none" stroke="#111" stroke-width="${bpSW(AP_PEN.hid)}" stroke-dasharray="${dash}"/>`);return;}
    if(typeof OBJART!=='undefined'&&OBJART[o.name]){const f=apFront(o),sz=apArtSize(o,f),A=objArt(o.name,'T',sz,{css:false});
      if(A){S.obj.art++;S.fronts.push({name:o.name,f});const M=apArtMatrix(o,f,sz.d).map(v=>+v.toFixed(4));
        s+=lyrWrap(o,'object',`<g class="ap-art" transform="matrix(${M.join(' ')})">${A.body}</g>`);return;}}
    S.obj.outline++;s+=lyrWrap(o,'object',`<polygon points="${fp}" fill="#fff" stroke="#111" stroke-width="${bpSW(AP_PEN.obj)}"/>`);});
  // stairs (V9b): the blueprint stair, dashed above the cut, with a break line
  data.openings.forEach(o=>{if(o.level!==level||o.type!=='stairs'||!layerShows(o,'build'))return;S.stairs++;s+=lyrWrap(o,'build',bpStairsSvg(o,z,level,c));});
  // walls
  const pieces=[];let sym='',low='';
  (WALLS[level]||[]).forEach(r=>{if(!layerShows(r,'wall')||!soloWallOk(r,level))return;
    const st=apWallState(r,level,c);S.walls[st]++;
    if(st!=='cut'){low+=`<polygon points="${bpRect(r,z)}" fill="none" stroke="#111" stroke-width="${bpSW(st==='beyond'?AP_PEN.beyond:AP_PEN.hid)}"${st==='above'?` stroke-dasharray="${dash}"`:''}/>`;return;}
    const W=bpWallSpans(r,level);let u=0;
    W.spans.forEach(sp=>{const q=bpSeg(r,W.horiz,sp.u0,sp.u1),o=sp.o;
      const host=opnHost(o);if(host&&host!==r)return;   // one host per opening (bpWallSpans also catches a door that grazes a butting wall)
      if(apOpenState(o,c)!=='cut'){S.open.hidden++;
        sym+=`<polygon points="${bpRect(q,z)}" fill="none" stroke="#fff" stroke-width="${bpSW(AP_PEN.glass)}" stroke-dasharray="${dash}"/>`;return;}
      S.open.cut++;if(sp.u0-u>1)pieces.push(bpSeg(r,W.horiz,u,sp.u0));u=Math.max(u,sp.u1);
      const a=[q.x0,q.y0],b2=W.horiz?[q.x1,q.y0]:[q.x0,q.y1],c2=[q.x1,q.y1],d2=W.horiz?[q.x0,q.y1]:[q.x1,q.y0];
      sym+=`<polygon points="${bpRect(q,z)}" fill="#fff" stroke="none"/>`;
      if(o.type==='window'){const m0=W.horiz?[q.x0,(q.y0+q.y1)/2]:[(q.x0+q.x1)/2,q.y0],m1=W.horiz?[q.x1,(q.y0+q.y1)/2]:[(q.x0+q.x1)/2,q.y1];
        sym+=`<polyline points="${p2b([[a[0],a[1],z],[b2[0],b2[1],z]])}" fill="none" stroke="#111" stroke-width="${bpSW(AP_PEN.beyond)}"/>`
          +`<polyline points="${p2b([[d2[0],d2[1],z],[c2[0],c2[1],z]])}" fill="none" stroke="#111" stroke-width="${bpSW(AP_PEN.beyond)}"/>`
          +`<polyline points="${p2b([[m0[0],m0[1],z],[m1[0],m1[1],z]])}" fill="none" stroke="#111" stroke-width="${bpSW(AP_PEN.glass)}"/>`;}
      else sym+=bpDoorSymbol(q,W,o,sp.u1-sp.u0,z,[a,b2,c2,d2],AP_DOOR_PEN);});
    if(W.len-u>1)pieces.push(bpSeg(r,W.horiz,u,W.len));});
  s+=low;
  pieces.forEach(q=>{s+=`<polygon points="${bpRect(q,z)}" fill="${AP_POCHE}" stroke="${AP_POCHE}" stroke-width="${bpSW(AP_PEN.hid)}"/>`;});
  s+=sym;
  const segs=rectsUnionSegs(pieces);
  if(segs.length)s+=`<path class="ap-contour" d="${segs.map(g=>{const A=planToBase(g[0],g[1],z),B=planToBase(g[2],g[3],z);
    return 'M'+A[0].toFixed(2)+' '+A[1].toFixed(2)+'L'+B[0].toFixed(2)+' '+B[1].toFixed(2);}).join('')}" fill="none" stroke="#111" stroke-width="${bpSW(AP_PEN.cut)}" stroke-linecap="square"/>`;
  S.pieces=pieces.length;AP_LAST=S;
  return s;}
// draw()'s endpoint loop: a device above the cut on the active level is not drawn, only counted (D-V9-5 3C)
function apDevWrap(d,svg){if(!alaprajzOn())return svg;if(d.level!==state.active)return state.apAll?svg:'';   // the clean plan: the active level only
  if((d.h||0)>apCut()){if(AP_LAST)AP_LAST.dev.above++;return '';}
  if(AP_LAST){AP_LAST.dev.full++;AP_LAST.drawn.push({d,svg});}return svg;}
// the object menu's Eleje entry: auto → ↑ → → → ↓ → ← → auto (o.front absent = derived)
const AP_FRONT_ORD=[undefined,0,90,180,270],AP_FRONT_ARR={0:'↑',90:'→',180:'↓',270:'←'};
function apFrontCycle(o){const i=AP_FRONT_ORD.indexOf(o.front),n=AP_FRONT_ORD[(i+1)%AP_FRONT_ORD.length];if(n===undefined)delete o.front;else o.front=n;return o.front;}
function apFrontLabel(o){return o.front!=null&&AP_FRONT_ARR[o.front]?AP_FRONT_ARR[o.front]+' (kézi)':'automatikus';}

// ---------- V9b: the annotation, every text through one placer ----------
// Sizes are paper mm at state.bpScale (bpU / bpFS); the placer works in base units (screen y down). Greedy: texts in
// priority order (room tags, codes, dimension texts), each tries rings of spots around its anchor and takes the first
// that touches no placed text and no block (endpoint symbols, chain lines, the north arrow), else the least overlap;
// a text moved off its anchor gets a leader, which later texts also keep off.
const AP_TXT={room:3.5,area:2.5,code:1.8,dim:2.5,north:3.5};   // paper mm
function apTextW(t,fs){return [...String(t)].reduce((a,c)=>a+(/[0-9]/.test(c)?.56:/[A-ZÁÉÍÓÖŐÚÜŰ]/.test(c)?.68:/[mwMW]/.test(c)?.84
  :/[ilj.,:;'|!·]/.test(c)?.3:c===' '?.3:c==='²'?.36:.56),0)*fs;}
function apBoxOv(a,b){return Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));}
// the box of a drawn symbol: circles, rects, lines, polygons in the svg string (no text: Alaprajz prints none there)
function apSvgBox(svg){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const add=(x,y)=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);};
  const num=(e,k)=>{const m=e.match(new RegExp('\\s'+k+'="(-?[\\d.]+)"'));return m?+m[1]:null;};
  for(const e of svg.match(/<(circle|rect|line|polygon|polyline|ellipse)\b[^>]*>/g)||[]){const t=e.slice(1).split(/\s/)[0];
    if(t==='circle'||t==='ellipse'){const r=num(e,'r'),cx=num(e,'cx'),cy=num(e,'cy'),rx=r!=null?r:num(e,'rx'),ry=r!=null?r:num(e,'ry');
      if(cx!=null&&cy!=null&&rx!=null&&ry!=null){add(cx-rx,cy-ry);add(cx+rx,cy+ry);}}
    else if(t==='rect'){const x=num(e,'x'),y=num(e,'y'),w=num(e,'width'),h=num(e,'height');if(x!=null&&y!=null&&w!=null&&h!=null){add(x,y);add(x+w,y+h);}}
    else if(t==='line'){const a=num(e,'x1'),b=num(e,'y1'),c=num(e,'x2'),d=num(e,'y2');if(a!=null&&b!=null&&c!=null&&d!=null){add(a,b);add(c,d);}}
    else{const m=e.match(/points="([^"]*)"/);if(m)m[1].trim().split(/\s+/).forEach(q=>{const v=q.split(',').map(Number);if(v.length===2&&!isNaN(v[0])&&!isNaN(v[1]))add(v[0],v[1]);});}}
  return x1>=x0?[x0,y0,x1,y1]:null;}
function apPlacer(){const placed=[],blocks=[],leads=[];let svg='',nLead=0;
  const cost=b=>placed.reduce((k,p)=>k+apBoxOv(b,p.b),0)*4+blocks.reduce((k,q)=>k+apBoxOv(b,q.b),0)+leads.reduce((k,q)=>k+apBoxOv(b,q),0)*2;
  const txt=(x,y,l)=>{const a=`x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${l.fs.toFixed(2)}" font-weight="${l.w||400}" text-anchor="middle" dominant-baseline="central" font-family="Arial,Segoe UI"`;
    return `<text ${a} fill="#fff" stroke="#fff" stroke-width="${(l.fs*.3).toFixed(2)}" stroke-linejoin="round">${esc(l.t)}</text><text ${a} fill="${l.col||'#111'}">${esc(l.t)}</text>`;};
  return {
    block(b,kind){if(b)blocks.push({b,kind:kind||'x'});},
    // it = {x, y, lines:[{t, fs, w, col}], r (clearance), pref (screen degrees), center, kind}
    add(it){const W=Math.max(...it.lines.map(l=>apTextW(l.t,l.fs)))+it.lines[0].fs*.35,H=it.lines.reduce((a,l)=>a+l.fs*1.18,0)+it.lines[0].fs*.1;
      const step=it.lines[0].fs*.7,angs=(it.pref||[]).concat([90,0,180,270,45,135,225,315,30,60,120,150,210,240,300,330]);let best=null;
      const at=(cx,cy,ring)=>{const b=[cx-W/2,cy-H/2,cx+W/2,cy+H/2],k=cost(b);if(!best||k<best.k-1e-9)best={b,k,cx,cy,ring};return k===0;};
      if(!(it.center&&at(it.x,it.y,0)))
        outer:for(let ring=0;ring<14;ring++){const dd=(it.r||0)+ring*step;
          for(const a of angs){const c=Math.cos(a*Math.PI/180),sn=Math.sin(a*Math.PI/180);
            if(at(it.x+c*(dd+W/2*Math.abs(c)),it.y+sn*(dd+H/2*Math.abs(sn)),it.center?ring+1:ring))break outer;}}
      placed.push({b:best.b,kind:it.kind});
      const moved=Math.hypot(best.cx-it.x,best.cy-it.y)>(it.center?H:(it.r||0)+Math.max(W,H)/2+step*1.5);
      if(moved){nLead++;const lx=Math.max(best.b[0],Math.min(it.x,best.b[2])),ly=Math.max(best.b[1],Math.min(it.y,best.b[3]));
        svg+=`<line class="ap-lead" x1="${it.x.toFixed(2)}" y1="${it.y.toFixed(2)}" x2="${lx.toFixed(2)}" y2="${ly.toFixed(2)}" stroke="#555" stroke-width="${bpSW(AP_PEN.hid)}"/>`;
        const L=Math.hypot(lx-it.x,ly-it.y),n=Math.max(1,Math.ceil(L/(step*2))),r=step*.6;
        for(let k=1;k<n;k++){const x=it.x+(lx-it.x)*k/n,y=it.y+(ly-it.y)*k/n;leads.push([x-r,y-r,x+r,y+r]);}}
      let y=best.cy-H/2+it.lines[0].fs*.05;
      for(const l of it.lines){y+=l.fs*.59;svg+=txt(best.cx,y,l);y+=l.fs*.59;}
      return best;},
    // a text that stays where it is (the north letter): drawn as given, the others avoid it
    fixed(x,y,l,kind){const W=apTextW(l.t,l.fs)+l.fs*.35,H=l.fs*1.2;placed.push({b:[x-W/2,y-H/2,x+W/2,y+H/2],kind:kind||'fixed'});svg+=txt(x,y,l);},
    stats(){let ov=0;for(let i=0;i<placed.length;i++){for(let j=i+1;j<placed.length;j++)if(apBoxOv(placed[i].b,placed[j].b)>1e-6)ov++;
        for(const q of blocks)if(q.kind==='ep'&&apBoxOv(placed[i].b,q.b)>1e-6)ov++;}
      return {texts:placed.length,leaders:nLead,overlaps:ov};},
    boxes:()=>placed.slice(),
    svg:()=>svg};}

// the code the Normal view prints under a device's symbol (its first <text>), and that text's colour
function apDevCode(d){const st=state.style,sr=state.showRefs;state.style='normal';state.showRefs=false;let sv='';
  try{sv=devSym(d);}finally{state.style=st;state.showRefs=sr;}
  const m=sv.match(/<text\b([^>]*)>([^<]*)<\/text>/);if(!m||!m[2].trim())return null;
  const c=m[1].match(/\sfill="([^"]+)"/);
  return {t:m[2].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'),col:c&&c[1]!=='#fff'?c[1]:'#333'};}

function apAnnotSvg(){const S=AP_LAST;if(!S)return '';const level=state.active,z=dz(level,0),Pl=apPlacer(),fs=v=>bpU(v);
  const L={rooms:0,codes:0,dims:0,chains:0,north:0};let s='';
  // blocks: every drawn endpoint symbol
  for(const e of S.drawn)Pl.block(apSvgBox(e.svg),'ep');
  // dimension chains (lines first, so every text keeps off them)
  const bb=bpBBox(level),dimTxt=[];
  if(bb&&state.apDims!==false){const xs=new Set(),ys=new Set();
    // the façade on that side: walls within 400 mm of the level box edge (their edges = corners and set-backs) and the
    // openings hosted in them; the box edges always
    const band=400,WL=(WALLS[level]||[]),onTop=r=>r.y0<=bb.y0+band,onLeft=r=>r.x0<=bb.x0+band;
    xs.add(Math.round(bb.x0));xs.add(Math.round(bb.x1));ys.add(Math.round(bb.y0));ys.add(Math.round(bb.y1));
    WL.forEach(r=>{if(onTop(r)){xs.add(Math.round(r.x0));xs.add(Math.round(r.x1));}if(onLeft(r)){ys.add(Math.round(r.y0));ys.add(Math.round(r.y1));}});
    data.openings.forEach(o=>{if(o.level!==level||o.type==='stairs')return;const h=opnHost(o);if(!h)return;const w=o.w||(o.type==='window'?WIN_W:DOOR_W);
      const horiz=(h.x1-h.x0)>=(h.y1-h.y0);
      if(horiz&&onTop(h)){xs.add(Math.round(o.x-w/2));xs.add(Math.round(o.x+w/2));}
      if(!horiz&&onLeft(h)){ys.add(Math.round(o.y-w/2));ys.add(Math.round(o.y+w/2));}});
    const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b);
    const chain=(vals,fixed,axis)=>{if(vals.length<2)return;L.chains++;
      const A=axis==='x'?[vals[0],fixed]:[fixed,vals[0]],B=axis==='x'?[vals[vals.length-1],fixed]:[fixed,vals[vals.length-1]];
      s+=`<polyline class="ap-dim" points="${p2b([[A[0],A[1],z],[B[0],B[1],z]])}" fill="none" stroke="#111" stroke-width="${bpSW(AP_PEN.beyond)}"/>`;
      const a=planToBase(A[0],A[1],z),b=planToBase(B[0],B[1],z),t=bpU(.5);
      Pl.block([Math.min(a[0],b[0])-t,Math.min(a[1],b[1])-t,Math.max(a[0],b[0])+t,Math.max(a[1],b[1])+t],'dim');
      vals.forEach(v=>{const px=axis==='x'?v:fixed,py=axis==='x'?fixed:v;s+=bpTick(px,py,z,axis==='x'?Math.PI/4:-Math.PI/4);});
      // the outer side (plan −y for the x chains, −x for the y chains) in screen degrees
      const o0=planToBase(A[0],A[1],z),o1=planToBase(A[0]-(axis==='y'?1000:0),A[1]-(axis==='x'?1000:0),z);
      const ang=Math.round(Math.atan2(o1[1]-o0[1],o1[0]-o0[0])*180/Math.PI);
      for(let i=1;i<vals.length;i++){const dv=Math.round(vals[i]-vals[i-1]);if(dv<60)continue;const m=(vals[i]+vals[i-1])/2;
        const q=planToBase(axis==='x'?m:fixed,axis==='x'?fixed:m,z);dimTxt.push({x:q[0],y:q[1],t:(dv/1000).toFixed(2).replace('.',','),ang});}};
    chain(X,bb.y0-900,'x');chain([bb.x0,bb.x1],bb.y0-1900,'x');chain(Y,bb.x0-900,'y');chain([bb.y0,bb.y1],bb.x0-1900,'y');}
  // north arrow (the blueprint convention: north = plan −y)
  if(bb){const nx=bb.x1+2200,ny=bb.y0+300;L.north=1;
    s+=`<g class="ap-north"><polyline points="${p2b([[nx,ny+900,z],[nx,ny-900,z]])}" fill="none" stroke="#111" stroke-width="${bpSW(AP_PEN.beyond)}"/>`
      +`<polygon points="${p2b([[nx,ny-1150,z],[nx-260,ny-500,z],[nx+260,ny-500,z]])}" fill="#111"/></g>`;
    const a=planToBase(nx-300,ny-1150,z),b=planToBase(nx+300,ny+900,z);Pl.block([Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])],'north');
    const q=planToBase(nx,ny-1550,z);Pl.fixed(q[0],q[1],{t:'É',fs:fs(AP_TXT.north),w:700},'north');}
  // room tags
  const rooms=[];(ROOMSB[level]||[]).forEach((rm,i)=>{if(state.soloRoom&&!soloRoomIs({src:'B',i,level}))return;rooms.push(rm);});
  data.floors.forEach((fl,i)=>{if(fl.level!==level||!fl.poly||fl.poly.length<3)return;if(state.soloRoom&&!soloRoomIs({src:'F',i,level}))return;rooms.push(fl);});
  for(const rm of rooms){if(rm.noText||!rm.name)continue;
    let cx=0,cy=0;rm.poly.forEach(p=>{cx+=p[0];cy+=p[1];});cx/=rm.poly.length;cy/=rm.poly.length;
    const c=planToBase(cx,cy,z),lines=[{t:((rm.num?rm.num+'  ':'')+rm.name).toUpperCase(),fs:fs(AP_TXT.room),w:700},
      {t:(polyArea(rm.poly)/1e6).toFixed(2).replace('.',',')+' m²',fs:fs(AP_TXT.area)}];
    if(rm.mat)lines.push({t:rm.mat,fs:fs(AP_TXT.area)});
    Pl.add({x:c[0],y:c[1],lines,center:true,kind:'room'});L.rooms++;}
  // endpoint codes
  if(state.apCodes!==false)for(const e of S.drawn){const k=apDevCode(e.d),b=apSvgBox(e.svg);if(!k||!b)continue;
    Pl.add({x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,r:Math.max(b[2]-b[0],b[3]-b[1])/2+bpU(.3),lines:[{t:k.t,fs:fs(AP_TXT.code),w:700,col:k.col}],pref:[90,0,180,270],kind:'code'});L.codes++;}
  // dimension texts, on the outer side of their chain
  for(const t of dimTxt){Pl.add({x:t.x,y:t.y,r:bpU(.6),lines:[{t:t.t,fs:fs(AP_TXT.dim)}],pref:[t.ang],kind:'dim'});L.dims++;}
  S.labels=Object.assign(L,Pl.stats());S.boxes=Pl.boxes();
  return `<g class="ap-annot">${s}${Pl.svg()}</g>`;}
