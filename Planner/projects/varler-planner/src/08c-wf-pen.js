// ==========================================================================
// 08c-wf-pen.js — workflow round (docs/workflow), WP-F1 + WP-F2: the room pen
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The Helyiség-toll draws ROOMS, not walls (the P33 lesson: draw intent first, build later).
// - Click, click, click like the Maps distance tool; 45° direction lock and 100 mm steps; the first
//   node closes the room. Press + drag on empty space = a rectangle room in one gesture (Prison
//   Architect). Digits type the exact length of the open segment.
// - The record is a plain data.floors entry with stage:'outline' (no slab, no walls yet) and
//   clear:true — the poly is the INNER outline, the sizes the user measured (Q-F01 A). Create Walls
//   (F3) puts the walls outside it; Create Floors (F4) turns the stage to 'floor'.
// - F2: an edge shared by several rooms is ONE wall line — hold it and drag sideways (Sims); every
//   room on that line follows. A pen line from one edge of a room to another edge of the SAME room,
//   drawn inside it, splits the room in two. Shared edges are derived from geometry, never stored.
// Hooks only (STK_TOOLS / STK_SCENE / STK_OVERLAY from 05m) — no edits to the pointer code.

const WFP={draft:null,cur:null,snap:null,typed:'',press:null,drag:null,hover:null,shift:false};
const WFP_DRAG_PX=6;        // a press that moves further than this is a drag, not a click
const WFP_SNAP_PX=12;       // vertex / edge snap radius on screen
const WFP_MIN=300;          // mm — no room is narrower than this
const WFP_EPS=5;            // mm — collinear / on-line tolerance for shared edges
HINTS.room='Helyiség-toll — kattints pontról pontra (45°-os irányzár, 100 mm lépés; Shift = szabad szög), az első pontra '
  +'kattintva zárul. Nyomva tartva húzz üres helyen: téglalap helyiség. Gépelj számot a pontos hosszhoz (belméret, Enter). '
  +'Közös fal: tartsd lenyomva a vonalat és húzd. Kettévágás: vonal a helyiség egyik oldalától a másikig. Backspace: vissza · Esc: elvet.';
if(state.penTick==null)state.penTick=100;
if(state.pen45==null)state.pen45=true;

function wfpOn(){return state.mode==='room'&&!(typeof WV!=='undefined'&&WV);}
function wfpTick(){return Math.max(1,+state.penTick||100);}
function wfpTol(){return Math.max(40,WFP_SNAP_PX/(state.zoom||1)/SC);}
function wfpPt(e){const z=dz(state.active,0),[bx,by]=clientToBase(e),p=baseToPlan(bx,by,z);return [p[0],p[1]];}
function wfpRooms(level){const out=[];data.floors.forEach((fl,i)=>{if(fl&&fl.level===(level||state.active)&&fl.poly&&fl.poly.length>=3&&layerShows(fl,'build'))out.push({fl,i});});return out;}
function wfpFmt(x,d){return x.toFixed(d==null?2:d).replace('.',',');}
function wfpMm(x){return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}

// ---- geometry ----------------------------------------------------------------------------------------------------------
function wfpFoot(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;if(!L2)return {q:a.slice(),t:0,d:Math.hypot(p[0]-a[0],p[1]-a[1])};
  let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));const q=[a[0]+dx*t,a[1]+dy*t];
  return {q,t,d:Math.hypot(p[0]-q[0],p[1]-q[1])};}
// 45° lock + step: axis moves round their length, diagonals round the per-axis run (nodes stay on the 100 mm grid)
function wfpLock(prev,p,tick){const dx=p[0]-prev[0],dy=p[1]-prev[1];if(!dx&&!dy)return {p:prev.slice(),dir:null};
  const k=((Math.round(Math.atan2(dy,dx)/(Math.PI/4))%8)+8)%8,ux=[1,1,0,-1,-1,-1,0,1][k],uy=[0,1,1,1,0,-1,-1,-1][k];
  let s;if(ux&&uy)s=Math.round(((Math.abs(dx)+Math.abs(dy))/2)/tick)*tick;else s=Math.round(Math.abs(ux?dx:dy)/tick)*tick;
  return {p:[prev[0]+ux*s,prev[1]+uy*s],dir:[ux,uy]};}
