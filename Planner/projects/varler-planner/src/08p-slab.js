// ==========================================================================
// 08p-slab.js — round 2026-10-18 (docs/round-2026-10-18), WP-S1…S3: Födém
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The table and the level step live in 00-core.js (SLABS, slbT, slbStep — floorRealZ / floorDispZ read them). Answer
// S1 = B: LH[l] stays the inner height, a common-thickness slab is ADDED between two levels. Here:
//   - save / load (a file only carries SLABS when one is on, so every older file and capture stays byte-identical);
//   - the slab body in 3D: the union of the level's floors and walls, extruded DOWN from the floor by t;
//     a floor with fl.slab === false is a hole (stair, void) — drawing only, the level step cannot vary per floor;
//   - the switches: room RCO, the ▬ Födém tool (Alapozás, next to Padló létrehozása), the Szintek panel row;
//   - S3: the slab underside as a drawing height of the upper level (h = −t = the lower level's mennyezet, the lowest
//     point a path of the upper level reaches), and the cross-level coincidence query. Prefix: slb.

function slbAny(){return ORD.some(l=>slbT(l)>0);}
// a file carries SLABS only when it matters (golden /session captures unchanged otherwise)
function slbPut(o){if(slbAny())o.SLABS=JSON.parse(JSON.stringify(SLABS));return o;}
// load: start from all-off (a file without SLABS has no slab), then take what the file says
function slbGet(o){ORD.forEach(l=>{SLABS[l]={on:false,t:SLAB_T_DEFAULT};});
  const src=o&&o.SLABS;if(src)ORD.forEach(l=>{const v=src[l];if(v)SLABS[l]={on:!!v.on,t:Math.max(0,+v.t||SLAB_T_DEFAULT)};});
  if(typeof slbSyncUI==='function')slbSyncUI();}
function slbUnderside(l){return floorRealZ(l)-slbT(l);}
function slbBelow(l){const i=ORD.indexOf(l);return i>0?ORD[i-1]:null;}
// the one change for every slab switch: the whole model moves (every z above it); the undo entry opts in to SLABS
function slbSet(levels,on,t){pushUndo(['__slabs']);levels.forEach(l=>{const s=SLABS[l]||(SLABS[l]={on:false,t:SLAB_T_DEFAULT});
  if(on!=null)s.on=!!on;if(t!=null)s.t=Math.max(0,Math.round(+t||0));});
  slbSyncUI();if(typeof rebuildDrawH==='function')rebuildDrawH();draw();}
function slbFloorHole(fl,hole){pushUndo(['floors']);if(hole)fl.slab=false;else delete fl.slab;draw();}

// ---- the slab body: an axis-aligned cell grid over the level's floors + walls --------------------------------------
// Rooms drawn with the workflow tools are inner faces with the walls between them, so the slab must run under the
// walls too: a cell is slab when its centre is inside a wall, or inside a floor that is not a hole. Only the outline
// of that union gets side faces (two neighbouring rooms must not draw a face between them). Polygons that are not
// axis-aligned come out as a staircase of cells — fine for a slab edge.
const SLB_MEMO=new Map();
function slbInputs(l){const walls=(WALLS[l]||[]).map(wr),polys=[],holes=[];
  data.floors.forEach(fl=>{if(fl.level!==l||!fl.poly||fl.poly.length<3||fl.stage==='outline')return;(fl.slab===false?holes:polys).push(fl.poly);});
  if(SLAB[l])polys.push(SLAB[l]);(ROOMSB[l]||[]).forEach(rm=>{if(rm.poly&&rm.poly.length>=3)polys.push(rm.poly);});
  return {walls,polys,holes};}
