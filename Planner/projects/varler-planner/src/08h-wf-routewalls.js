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
const RWL={on:false,press:null,cur:null};
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
function rwlSnapU(u){return Math.round(u/RWL_SNAP)*RWL_SNAP;}

function rwlToolStart(){if(typeof mrkToolsOff==='function')mrkToolsOff();if(state.mode!=='select')setMode('select');RWL.on=true;RWL.press=null;
  const mh=$('modeHint');if(mh)mh.textContent='Vezethető fal — kattints egy falra: az egész fal (mindkét oldal) vezethető, újra kattintva leveszed. '
    +'Nyomva tartva húzd a fal mentén: csak az a szakasz. Shift + keret üres helyen: minden fal benne. Esc: kész.';draw();}
function rwlToolOff(){RWL.on=false;RWL.press=null;RWL.cur=null;const mh=$('modeHint');if(mh)mh.textContent=HINTS[state.mode]||'';}
function rwlPlanPt(e){const [bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(state.active,0));return p;}
STK_TOOLS.push({k:'rwlTool',active:()=>{if(!RWL.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){rwlToolOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const p=rwlPlanPt(e),r=wallHitRect(e);
    RWL.press={client:[e.clientX,e.clientY],p,wall:r?r.id:null,u0:r?rwlSnapU(mrkU(r,p[0],p[1])):0,shift:!!e.shiftKey,drag:false};
    try{stage.setPointerCapture(e.pointerId);}catch(_){}return true;},
  move(e){const P=RWL.press;if(!P||!(e.buttons&1))return false;const p=rwlPlanPt(e);
    if(!P.drag&&Math.hypot(e.clientX-P.client[0],e.clientY-P.client[1])>6)P.drag=true;
    if(P.drag){const r=P.wall&&mrkWallById(state.active,P.wall);P.p1=p;if(r)P.u1=rwlSnapU(mrkU(r,p[0],p[1]));draw();}return true;},
  up(e){const P=RWL.press;RWL.press=null;if(!P)return false;try{stage.releasePointerCapture(e.pointerId);}catch(_){}
    const lvl=state.active,r=P.wall&&mrkWallById(lvl,P.wall);
    if(P.drag&&!r&&P.shift&&P.p1){const ws=rwlBoxWalls(lvl,P.p[0],P.p[1],P.p1[0],P.p1[1]);let n=0;
      ws.forEach(w=>{if(!mrkList().some(m=>rwlIs(m)&&m.kind==='wall'&&m.wall===w.id)){mrkAdd({kind:'wall',level:lvl,wall:w.id,pol:'plus',tags:['vezetheto']});n++;}});
      $('hud').textContent='Vezethető fal: '+n+' fal jelölve a keretben.';draw();return true;}
    if(!r){draw();return true;}
    if(P.drag&&P.u1!=null){const m=rwlAddSpan(r,lvl,P.u0,P.u1);$('hud').textContent=m?'Vezethető szakasz: '+wfpMm(Math.abs(m.u1-m.u0))+' mm ('+r.id+')':'Legalább 100 mm-es szakaszt húzz.';draw();return true;}
    const on=rwlToggleWall(r,lvl);$('hud').textContent=(on?'Vezethető fal: ':'Levéve: ')+r.id+' ('+wfpMm(mrkWallLen(r))+' mm, mindkét oldal)';draw();return true;},
  esc(){rwlToolOff();draw();},mode(){rwlToolOff();}});

// the green band on the centreline (both faces) — persisted drawing, so the scene
function rwlBandSvg(level,u0,u1,r,col,op){const wi=wallInfo(r),a=wi.seg[0],z=dz(level,0),h=RWL_BAND/2;
  const P=wi.horiz?[[a[0]+u0,a[1]-h],[a[0]+u1,a[1]-h],[a[0]+u1,a[1]+h],[a[0]+u0,a[1]+h]]:[[a[0]-h,a[1]+u0],[a[0]+h,a[1]+u0],[a[0]+h,a[1]+u1],[a[0]-h,a[1]+u1]];
  return `<polygon class="rwl-band" points="${p2b(P.map(q=>[q[0],q[1],z]))}" fill="${col}" fill-opacity="${op}" stroke="${col}" stroke-width="${vsP(0.8)}"/>`;}
STK_SCENE.push(()=>{let s='';for(const l of ORD){if(!state.levels[l])continue;
  rwlAllowed(l).forEach(a=>{const r=mrkWallById(l,a.wall);if(r)s+=rwlBandSvg(l,a.u0,a.u1,r,RWL_COL,0.55);});}return s;});
STK_OVERLAY.push(()=>{const P=RWL.on&&RWL.press;if(!P||!P.drag)return '';const lvl=state.active,r=P.wall&&mrkWallById(lvl,P.wall);
  if(r&&P.u1!=null)return rwlBandSvg(lvl,Math.min(P.u0,P.u1),Math.max(P.u0,P.u1),r,'#e8641c',0.6);
  if(!r&&P.shift&&P.p1){const z=dz(lvl,0),R=[[P.p[0],P.p[1]],[P.p1[0],P.p[1]],[P.p1[0],P.p1[1]],[P.p[0],P.p1[1]]];
    return `<polygon points="${p2b(R.map(q=>[q[0],q[1],z]))}" fill="${RWL_COL}" fill-opacity="0.08" stroke="${RWL_COL}" stroke-width="${vsP(1.2)}" stroke-dasharray="${vsDash('5 3')}"/>`;}
  return '';});

registerActions([{id:'wf.routeWalls',label:'Vezethető fal',icon:'🟩',group:'Véset',alias:'routing walls vezetheto fal palya',
  hint:'Mely falak mentén futhat vízszintes pálya — kattintás: egész fal, húzás: szakasz.',when:c=>!c.inEditor,run:()=>rwlToolStart()}]);
(function(){const b=$('rwlBtn');if(b)b.onclick=()=>rwlToolStart();})();