function wfpGrid(p,tick){return [Math.round(p[0]/tick)*tick,Math.round(p[1]/tick)*tick];}
// the snapped pen point: existing vertex → existing edge → 45° lock / grid
function wfpSnapPt(raw,shift){const tol=wfpTol(),rooms=wfpRooms();let best=null,bd=tol;
  rooms.forEach(r=>r.fl.poly.forEach((v,k)=>{const d=Math.hypot(raw[0]-v[0],raw[1]-v[1]);if(d<bd){bd=d;best={p:[v[0],v[1]],kind:'vertex',room:r.i,k};}}));
  if(best)return best;bd=tol;
  rooms.forEach(r=>{const P=r.fl.poly;P.forEach((a,k)=>{const b=P[(k+1)%P.length],f=wfpFoot(raw,a,b);if(f.d<bd){bd=f.d;best={p:[Math.round(f.q[0]),Math.round(f.q[1])],kind:'edge',room:r.i,k,t:f.t};}});});
  if(best)return best;
  const D=WFP.draft,tick=wfpTick();
  if(D&&D.length&&state.pen45&&!shift){const L=wfpLock(D[D.length-1],raw,tick);return {p:L.p,kind:'lock',dir:L.dir};}
  return {p:shift?[Math.round(raw[0]),Math.round(raw[1])]:wfpGrid(raw,tick),kind:'grid'};}
function wfpSegX(a,b,c,d){const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const d1=o(c,d,a),d2=o(c,d,b),d3=o(a,b,c),d4=o(a,b,d);return ((d1>1e-6&&d2<-1e-6)||(d1<-1e-6&&d2>1e-6))&&((d3>1e-6&&d4<-1e-6)||(d3<-1e-6&&d4>1e-6));}
function wfpSelfX(P){const n=P.length;for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;
  if(wfpSegX(P[i],P[(i+1)%n],P[j],P[(j+1)%n]))return true;}return false;}
function wfpCentroid(P){let a=0,cx=0,cy=0;for(let i=0,j=P.length-1;i<P.length;j=i++){const f=P[j][0]*P[i][1]-P[i][0]*P[j][1];a+=f;cx+=(P[j][0]+P[i][0])*f;cy+=(P[j][1]+P[i][1])*f;}
  if(Math.abs(a)<1e-6){let x=0,y=0;P.forEach(p=>{x+=p[0];y+=p[1];});return [x/P.length,y/P.length];}return [cx/(3*a),cy/(3*a)];}
function wfpClean(P){const out=[];P.forEach(p=>{const q=out[out.length-1];if(!q||Math.hypot(q[0]-p[0],q[1]-p[1])>0.5)out.push([p[0],p[1]]);});
  while(out.length>2&&Math.hypot(out[0][0]-out[out.length-1][0],out[0][1]-out[out.length-1][1])<=0.5)out.pop();
  // drop collinear middle points (a node placed mid-edge leaves one behind when nothing else uses it)
  for(let i=0;out.length>3&&i<out.length;){const a=out[(i+out.length-1)%out.length],b=out[i],c=out[(i+1)%out.length];
    if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-3*Math.hypot(c[0]-a[0],c[1]-a[1]))out.splice(i,1);else i++;}
  return out;}
function wfpMinEdge(P){let m=Infinity;P.forEach((a,k)=>{const b=P[(k+1)%P.length];m=Math.min(m,Math.hypot(b[0]-a[0],b[1]-a[1]));});return m;}

// ---- room creation -----------------------------------------------------------------------------------------------------
function wfpMakeRoom(poly,level){const P=wfpClean(poly);
  if(P.length<3||polyAreaMM(P)<1e5){$('hud').textContent='Túl kicsi terület — nem jött létre helyiség.';return -1;}
  if(wfpSelfX(P)){$('hud').textContent='A körvonal önmagát metszi — nem jött létre helyiség.';return -1;}
  pushUndo(UNDO_SCOPE.floor);
  data.floors.push({level:level||state.active,poly:P,name:'',stage:'outline',clear:true,mat:'hidegburkolat',layer:curLayer()});
  ensureIds(data);const ix=data.floors.length-1;
  $('hud').textContent='Helyiség kész: Kerület '+wfpFmt(polyPerimMM(P,true)/1000)+' m · Terület '+wfpFmt(polyAreaMM(P)/1e6)+' m². Típus: kattints rá (R1), falak: Falak létrehozása.';
  return ix;}