function slbOutline(l){const I=slbInputs(l),key=JSON.stringify(I);
  if(SLB_MEMO.has(key))return SLB_MEMO.get(key);
  const xs=new Set(),ys=new Set();
  I.walls.forEach(r=>{xs.add(r.x0);xs.add(r.x1);ys.add(r.y0);ys.add(r.y1);});
  I.polys.concat(I.holes).forEach(p=>p.forEach(q=>{xs.add(q[0]);ys.add(q[1]);}));
  const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b),nx=X.length-1,ny=Y.length-1,cell=[];
  const inW=(x,y)=>I.walls.some(r=>x>Math.min(r.x0,r.x1)&&x<Math.max(r.x0,r.x1)&&y>Math.min(r.y0,r.y1)&&y<Math.max(r.y0,r.y1));
  for(let j=0;j<ny;j++){const row=[];const cy=(Y[j]+Y[j+1])/2;
    for(let i=0;i<nx;i++){const cx=(X[i]+X[i+1])/2;
      row.push(inW(cx,cy)||(I.polys.some(p=>pointInPoly(cx,cy,p))&&!I.holes.some(p=>pointInPoly(cx,cy,p))));}
    cell.push(row);}
  const on=(i,j)=>i>=0&&j>=0&&i<nx&&j<ny&&cell[j][i];
  // boundary edges, merged into runs: {a:[x,y], b:[x,y], out:[dx,dy]}
  const edges=[];
  for(let j=0;j<=ny;j++){let run=null;for(let i=0;i<=nx;i++){            // horizontal edges at y = Y[j]
    const up=on(i,j-1),dn=on(i,j),side=(i<nx&&up!==dn)?(dn?-1:1):0;
    if(run&&run.side!==side){edges.push({a:[X[run.i0],Y[j]],b:[X[i],Y[j]],out:[0,run.side]});run=null;}
    if(side&&!run)run={i0:i,side};}}
  for(let i=0;i<=nx;i++){let run=null;for(let j=0;j<=ny;j++){            // vertical edges at x = X[i]
    const lf=on(i-1,j),rt=on(i,j),side=(j<ny&&lf!==rt)?(rt?-1:1):0;
    if(run&&run.side!==side){edges.push({a:[X[i],Y[run.j0]],b:[X[i],Y[j]],out:[run.side,0]});run=null;}
    if(side&&!run)run={j0:j,side};}}
  const out={edges,cells:cell.reduce((n,r)=>n+r.filter(Boolean).length,0)};
  if(SLB_MEMO.size>24)SLB_MEMO.clear();SLB_MEMO.set(key,out);return out;}
