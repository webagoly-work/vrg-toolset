// ==========================================================================
// 08h-wf-routewalls.js — workflow round (docs/workflow), WP-R2: Vezethető fal — the routing-walls tool
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// THE key feature of the workflow: the user draws only the HORIZONTAL intent — which walls a route may run along — and
// every height comes from the standards. On P33 this was 24 loose Csatorna lines matched to walls with ±500 mm; here it
// is recorded exactly, on the wall itself, as Jelölés marks (Q-R03 = A):
//   whole wall, both faces → {kind:'wall', wall, tags:['vezetheto'], pol:'plus'}
//   part of a wall         → {kind:'wspan', wall, u0, u1, tags:['vezetheto'], pol:'plus'}   (u = mm along the centreline)
// LMB click on a wall toggles the whole wall; hold + drag along a wall marks that part; Shift + drag a box on empty floor
// marks every wall whose middle is inside. rwlAllowed(level) is the ONE query the router (E2 / E5) reads.
MRK_KINDS.wspan='Falszakasz (mindkét oldal)';
if(MRK_TAGS.wall&&!MRK_TAGS.wall.some(t=>t.k==='vezetheto'))MRK_TAGS.wall.unshift({k:'vezetheto',n:'Vezethető fal (vízszintes pálya)',pol:'plus'});
const RWL_SNAP=50,RWL_BAND=60,RWL_COL='#2e9e5b';

function rwlIs(m){return !!m&&(m.tags||[]).indexOf('vezetheto')>=0&&(m.kind==='wall'||m.kind==='wspan');}
function rwlMarks(level){return mrkList().filter(m=>rwlIs(m)&&(!level||m.level===level));}
// merged allowed intervals per wall: [{wall, level, u0, u1}] — a whole-wall mark is [0, length]
function rwlAllowed(level){const by={};
  rwlMarks(level).forEach(m=>{const r=mrkWallById(m.level,m.wall);if(!r)return;const L=mrkWallLen(r);
    const iv=m.kind==='wall'?[0,L]:[Math.max(0,Math.min(m.u0,m.u1)),Math.min(L,Math.max(m.u0,m.u1))];(by[m.wall]=by[m.wall]||{level:m.level,iv:[]}).iv.push(iv);});
  const out=[];Object.keys(by).forEach(id=>{const I=by[id].iv.sort((a,b)=>a[0]-b[0]);let cur=null;
    I.forEach(v=>{if(cur&&v[0]<=cur[1]+0.5)cur[1]=Math.max(cur[1],v[1]);else{if(cur)out.push({wall:id,level:by[id].level,u0:cur[0],u1:cur[1]});cur=v.slice();}});
    if(cur)out.push({wall:id,level:by[id].level,u0:cur[0],u1:cur[1]});});
  return out;}
function rwlCovers(wallId,u,level){return rwlAllowed(level).some(a=>a.wall===wallId&&u>=a.u0-0.5&&u<=a.u1+0.5);}
function rwlToggleWall(r,level){const ex=mrkList().filter(m=>rwlIs(m)&&m.kind==='wall'&&m.wall===r.id);
  if(ex.length){pushUndo(['marks']);data.marks=mrkList().filter(m=>ex.indexOf(m)<0);return false;}
  mrkAdd({kind:'wall',level,wall:r.id,pol:'plus',tags:['vezetheto']});return true;}
function rwlAddSpan(r,level,u0,u1){const a=Math.min(u0,u1),b=Math.max(u0,u1);if(b-a<100)return null;
  mrkAdd({kind:'wspan',level,wall:r.id,u0:a,u1:b,pol:'plus',tags:['vezetheto']});return mrkList()[mrkList().length-1];}
function rwlBoxWalls(level,x0,y0,x1,y1){const X0=Math.min(x0,x1),X1=Math.max(x0,x1),Y0=Math.min(y0,y1),Y1=Math.max(y0,y1);
  return (WALLS[level]||[]).filter(r=>{const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;return cx>=X0&&cx<=X1&&cy>=Y0&&cy<=Y1;});}

// R5 (2026-10-15): the routing-wall tool is the marker pen with the Vezethető fal ink (08ia) — drag along the centreline,
// a click marks one wall of one room. The data API above (rwlAllowed / rwlCovers / rwlToggleWall / rwlAddSpan) is unchanged.
function rwlToolStart(){return mkpStart('vezetheto');}
function rwlToolOff(){if(typeof MKP!=='undefined'&&MKP.on&&MKP.ink==='vezetheto')mkpOff();}

// the green band on the centreline (both faces) — persisted drawing, so the scene
function rwlBandSvg(level,u0,u1,r,col,op){const wi=wallInfo(r),a=wi.seg[0],z=dz(level,0),h=RWL_BAND/2;
  const P=wi.horiz?[[a[0]+u0,a[1]-h],[a[0]+u1,a[1]-h],[a[0]+u1,a[1]+h],[a[0]+u0,a[1]+h]]:[[a[0]-h,a[1]+u0],[a[0]+h,a[1]+u0],[a[0]+h,a[1]+u1],[a[0]-h,a[1]+u1]];
  return `<polygon class="rwl-band" points="${p2b(P.map(q=>[q[0],q[1],z]))}" fill="${col}" fill-opacity="${op}" stroke="${col}" stroke-width="${vsP(0.8)}"/>`;}
STK_SCENE.push(()=>{let s='';for(const l of ORD){if(!state.levels[l])continue;
  rwlAllowed(l).forEach(a=>{const r=mrkWallById(l,a.wall);if(r)s+=rwlBandSvg(l,a.u0,a.u1,r,RWL_COL,0.55);});}return s;});
registerActions([{id:'wf.routeWalls',label:'Vezethető fal',icon:'🟩',group:'Véset',alias:'routing walls vezetheto fal palya',
  hint:'Mely falak mentén futhat vízszintes pálya — kattintás: egész fal, húzás: szakasz.',when:c=>!c.inEditor,run:()=>rwlToolStart()}]);
(function(){const b=$('rwlBtn');if(b)b.onclick=()=>rwlToolStart();})();