function wfpRectRoom(a,b){const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
  if(x1-x0<WFP_MIN||y1-y0<WFP_MIN)return -1;
  return wfpMakeRoom([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);}
function wfpClose(){const D=WFP.draft;if(!D||D.length<3){$('hud').textContent='Legalább 3 pont kell a helyiséghez.';return false;}
  const ix=wfpMakeRoom(D);WFP.draft=null;WFP.typed='';draw();return ix>=0;}

// ---- F2: split a room with a pen line -----------------------------------------------------------------------------------
// boundary position s = edge index + t; the vertices strictly between two positions, walking forward
function wfpBetween(x,y,n){const out=[];let yy=y;if(yy<=x)yy+=n;for(let v=Math.floor(x)+1;v<yy-1e-9;v++)out.push(v%n);return out;}
function wfpBoundaryPos(fl,p){const P=fl.poly;let best=null;P.forEach((a,k)=>{const f=wfpFoot(p,a,P[(k+1)%P.length]);if(f.d<=WFP_EPS&&(!best||f.d<best.d))best={s:k+(f.t>=1-1e-9?1:f.t),d:f.d};});
  return best?best.s%P.length:null;}
function wfpInside(fl,p){return pointInPoly(p[0],p[1],fl.poly);}
// cut = [a, …interior, b] with a and b on the room's boundary → the two polygons, or null
function wfpSplitPolys(fl,cut){const P=fl.poly,n=P.length,a=cut[0],b=cut[cut.length-1];
  const sa=wfpBoundaryPos(fl,a),sb=wfpBoundaryPos(fl,b);if(sa==null||sb==null)return null;
  if(Math.floor(sa)===Math.floor(sb)&&Math.abs(sa-sb)<1)return null;            // both ends on one edge: not a split
  for(let i=0;i+1<cut.length;i++){const m=[(cut[i][0]+cut[i+1][0])/2,(cut[i][1]+cut[i+1][1])/2];if(!wfpInside(fl,m))return null;}
  const mid=cut.slice(1,-1),V=k=>P[k];
  const p1=wfpClean([a,...mid,b,...wfpBetween(sb,sa,n).map(V)]),p2=wfpClean([b,...mid.slice().reverse(),a,...wfpBetween(sa,sb,n).map(V)]);
  if(p1.length<3||p2.length<3||polyAreaMM(p1)<1e5||polyAreaMM(p2)<1e5)return null;
  return [p1,p2];}
function wfpSplit(i,cut){const fl=data.floors[i];const r=wfpSplitPolys(fl,cut);if(!r)return false;
  const [A,B]=polyAreaMM(r[0])>=polyAreaMM(r[1])?r:[r[1],r[0]];
  pushUndo(UNDO_SCOPE.floor);
  fl.poly=A;
  const nf={level:fl.level,poly:B,name:'',stage:fl.stage||'outline',mat:fl.mat||'hidegburkolat',layer:fl.layer};if(fl.clear)nf.clear=true;
  data.floors.push(nf);ensureIds(data);
  $('hud').textContent='Helyiség kettévágva: '+wfpFmt(polyAreaMM(A)/1e6)+' + '+wfpFmt(polyAreaMM(B)/1e6)+' m²';
  WFP.draft=null;WFP.typed='';draw();return true;}

// ---- F2: shared edges and the Sims drag ---------------------------------------------------------------------------------
function wfpEdges(level){const out=[];wfpRooms(level).forEach(r=>{const P=r.fl.poly;P.forEach((a,k)=>out.push({room:r.i,k,a,b:P[(k+1)%P.length]}));});return out;}
function wfpCollinear(e,f){const dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],L=Math.hypot(dx,dy);if(!L)return false;
  const off=q=>Math.abs((q[0]-e.a[0])*dy-(q[1]-e.a[1])*dx)/L;return off(f.a)<=WFP_EPS&&off(f.b)<=WFP_EPS;}
function wfpProj(e,q){const dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],L=Math.hypot(dx,dy);return ((q[0]-e.a[0])*dx+(q[1]-e.a[1])*dy)/L;}
// the edges that are one wall line with `e`: collinear and overlapping by ≥ 100 mm, chained
function wfpShared(e,level){const all=wfpEdges(level),grp=[e];const seen=new Set([e.room+':'+e.k]);let grew=true;
  while(grew){grew=false;all.forEach(f=>{if(seen.has(f.room+':'+f.k)||!wfpCollinear(e,f))return;
    const fr=[wfpProj(e,f.a),wfpProj(e,f.b)].sort((x,y)=>x-y);
    if(grp.some(g=>{const gr=[wfpProj(e,g.a),wfpProj(e,g.b)].sort((x,y)=>x-y);return Math.min(gr[1],fr[1])-Math.max(gr[0],fr[0])>=100;})){grp.push(f);seen.add(f.room+':'+f.k);grew=true;}});}
  return grp;}