// the side faces under the floor (the top is the floors themselves; the underside is never seen from the cameras)
function slbPushFaces(faces,l,fz){const t=slbT(l);if(!t)return;const z0=fz-t,z1=fz;
  slbOutline(l).edges.forEach(e=>{let pts=[[e.a[0],e.a[1],z0],[e.b[0],e.b[1],z0],[e.b[0],e.b[1],z1],[e.a[0],e.a[1],z1]];
    let n0=newell(pts);if(n0[0]*e.out[0]+n0[1]*e.out[1]<0){pts=pts.reverse();n0=newell(pts);}
    if(!faceVisible(n0))return;const n=rotN(n0,state.rot);
    faces.push({pts,fill:shade([172,168,158],n),stroke:'#6b665c',op:1,dash:null,
      key:depthOf((e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2,(z0+z1)/2)});});}

// ---- S3: the slab underside as a drawing height ----------------------------------------------------------------------
// A pseudo guide (never stored in GUIDES, so saved files and the guide panel stay as they were): on a level with a slab
// it resolves to −t — the lower level's ceiling, the lowest point a path of this level can reach through the slab.
const SLB_GUIDE={k:'slab',mm:'slab',l:'Födém alja (alsó mennyezet)',c:'#6b5b95',vis:false,jump:true,sys:true};
// world z of a path node (real spacing, never the exploded display gap)
function slbNodeZ(level,n){return floorRealZ(level)+(n.h||0);}
// nodes of two adjacent levels at the same world point (±5 mm): the path between the levels
function slbThru(){const out=[],ns=[];
  data.paths.forEach(p=>(p.nodes||[]).forEach(n=>{const l=n.level||p.level;if(l)ns.push({p:p.id,n,l,z:slbNodeZ(l,n)});}));
  const lower=ns.filter(o=>ns.some(u=>slbBelow(u.l)===o.l));
  ns.forEach(u=>{if((u.n.h||0)>=0||!slbT(u.l))return;const pl=slbBelow(u.l);
    lower.forEach(o=>{if(o.l===pl&&Math.abs(o.n.x-u.n.x)<=5&&Math.abs(o.n.y-u.n.y)<=5&&Math.abs(o.z-u.z)<=5)out.push({up:{p:u.p,n:u.n.id,level:u.l},down:{p:o.p,n:o.n.id,level:o.l}});});});
  return out;}
// where a riser is welcome: the Jelölés vertical strips tagged felszálló (either level of the crossing)
function slbRiserSpots(){if(typeof mrkList!=='function')return [];const out=[];
  mrkList().forEach(m=>{if(m.kind!=='vstrip'||(m.tags||[]).indexOf('felszallo')<0)return;const r=mrkWallById(m.level,m.wall);if(!r)return;
    const p=mrkFacePt(r,m.side,(m.u0+m.u1)/2,0);const lv=[m.level];const up=ORD[ORD.indexOf(m.level)+1];if(up)lv.push(up);
    lv.forEach(level=>out.push({level,x:p[0],y:p[1]}));});
  return out;}
VALIDATORS.push({code:'slb.*',run:()=>{const out=[];if(!slbAny())return out;
  const fels=slbRiserSpots();
  data.paths.forEach(p=>(p.nodes||[]).forEach(n=>{const l=n.level||p.level,h=n.h||0;if(!l||h>=0)return;const t=slbT(l);
    if(h<-t-0.5)out.push({sev:'error',code:'slb.deep',ref:p.id,msg:'Pálya csomópont a födém alatt ('+h+' mm, födém '+t+' mm) — '+p.id});
    else if(!fels.some(m=>m.level===l&&Math.hypot(m.x-n.x,m.y-n.y)<=500))
      out.push({sev:'info',code:'slb.thru',ref:p.id,msg:'Födémáttörés felszálló-jelölés nélkül — '+p.id});}));
  return out;}});


// ---- the slab in the other views ---------------------------------------------------------------------------------------
function slbAbove(l){const i=ORD.indexOf(l);return i>=0&&i<ORD.length-1?ORD[i+1]:null;}
// wall elevation (06): the slab of the level above sits on top of a full-height wall, as a hatched band. The band is
// capped at 40 px so it never leaves the sheet's top margin; its label quotes the real thickness.
function slbElevBand(d,X,Y,sc,len){const up=slbAbove(d.level),t=up?slbT(up):0;if(!t)return '';
  const top=wallH(d.level);if(Math.abs((d.H||0)-top)>1)return '';            // a lower wall does not carry the slab
  const x0=Math.min(X(0),X(len)),w=+(len*sc).toFixed(1),hp=+Math.min(t*sc,40).toFixed(1),y1=Y(top),y0=+(y1-hp).toFixed(1);
  return `<g class="slb-band"><pattern id="slbh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#e4e1d8"/><line x1="0" y1="0" x2="0" y2="6" stroke="#9a9488" stroke-width="0.8"/></pattern>`
    +`<rect x="${x0}" y="${y0}" width="${w}" height="${hp}" fill="url(#slbh)" stroke="#6b665c" stroke-width="0.9"/>`
    +`<text x="${(x0+w/2).toFixed(1)}" y="${(y0+hp/2+3).toFixed(1)}" font-size="9" text-anchor="middle" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">Födém ${t} mm</text>`
    +`<text x="${(x0+w/2).toFixed(1)}" y="${(y0+hp/2+3).toFixed(1)}" font-size="9" text-anchor="middle" fill="#4f4a42">Födém ${t} mm</text></g>`;}
// Alaprajz (06e): a hole in the floor you stand on (fl.slab === false) is a void — its edge as a "beyond" line and the
// void cross; a hole in the slab above is above the cut — outline and cross dashed. Geometry only: the clean plan carries no text.
function slbPlanEdges(level,z,dash){let svg='',n=0;const pg=(poly,w,da)=>`<polygon points="${p2b(poly.map(p=>[p[0],p[1],z]))}" fill="none" stroke="#111" stroke-width="${bpSW(w)}"${da?` stroke-dasharray="${da}"`:''}/>`;
  // the void cross: the two diagonals of the hole's bounding box (a hole the size of a room hides its outline in the walls)
  const cross=(poly,da)=>{const b=polyBBox(poly),ln=(p,q)=>`<polyline points="${p2b([[p[0],p[1],z],[q[0],q[1],z]])}" fill="none" stroke="#111" stroke-width="${bpSW(AP_PEN.hid)}"${da?` stroke-dasharray="${da}"`:''}/>`;
    return ln([b.x0,b.y0],[b.x1,b.y1])+ln([b.x1,b.y0],[b.x0,b.y1]);};
  if(slbT(level))data.floors.forEach(fl=>{if(fl.level!==level||fl.slab!==false||!fl.poly||fl.poly.length<3)return;n++;
    svg+=pg(fl.poly,AP_PEN.beyond,null)+cross(fl.poly,null);});
  const up=slbAbove(level);
  if(up&&slbT(up))data.floors.forEach(fl=>{if(fl.level!==up||fl.slab!==false||!fl.poly||fl.poly.length<3)return;n++;svg+=pg(fl.poly,AP_PEN.hid,dash)+cross(fl.poly,dash);});
  return {svg:svg?`<g class="slb-edge">${svg}</g>`:'',n};}
// Mennyezet plane (07): path nodes (label: "Emelet ⇣" = through to this ceiling, "Emelet −120" = stops in the slab) of the level above that reach down into its slab. A node at h = −t is ON this
// ceiling (the lowest point the upper level reaches); a shallower one stops inside the slab. Shown, not editable here.
function slbThruInto(level,bb){const up=slbAbove(level),t=up?slbT(up):0,out=[];if(!t)return out;
  data.paths.forEach((p,pi)=>(p.nodes||[]).forEach((n,ni)=>{if((n.level||p.level)!==up||(n.h||0)>=0)return;
    if(bb&&(n.x<bb.x0||n.x>bb.x1||n.y<bb.y0||n.y>bb.y1))return;
    out.push({pi,ni,u:n.x,h:n.y,z:n.h||0,on:(n.h||0)<=-t+0.5,level:up});}));
  return out;}
function slbThruSvg(d,X,Y){const nm=slbLevelName(d.thru[0].level);return d.thru.map(r=>{const x=X(r.u),y=Y(r.h),col=r.on?'#6b5b95':'#a99cc4';
  return `<g class="slb-thru"><circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="${col}" stroke-width="1.8"/><circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${col}" stroke-width="1.2"/>`
    // short label, on the side of the room with more space (a narrow room otherwise pushes it into the wall)
    +(()=>{const left=x>X((d.pb.x0+d.pb.x1)/2);return pvText((left?x-13:x+13).toFixed(1),(y+4).toFixed(1),esc(nm+(r.on?' ⇣':' '+Math.round(r.z))),9,col,left?'end':'start');})()+`</g>`;}).join('');}
function slbCeilNote(level){const up=slbAbove(level),t=up?slbT(up):0;return t?' · a felső födém alja ('+t+' mm)':'';}

// ---- the switches ----------------------------------------------------------------------------------------------------
function slbLevelName(l){return {basement:'Pince',ground:'Földszint',upper:'Emelet'}[l]||l;}
function slbRoomMenu(rh,items){const l=rh.level,t=slbT(l);
  items.push({label:t?('▬ Födém levétele e szint alól ('+t+' mm)'):('▬ Födém e szint alá ('+(SLABS[l].t||SLAB_T_DEFAULT)+' mm)'),act:()=>slbSet([l],!t)});
  if(t&&rh.src==='F'){const fl=data.floors[rh.i];if(fl)items.push({label:fl.slab===false?'▬ Födém e padló alatt is':'▬ Födém kihagyása e padló alatt (lépcső, áttörés)',act:()=>slbFloorHole(fl,fl.slab!==false)});}}
function slbDialog(){const row=l=>`<div class="mrow"><label style="width:110px;display:inline-block"><input type="checkbox" class="slbOn" data-l="${l}" ${SLABS[l].on?'checked':''}> ${slbLevelName(l)}</label>`
    +`<input type="number" class="slbTv" data-l="${l}" value="${SLABS[l].t}" step="10" min="0" style="width:70px"> mm</div>`;
  openModal('Födém — a szintek alatt',
    `<div class="mrow" style="font-size:11.5px;color:var(--pc-dim,#666)">A belmagasság nem változik: a födém a két szint <b>közé</b> kerül, a felső szint padlója a vastagsággal feljebb kerül. A legalsó szint födéme 0 alá lóg.</div>`
    +[...ORD].reverse().map(row).join('')
    +`<div class="mrow"><button id="slbAll">Födém minden szintre (${SLAB_T_DEFAULT} mm)</button> <button id="slbNone">Mind ki</button></div>`,
    ()=>{pushUndo(['__slabs']);document.querySelectorAll('.slbOn').forEach(c=>{SLABS[c.dataset.l].on=c.checked;});
      document.querySelectorAll('.slbTv').forEach(i=>{SLABS[i.dataset.l].t=Math.max(0,Math.round(+i.value||0));});
      slbSyncUI();if(typeof rebuildDrawH==='function')rebuildDrawH();draw();},'Alkalmaz');
  $('slbAll').onclick=()=>{closeModal();slbSet(ORD,true,SLAB_T_DEFAULT);};
  $('slbNone').onclick=()=>{closeModal();slbSet(ORD,false);};}
function slbSyncUI(){const c=$('slbLvlOn'),i=$('slbLvlT');if(!c||!i)return;const l=state.active||'ground';
  c.checked=!!SLABS[l].on;i.value=SLABS[l].t;const lb=$('slbLvlName');if(lb)lb.textContent=slbLevelName(l);}
registerActions([{id:'slab.level',label:'Födém',icon:'▬',group:'Helyiség',alias:'fodem slab floor thickness',
  hint:'Födém a szintek között: a padló alá kerül, a belmagasság marad, a felső szint feljebb kerül.',when:()=>true,run:()=>slbDialog()}]);
(function(){const b=$('slbBtn');if(b)b.onclick=()=>slbDialog();
  const c=$('slbLvlOn'),i=$('slbLvlT');
  if(c)c.onchange=()=>slbSet([state.active],c.checked);
  if(i)i.onchange=()=>slbSet([state.active],null,i.value);
  document.querySelectorAll('input[name=al]').forEach(r=>r.addEventListener('change',slbSyncUI));
  slbSyncUI();})();
window.slbT=slbT;window.SLABS=SLABS;window.slbSet=slbSet;window.slbOutline=slbOutline;window.slbThru=slbThru;window.slbUnderside=slbUnderside;