function wfpSharedAll(level){const all=wfpEdges(level),done=new Set(),out=[];
  all.forEach(e=>{if(done.has(e.room+':'+e.k))return;const g=wfpShared(e,level);g.forEach(f=>done.add(f.room+':'+f.k));if(g.length>1)out.push(g);});return out;}
function wfpEdgeAt(p){const tol=wfpTol();let best=null,bd=tol;
  wfpEdges().forEach(e=>{const f=wfpFoot(p,e.a,e.b);if(f.d<bd&&f.t>0.05&&f.t<0.95){bd=f.d;best=e;}});return best;}
// start a drag: every vertex on the group's line span moves with it (T-junction nodes of other rooms too)
function wfpDragStart(e){const grp=wfpShared(e),dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],L=Math.hypot(dx,dy);
  let lo=Infinity,hi=-Infinity;grp.forEach(g=>[g.a,g.b].forEach(q=>{const s=wfpProj(e,q);lo=Math.min(lo,s);hi=Math.max(hi,s);}));
  const verts=[];wfpRooms().forEach(r=>r.fl.poly.forEach((q,k)=>{const off=Math.abs((q[0]-e.a[0])*dy-(q[1]-e.a[1])*dx)/L,s=wfpProj(e,q);
    if(off<=WFP_EPS&&s>=lo-WFP_EPS&&s<=hi+WFP_EPS)verts.push({room:r.i,k,o:[q[0],q[1]]});}));
  const rooms=[...new Set(verts.map(v=>v.room))];
  const orig=rooms.map(i=>data.floors[i].poly.map(q=>[q[0],q[1]]));
  return {grp,n:[-dy/L,dx/L],verts,rooms,orig,minE:orig.map(P=>Math.min(WFP_MIN,wfpMinEdge(wfpClean(P)))),delta:0,pushed:false};}
function wfpDragValid(G){return G.rooms.every((i,j)=>{const P=data.floors[i].poly;return polyAreaMM(P)>=1e5&&!wfpSelfX(P)&&wfpMinEdge(wfpClean(P))>=G.minE[j]-0.5;});}
function wfpDragApply(G,delta){const tick=wfpTick();delta=Math.round(delta/tick)*tick;
  const set=d=>{G.rooms.forEach((i,j)=>{data.floors[i].poly=G.orig[j].map(q=>[q[0],q[1]]);});
    G.verts.forEach(v=>{data.floors[v.room].poly[v.k]=[v.o[0]+G.n[0]*d,v.o[1]+G.n[1]*d];});};
  // clamp: walk back toward 0 until every room on the line is still a valid room ≥ 300 mm (step = the pen tick)
  let d=delta,clamped=false;set(d);while(d!==0&&!wfpDragValid(G)){d-=Math.sign(d)*tick;clamped=true;set(d);}
  G.delta=d;return {d,clamped};}

// ---- the tool -----------------------------------------------------------------------------------------------------------
function wfpHud(){const D=WFP.draft;if(WFP.typed)return 'Hossz: '+WFP.typed+' mm — Enter: alkalmaz, Backspace: javít';
  if(!D||!D.length)return 'Helyiség-toll: kattints az első pontra, vagy nyomva tartva húzz egy téglalapot.';
  const pts=D.concat(WFP.cur?[WFP.cur.p]:[]),A=pts.length>=3?polyAreaMM(pts)/1e6:0,P=polyPerimMM(pts,pts.length>=3)/1000;
  return 'Helyiség: '+D.length+' pont · kerület '+wfpFmt(P)+' m'+(A?' · terület '+wfpFmt(A)+' m²':'')+' — az első pontra kattintva zárul (Enter is)';}
function wfpAddNode(sn){const D=WFP.draft;
  if(D&&D.length>=3&&Math.hypot(sn.p[0]-D[0][0],sn.p[1]-D[0][1])<=wfpTol()){wfpClose();return;}
  // F2 split: the line started on a room's boundary and lands on the boundary of the SAME room, drawn inside it
  if(D&&D.length&&(sn.kind==='edge'||sn.kind==='vertex')){const cut=D.concat([sn.p]);
    for(const r of wfpRooms()){if(wfpBoundaryPos(r.fl,cut[0])==null||wfpBoundaryPos(r.fl,sn.p)==null)continue;
      if(wfpSplitPolys(r.fl,cut)){wfpSplit(r.i,cut);return;}}}
  if(!WFP.draft)WFP.draft=[];const last=WFP.draft[WFP.draft.length-1];
  if(!last||Math.hypot(sn.p[0]-last[0],sn.p[1]-last[1])>=20)WFP.draft.push(sn.p);
  $('hud').textContent=wfpHud();draw();}
function wfpTypedApply(){const D=WFP.draft,L=+WFP.typed;WFP.typed='';if(!D||!D.length||!(L>0)){draw();return;}
  const last=D[D.length-1],dir=(WFP.cur&&WFP.cur.dir)||[1,0],diag=dir[0]&&dir[1],s=diag?L/Math.SQRT2:L;
  wfpAddNode({p:[Math.round(last[0]+dir[0]*s),Math.round(last[1]+dir[1]*s)],kind:'typed'});}
function wfpOff(){WFP.draft=null;WFP.typed='';WFP.press=null;WFP.drag=null;WFP.hover=null;WFP.cur=null;}

STK_TOOLS.push({k:'wfPen',active:wfpOn,
  down:e=>{if(e.button!==0)return false;const raw=wfpPt(e);WFP.shift=!!e.shiftKey;
    WFP.press={client:[e.clientX,e.clientY],raw,edge:(!WFP.draft||!WFP.draft.length)?wfpEdgeAt(raw):null,mode:null};
    try{stage.setPointerCapture(e.pointerId);}catch(_){}return true;},
  move:e=>{const raw=wfpPt(e);WFP.shift=!!e.shiftKey;const Pr=WFP.press;
    if(Pr&&(e.buttons&1)){
      if(!Pr.mode&&Math.hypot(e.clientX-Pr.client[0],e.clientY-Pr.client[1])>WFP_DRAG_PX)
        Pr.mode=Pr.edge?'edge':((!WFP.draft||!WFP.draft.length)?'rect':'none');
      if(Pr.mode==='edge'){if(!WFP.drag)WFP.drag=wfpDragStart(Pr.edge);const G=WFP.drag;
        const d0=(raw[0]-Pr.raw[0])*G.n[0]+(raw[1]-Pr.raw[1])*G.n[1];
        if(!G.pushed&&Math.abs(d0)>=wfpTick()/2){G.rooms.forEach((i,j)=>{data.floors[i].poly=G.orig[j];});pushUndo(UNDO_SCOPE.floor);G.pushed=true;}
        if(G.pushed){const r=wfpDragApply(G,d0);$('hud').textContent='Közös fal: '+wfpMm(Math.abs(r.d))+' mm'+(r.clamped?' — a helyiség nem lehet keskenyebb 300 mm-nél.':'');}
        draw();return true;}
      if(Pr.mode==='rect'){Pr.b=wfpGrid(raw,wfpTick());draw();return true;}}
    const sn=wfpSnapPt(raw,WFP.shift);WFP.cur=sn;
    WFP.hover=(!WFP.draft||!WFP.draft.length)&&sn.kind!=='vertex'?wfpEdgeAt(raw):null;
    if(WFP.draft&&WFP.draft.length)$('hud').textContent=wfpHud();
    draw();return false;},     // false: the camera keeps the right / both buttons
  up:e=>{const Pr=WFP.press;if(!Pr)return false;WFP.press=null;try{stage.releasePointerCapture(e.pointerId);}catch(_){}
    if(Pr.mode==='edge'){const G=WFP.drag;WFP.drag=null;
      if(G&&G.pushed){$('hud').textContent='Közös fal áthelyezve: '+wfpMm(Math.abs(G.delta))+' mm · '+G.rooms.length+' helyiség'
        +(G.rooms.some(i=>WALLS[data.floors[i].level]&&WALLS[data.floors[i].level].some(w=>w.gen==='wfw'))?' — a falak frissítése: Falak létrehozása újra.':'');}
      draw();return true;}
    if(Pr.mode==='rect'){const b=Pr.b||wfpGrid(wfpPt(e),wfpTick()),a=wfpGrid(Pr.raw,wfpTick());
      if(wfpRectRoom(a,b)<0&&!/Túl kicsi|metszi/.test($('hud').textContent))$('hud').textContent='Legalább 300 × 300 mm-es téglalapot húzz.';
      draw();return true;}
    const sn=wfpSnapPt(wfpPt(e),!!e.shiftKey);
    // R1: a plain click inside a room (no line open, not on its edge or corner) opens the room-type wheel
    if((!WFP.draft||!WFP.draft.length)&&sn.kind!=='vertex'&&sn.kind!=='edge'&&typeof rwRoomAt==='function'){const r=rwRoomAt(wfpPt(e));if(r){rwOpenRoom(r,e.clientX,e.clientY);return true;}}
    wfpAddNode(sn);return true;},
  key:e=>{if(!wfpOn())return false;const D=WFP.draft;
    if(/^[0-9]$/.test(e.key)&&D&&D.length&&!e.ctrlKey&&!e.altKey){WFP.typed=(WFP.typed+e.key).slice(0,6);$('hud').textContent=wfpHud();e.preventDefault();draw();return true;}
    if(e.key==='Backspace'){if(WFP.typed){WFP.typed=WFP.typed.slice(0,-1);}else if(D&&D.length){D.pop();if(!D.length)WFP.draft=null;}else return false;
      $('hud').textContent=wfpHud();e.preventDefault();draw();return true;}
    if(e.key==='Enter'){if(WFP.typed)wfpTypedApply();else if(D)wfpClose();else return false;e.preventDefault();return true;}
    return false;},
  esc:()=>{wfpOff();},
  mode:()=>{wfpOff();}});

// ---- drawing ------------------------------------------------------------------------------------------------------------
function wfpLabel(x,y,txt,sz,col,w){return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${vsP(sz)}" text-anchor="middle" fill="${col||'#2c2c2c'}" font-weight="${w||700}" paint-order="stroke" stroke="#fff" stroke-width="${vsP(3)}">${txt}</text>`;}
// SCENE: outline-stage rooms — dashed outline, Kerület / Terület at the centre (the "walls without foundation" look)
function wfpCleanStyle(){return (typeof tisztaOn==='function'&&tisztaOn())||(typeof alaprajzOn==='function'&&alaprajzOn());}
function wfpOutlineSvg(){let s='';
  for(const l of ORD){if(!state.levels[l])continue;const z=dz(l,0);
    data.floors.forEach((fl,i)=>{if(fl.level!==l||fl.stage!=='outline'||!fl.poly||fl.poly.length<3||!layerShows(fl,'build'))return;
      if(state.soloRoom&&!soloRoomIs({src:'F',i,level:l}))return;
      s+=`<polygon class="wfp-outline" points="${p2b(fl.poly.map(p=>[p[0],p[1],z]))}" fill="#5a6270" fill-opacity="0.04" stroke="#5a6270" stroke-width="${vsP(1.2)}" stroke-dasharray="${vsDash('7 4')}"/>`;
      if(l!==state.active)return;
      const c=wfpCentroid(fl.poly),b=planToBase(c[0],c[1],z);
      if(fl.name)s+=wfpLabel(b[0],b[1]-vsP(14),esc(fl.name),11.5);
      s+=wfpLabel(b[0],b[1]-vsP(1),'Terület '+wfpFmt(polyAreaMM(fl.poly)/1e6)+' m²',10.5)
        +wfpLabel(b[0],b[1]+vsP(12),'Kerület '+wfpFmt(polyPerimMM(fl.poly,true)/1000)+' m',9.5,'#5a6270',600);});}
  return s;}
// the clean styles (Tiszta, Alaprajz) skip STK_SCENE for print — an unbuilt room is an editing aid there, so it goes on the overlay
STK_SCENE.push(()=>wfpCleanStyle()?'':wfpOutlineSvg());
// OVERLAY: the open draft, the rectangle, the hovered / dragged shared line, the snap marker
STK_OVERLAY.push(()=>wfpCleanStyle()?wfpOutlineSvg():'');
STK_OVERLAY.push(()=>{if(!wfpOn())return '';const z=dz(state.active,0),B=(x,y)=>planToBase(x,y,z);let s='';
  const line=(pts,col,w,dash)=>`<polyline points="${p2b(pts.map(p=>[p[0],p[1],z]))}" fill="none" stroke="${col}" stroke-width="${vsP(w)}"${dash?` stroke-dasharray="${vsDash(dash)}"`:''}/>`;
  const segLbl=(a,b2)=>{const m=B((a[0]+b2[0])/2,(a[1]+b2[1])/2);return wfpLabel(m[0],m[1]-vsP(7),wfpMm(Math.hypot(b2[0]-a[0],b2[1]-a[1]))+' mm',10.5);};
  const Pr=WFP.press;
  if(Pr&&Pr.mode==='rect'&&Pr.b){const a=wfpGrid(Pr.raw,wfpTick()),b=Pr.b,R=[[a[0],a[1]],[b[0],a[1]],[b[0],b[1]],[a[0],b[1]]];
    const ok=Math.abs(b[0]-a[0])>=WFP_MIN&&Math.abs(b[1]-a[1])>=WFP_MIN;
    s+=`<polygon points="${p2b(R.map(p=>[p[0],p[1],z]))}" fill="${ok?'#e2ddd0':'#d08a1e'}" fill-opacity="0.35" stroke="#2c2c2c" stroke-width="${vsP(1.4)}" stroke-dasharray="${vsDash('6 4')}"/>`
      +segLbl(R[0],R[1])+segLbl(R[1],R[2]);
    if(ok){const c=B((a[0]+b[0])/2,(a[1]+b[1])/2);s+=wfpLabel(c[0],c[1],'Terület '+wfpFmt(Math.abs((b[0]-a[0])*(b[1]-a[1]))/1e6)+' m²',11);}}
  const G=WFP.drag,hv=G?G.grp:(WFP.hover?wfpShared(WFP.hover):null);
  if(hv)hv.forEach(e=>{const P=data.floors[e.room].poly,a=P[e.k],b=P[(e.k+1)%P.length];s+=line([a,b],'#e8641c',G?3.2:2.4);});
  const D=WFP.draft,cur=WFP.cur;
  if(D&&D.length){const pts=cur?D.concat([cur.p]):D;
    if(pts.length>=3)s+=`<polygon points="${p2b(pts.map(p=>[p[0],p[1],z]))}" fill="#e2ddd0" fill-opacity="0.3" stroke="none"/>`;
    s+=line(D,'#2c2c2c',1.6);
    if(cur){s+=line([D[D.length-1],cur.p],'#2c2c2c',1.4,'6 4');if(D.length>=2)s+=line([cur.p,D[0]],'#8a857b',1,'3 5');s+=segLbl(D[D.length-1],cur.p);}
    const closing=cur&&D.length>=3&&Math.hypot(cur.p[0]-D[0][0],cur.p[1]-D[0][1])<=wfpTol();
    D.forEach((p,i)=>{const b=B(p[0],p[1]),f=i===0;s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(f?(closing?6:4.5):3)}" fill="${f&&closing?'#e8641c':'#fff'}" stroke="#2c2c2c" stroke-width="${vsP(1.4)}"/>`;});
    if(WFP.typed){const l=D[D.length-1],b=B(l[0],l[1]);s+=wfpLabel(b[0],b[1]+vsP(18),WFP.typed+' mm ⏎',11,'#e8641c');}}
  if(cur&&!Pr){const b=B(cur.p[0],cur.p[1]),r=vsP(4);
    if(cur.kind==='vertex')s+=`<rect x="${(b[0]-r).toFixed(1)}" y="${(b[1]-r).toFixed(1)}" width="${(2*r).toFixed(1)}" height="${(2*r).toFixed(1)}" fill="none" stroke="#e8641c" stroke-width="${vsP(1.6)}"/>`;
    else if(cur.kind==='edge')s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${r}" fill="#e8641c" fill-opacity="0.6" stroke="#e8641c" stroke-width="${vsP(1.2)}"/>`;
    else s+=`<path d="M${(b[0]-r).toFixed(1)} ${b[1].toFixed(1)}h${(2*r).toFixed(1)}M${b[0].toFixed(1)} ${(b[1]-r).toFixed(1)}v${(2*r).toFixed(1)}" stroke="#2c2c2c" stroke-width="${vsP(1.2)}"/>`;}
  return s;});

registerActions([_mode('room','Helyiség-toll','⬚',null,'Helyiségek pontról pontra (45°, 100 mm) vagy téglalappal; közös fal húzása, kettévágás.')]);
