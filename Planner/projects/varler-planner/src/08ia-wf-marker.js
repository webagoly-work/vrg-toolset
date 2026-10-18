// ==========================================================================
// 08ia-wf-marker.js — workflow round (docs/workflow), WP-R5: the marker pen (Jelölő toll) on a wall-line network
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The user (2026-10-15): "instead of a section-selecting click, a tool like the Helyiség-toll, but a marker: on a wall,
// hold and drag to draw lines of different types … walls do not touch with their middle lines, so the selector always
// takes the whole long wall through rooms, where it should mark one wall of one room at a time. Connecting walls should
// have their middle lines in contact and their side lines touching or crossing: a continuous path between every wall.
// Snap only a little, but lock on a continuous path."  Answers R5-Q1…Q5 = A.
//
// THE NETWORK (wln) is derived from WALLS, never stored (R5-Q1 = A): nothing about the walls changes, and every mark the
// pen makes is an ordinary mark keyed by wall id + u, so all later layers read it as before.
//   centre edges  each wall box's centreline, EXTENDED to the centreline of every wall it touches and SPLIT there — the
//                 centrelines now meet at the junctions (T, L, X); a jog joins two collinear walls of different width
//   face edges    the outline of the union of the wall boxes, cut wherever another box touches it: the faces meet at
//                 the corners, and each piece knows its room — one face piece = one wall of one room
// THE PEN (mkp) takes the ink from the Szabályok palette: whole-wall inks (Vezethető fal, Külső fal, Kémény, Gépészet)
// draw on the centre net, face inks (L-forma, Kerülendő, Tilos, Vizes, Média, Munkalap, Fűtőtest, Bútor, Gáz) on the
// face net (R5-Q3 = A). Press + drag walks the net from the press to the point nearest the cursor, turning corners and
// crossing junctions (Q4 = A); a cursor that leaves the net keeps the last path (the lock). A click without a drag marks
// one unit — one room's face between two junctions, or one centre edge (Q2 = A); a click on a unit that already has the
// ink takes it off. Alt + drag erases. Shift + drag on empty floor (centre inks): every wall in the box. Old marks stay
// as they are (Q5 = A).

const WLN_EPS=5,WLN_SNAP_PX=8,WLN_LOCK=3,WLN_MIN=50;
const WLN_CACHE={};
function wlnSig(level){const ws=WALLS[level]||[];let s=String(ws.length);
  ws.forEach(r=>{s+='|'+r.x0+','+r.y0+','+r.x1+','+r.y1+','+(r.id||'');});
  allRooms(level).forEach(e=>{s+='#'+((e.rm&&e.rm.id)||'')+':'+JSON.stringify((e.rm&&e.rm.poly)||[]);});return s;}
function wlnNet(level){level=level||state.active;const sig=wlnSig(level),c=WLN_CACHE[level];if(c&&c.sig===sig)return c.net;
  const ws=(WALLS[level]||[]).filter(r=>r&&r.id&&r.x1>r.x0&&r.y1>r.y0);
  const net={c:wlnCentre(ws),f:wlnFaces(ws,level)};WLN_CACHE[level]={sig,net};return net;}
function wlnAxis(r){const wi=wallInfo(r);return {horiz:wi.horiz,c:wi.horiz?(r.y0+r.y1)/2:(r.x0+r.x1)/2,a0:wi.horiz?r.x0:r.y0,a1:wi.horiz?r.x1:r.y1,h:wi.thick/2};}
function wlnTouch(A,B,e){return A.x0<=B.x1+e&&B.x0<=A.x1+e&&A.y0<=B.y1+e&&B.y0<=A.y1+e;}
function wlnPt(ax,t){return ax.horiz?[t,ax.c]:[ax.c,t];}
function wlnCentre(ws){const E=[];
  ws.forEach(A=>{const a=wlnAxis(A),T=[a.a0,a.a1];
    ws.forEach(B=>{if(B===A||!wlnTouch(A,B,WLN_EPS))return;const b=wlnAxis(B);
      if(a.horiz!==b.horiz){   // perpendicular: a node where B's centreline crosses A's (B may stop at A's face: reach by A's half)
        if(a.c>=b.a0-a.h-WLN_EPS&&a.c<=b.a1+a.h+WLN_EPS&&b.c>=a.a0-b.h-WLN_EPS&&b.c<=a.a1+b.h+WLN_EPS)T.push(b.c);}
      else if(Math.abs(a.a1-b.a0)<=WLN_EPS&&Math.abs(a.c-b.c)>0.5&&Math.abs(a.c-b.c)<=Math.max(a.h,b.h)+WLN_EPS)   // collinear, offset: a jog
        E.push({k:'c',a:wlnPt(a,a.a1),b:wlnPt(b,b.a0),wall:null,side:0});});
    const S=[...new Set(T.map(v=>Math.round(v)))].sort((x,y)=>x-y);
    for(let i=0;i+1<S.length;i++)if(S[i+1]-S[i]>0.5)E.push({k:'c',a:wlnPt(a,S[i]),b:wlnPt(a,S[i+1]),wall:A.id,side:0});});
  E.forEach(e=>{e.len=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]);});return E.filter(e=>e.len>0.5);}
function wlnFaces(ws,level){const E=[];
  const covered=(A,p)=>ws.some(B=>B!==A&&p[0]>=B.x0&&p[0]<=B.x1&&p[1]>=B.y0&&p[1]<=B.y1);
  ws.forEach(A=>{const ax=wlnAxis(A),wi=wallInfo(A);
    [{h:true,v:A.y0,n:[0,-1]},{h:true,v:A.y1,n:[0,1]},{h:false,v:A.x0,n:[-1,0]},{h:false,v:A.x1,n:[1,0]}].forEach(sd=>{
      const lo=sd.h?A.x0:A.y0,hi=sd.h?A.x1:A.y1,br=[lo,hi];
      ws.forEach(B=>{if(B===A)return;const on=sd.h?(B.y0<=sd.v+WLN_EPS&&B.y1>=sd.v-WLN_EPS):(B.x0<=sd.v+WLN_EPS&&B.x1>=sd.v-WLN_EPS);if(!on)return;
        (sd.h?[B.x0,B.x1]:[B.y0,B.y1]).forEach(t=>{if(t>lo+0.5&&t<hi-0.5)br.push(t);});});
      const S=[...new Set(br)].sort((x,y)=>x-y);
      const along=sd.h===ax.horiz,side=along?((wi.perp[0]*sd.n[0]+wi.perp[1]*sd.n[1])>0?1:-1):0;
      for(let i=0;i+1<S.length;i++){if(S[i+1]-S[i]<0.5)continue;const m=(S[i]+S[i+1])/2,p=sd.h?[m,sd.v]:[sd.v,m];
        if(covered(A,[p[0]+sd.n[0],p[1]+sd.n[1]]))continue;                      // a neighbour lies against this piece
        const q=[p[0]+sd.n[0]*ROOM_PROBE,p[1]+sd.n[1]*ROOM_PROBE],rm=mrkRoomAtPt(level,q[0],q[1]);
        const a=sd.h?[S[i],sd.v]:[sd.v,S[i]],b=sd.h?[S[i+1],sd.v]:[sd.v,S[i+1]];
        E.push({k:'f',a,b,wall:A.id,side,room:rm&&rm.rm?(rm.rm.id||('i'+rm.i)):null,len:S[i+1]-S[i]});}});});
  return E;}

// ---- nearest point, route, unit ----
function wlnProj(e,p){const dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],L2=dx*dx+dy*dy||1;let t=((p[0]-e.a[0])*dx+(p[1]-e.a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));
  const q=[e.a[0]+dx*t,e.a[1]+dy*t];return {t,pt:q,d:Math.hypot(p[0]-q[0],p[1]-q[1])};}
function wlnNearest(level,kind,p,tol){const E=wlnNet(level)[kind];let best=null;
  E.forEach(e=>{const r=wlnProj(e,p);if(r.d<=tol&&(!best||r.d<best.d))best={e,t:r.t,pt:r.pt,d:r.d};});return best;}
const wlnKey=p=>Math.round(p[0])+','+Math.round(p[1]);
// the shortest walk along the net between two snapped points → [{e, pa, pb}] in walking order
function wlnRoute(level,kind,s0,s1){if(!s0||!s1)return [];
  if(s0.e===s1.e)return [{e:s0.e,pa:s0.pt,pb:s1.pt}];
  const E=wlnNet(level)[kind],adj={};const add=(k,to,w,e,from,toPt)=>{(adj[k]=adj[k]||[]).push({to,w,e,from,toPt});};
  E.forEach(e=>{if(e===s0.e||e===s1.e)return;const ka=wlnKey(e.a),kb=wlnKey(e.b);add(ka,kb,e.len,e,e.a,e.b);add(kb,ka,e.len,e,e.b,e.a);});
  // the two partial edges: S → both ends of s0's edge, both ends of s1's edge → T
  [[s0.e.a,s0.t*s0.e.len],[s0.e.b,(1-s0.t)*s0.e.len]].forEach(([q,w])=>add('S',wlnKey(q),w,s0.e,s0.pt,q));
  [[s1.e.a,s1.t*s1.e.len],[s1.e.b,(1-s1.t)*s1.e.len]].forEach(([q,w])=>add(wlnKey(q),'T',w,s1.e,q,s1.pt));
  const dist={S:0},prev={},done={};
  for(;;){let u=null;Object.keys(dist).forEach(k=>{if(!done[k]&&(u===null||dist[k]<dist[u]))u=k;});if(u===null||u==='T')break;done[u]=true;
    (adj[u]||[]).forEach(n=>{const d=dist[u]+n.w;if(dist[n.to]===undefined||d<dist[n.to]){dist[n.to]=d;prev[n.to]={k:u,n};}});}
  if(dist.T===undefined)return [{e:s0.e,pa:s0.pt,pb:s0.pt}];
  const out=[];let k='T';while(k!=='S'){const p=prev[k];out.unshift({e:p.n.e,pa:p.n.from,pb:p.n.toPt});k=p.k;}return out;}
// a click: one centre edge, or one room's face between two junctions (the contiguous face pieces of that wall, side, room)
function wlnUnit(level,kind,s){if(!s)return [];if(kind==='c'||!s.e.wall)return [{e:s.e,pa:s.e.a,pb:s.e.b}];
  const r=mrkWallById(level,s.e.wall);if(!r)return [];
  const same=wlnNet(level).f.filter(e=>e.wall===s.e.wall&&e.side===s.e.side&&e.room===s.e.room&&e.side!==0)
    .map(e=>({e,u0:Math.min(mrkU(r,e.a[0],e.a[1]),mrkU(r,e.b[0],e.b[1])),u1:Math.max(mrkU(r,e.a[0],e.a[1]),mrkU(r,e.b[0],e.b[1]))})).sort((x,y)=>x.u0-y.u0);
  const i=same.findIndex(x=>x.e===s.e);if(i<0)return [{e:s.e,pa:s.e.a,pb:s.e.b}];let lo=i,hi=i;
  while(lo>0&&same[lo-1].u1>=same[lo].u0-1)lo--;while(hi+1<same.length&&same[hi+1].u0<=same[hi].u1+1)hi++;
  return same.slice(lo,hi+1).map(x=>({e:x.e,pa:x.e.a,pb:x.e.b}));}
// pieces → per wall (and face) u ranges, merged: [{wall, side, u0, u1}]. End caps and jogs carry no wall range.
function wlnRanges(level,pieces){const by={};
  pieces.forEach(p=>{if(!p.e.wall||(p.e.k==='f'&&!p.e.side))return;const r=mrkWallById(level,p.e.wall);if(!r)return;
    const a=mrkU(r,p.pa[0],p.pa[1]),b=mrkU(r,p.pb[0],p.pb[1]);const key=p.e.wall+'|'+(p.e.k==='f'?p.e.side:0);
    (by[key]=by[key]||{wall:p.e.wall,side:p.e.k==='f'?p.e.side:0,iv:[]}).iv.push([Math.min(a,b),Math.max(a,b)]);});
  const out=[];Object.values(by).forEach(g=>{g.iv.sort((x,y)=>x[0]-y[0]);let cur=null;
    g.iv.forEach(v=>{if(cur&&v[0]<=cur[1]+1)cur[1]=Math.max(cur[1],v[1]);else{if(cur)out.push({wall:g.wall,side:g.side,u0:cur[0],u1:cur[1]});cur=v.slice();}});
    if(cur)out.push({wall:g.wall,side:g.side,u0:cur[0],u1:cur[1]});});
  return out;}

// ---- inks and marks ----
const MKP={on:false,ink:null,press:null,hover:null};
function mkpInk(k){if(k==='mozi'&&typeof CIN_INK!=='undefined')return CIN_INK;   // 08r: the Mozi fal ink (per face)
  const p=typeof rbPreset==='function'?rbPreset(k):null;if(!p)return null;
  if(p.kind==='route')return {k,n:p.n,net:'c',tag:'vezetheto',pol:'plus',col:rbCol(p)};
  if(p.kind==='wall')return {k,n:p.n,net:'c',tag:p.tag,pol:p.pol,col:rbCol(p)};
  if(p.kind==='side')return {k,n:p.n,net:'f',tag:p.tag,pol:p.pol,col:rbCol(p)};
  return null;}
function mkpIsPen(k){return !!mkpInk(k);}
// the marks of this ink on one wall (and face): whole-wall / whole-face marks count as [0, length]
function mkpOwn(ink,level,wall,side){const r=mrkWallById(level,wall),L=r?mrkWallLen(r):0;
  return mrkList().filter(m=>m.level===level&&m.wall===wall&&(m.tags||[]).indexOf(ink.tag)>=0&&(ink.net==='c'?(m.kind==='wall'||m.kind==='wspan'):((m.kind==='side'||m.kind==='vstrip')&&m.side===side)))
    .map(m=>({m,u0:(m.kind==='wall'||m.kind==='side')?0:Math.min(m.u0,m.u1),u1:(m.kind==='wall'||m.kind==='side')?L:Math.max(m.u0,m.u1)}));}
function mkpCovered(ink,level,g){const iv=mkpOwn(ink,level,g.wall,g.side).map(x=>[x.u0,x.u1]).sort((a,b)=>a[0]-b[0]);let reach=g.u0;
  for(const v of iv){if(v[0]>reach+1)break;reach=Math.max(reach,v[1]);}return reach>=g.u1-1;}
function mkpRec(ink,level,g){return ink.net==='c'?{kind:'wspan',level,wall:g.wall,u0:Math.round(g.u0),u1:Math.round(g.u1),pol:ink.pol,tags:[ink.tag]}
  :{kind:'vstrip',level,wall:g.wall,side:g.side,u0:Math.round(g.u0),u1:Math.round(g.u1),pol:ink.pol,tags:[ink.tag]};}
// apply ranges with the ink: add (merged with what is there) or erase (cut out of what is there). ONE undo step.
function mkpApply(k,level,ranges,erase){const ink=mkpInk(k);if(!ink)return null;ranges=(ranges||[]).filter(g=>g.u1-g.u0>=WLN_MIN);if(!ranges.length)return {added:0,removed:0};
  pushUndo(['marks']);let added=0,removed=0;const lay=mrkLayer();
  ranges.forEach(g=>{const own=mkpOwn(ink,level,g.wall,g.side);let iv=own.map(x=>[x.u0,x.u1]);
    own.forEach(x=>{const i=mrkList().indexOf(x.m);if(i>=0){mrkList().splice(i,1);removed++;}});
    if(erase){const keep=[];iv.forEach(v=>{if(v[1]<=g.u0||v[0]>=g.u1)keep.push(v);else{if(v[0]<g.u0)keep.push([v[0],g.u0]);if(v[1]>g.u1)keep.push([g.u1,v[1]]);}});iv=keep;}
    else iv.push([g.u0,g.u1]);
    iv.sort((a,b)=>a[0]-b[0]);const merged=[];iv.forEach(v=>{const l=merged[merged.length-1];if(l&&v[0]<=l[1]+1)l[1]=Math.max(l[1],v[1]);else merged.push(v.slice());});
    merged.forEach(v=>{if(v[1]-v[0]<WLN_MIN)return;const rec=mkpRec(ink,level,{wall:g.wall,side:g.side,u0:v[0],u1:v[1]});rec.layer=lay;mrkList().push(rec);added++;});});
  ensureIds(data);return {added,removed};}

// ---- the tool ----
function mkpTol(){return WLN_SNAP_PX/(state.zoom||1)/SC;}
function mkpPt(e){const [bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(state.active,0));return [p[0],p[1]];}
function mkpStart(k){const ink=mkpInk(k);if(!ink)return false;toolsOff();if(state.mode!=='select')setMode('select');
  MKP.on=true;MKP.ink=k;MKP.press=null;MKP.hover=null;mkpHint();draw();return true;}
function mkpOff(){MKP.on=false;MKP.press=null;MKP.hover=null;const mh=$('modeHint');if(mh)mh.textContent=HINTS[state.mode]||'';
  if(typeof rbPanelDraw==='function')rbPanelDraw();}
function mkpHint(){const mh=$('modeHint'),ink=mkpInk(MKP.ink);if(!mh||!ink)return;
  mh.textContent='Jelölő toll: '+ink.n+' — '+(ink.net==='c'?'a fal középvonalán':'a fal felületén')+'. Húzd végig a falon: sarkon, csomóponton át követi; '
    +'kattintás: egy helyiség egy fala (újra: leveszi) · Alt + húzás: radír'+(ink.net==='c'?' · Shift + keret üres helyen: minden fal benne':'')+' · Esc: kész';
  if(typeof rbPanelDraw==='function')rbPanelDraw();}
function mkpDrag(P,p,e){const ink=mkpInk(MKP.ink),tol=mkpTol(),lvl=state.active;
  const s1=wlnNearest(lvl,ink.net,p,tol*WLN_LOCK);if(!s1)return;          // off the net: the lock keeps the last path
  const route=wlnRoute(lvl,ink.net,P.s0,s1);if(route.length)P.path=route;}
STK_TOOLS.push({k:'mkpPen',active:()=>{if(!MKP.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){mkpOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const ink=mkpInk(MKP.ink);if(!ink)return false;const p=mkpPt(e);
    const s0=wlnNearest(state.active,ink.net,p,mkpTol());
    MKP.press={client:[e.clientX,e.clientY],p0:p,s0,drag:false,erase:e.altKey,box:!s0&&e.shiftKey&&ink.net==='c',path:null};
    try{stage.setPointerCapture(e.pointerId);}catch(_){}draw();return true;},
  move(e){const P=MKP.press,ink=mkpInk(MKP.ink);if(!ink)return false;
    if(P&&(e.buttons&1)){if(!P.drag&&Math.hypot(e.clientX-P.client[0],e.clientY-P.client[1])>6)P.drag=true;
      if(P.drag){const p=mkpPt(e);P.p1=p;if(P.s0)mkpDrag(P,p,e);draw();}return true;}
    const s=wlnNearest(state.active,ink.net,mkpPt(e),mkpTol()),k=s?wlnKey(s.e.a)+wlnKey(s.e.b):'';
    if(((MKP.hover&&MKP.hover.k)||'')!==k){MKP.hover=s?{k,s}:null;draw();}return false;},
  up(e){const P=MKP.press;MKP.press=null;if(!P)return false;try{stage.releasePointerCapture(e.pointerId);}catch(_){}
    const ink=mkpInk(MKP.ink),lvl=state.active;let res=null,ranges=[];
    if(P.box&&P.drag&&P.p1){ranges=rwlBoxWalls(lvl,P.p0[0],P.p0[1],P.p1[0],P.p1[1]).filter(r=>r.id).map(r=>({wall:r.id,side:0,u0:0,u1:mrkWallLen(r)}));res=mkpApply(MKP.ink,lvl,ranges,P.erase);}
    else if(P.s0&&P.drag&&P.path){ranges=wlnRanges(lvl,P.path);
      // the two ends are where the user pressed and let go: snap them to 50 mm; the corners in between stay exact
      if(ranges.length){const snapEnd=(g,u)=>{const r=mrkWallById(lvl,g.wall),L=r?mrkWallLen(r):u;const s=mrkSnap(u);return Math.max(0,Math.min(L,s));};
        const first=P.path[0],last=P.path[P.path.length-1];
        ranges.forEach(g=>{const r=mrkWallById(lvl,g.wall);if(!r)return;
          if(first.e.wall===g.wall){const u=mrkU(r,first.pa[0],first.pa[1]);if(Math.abs(u-g.u0)<1)g.u0=snapEnd(g,u);else if(Math.abs(u-g.u1)<1)g.u1=snapEnd(g,u);}
          if(last.e.wall===g.wall){const u=mrkU(r,last.pb[0],last.pb[1]);if(Math.abs(u-g.u0)<1)g.u0=snapEnd(g,u);else if(Math.abs(u-g.u1)<1)g.u1=snapEnd(g,u);}});}
      res=mkpApply(MKP.ink,lvl,ranges,P.erase);}
    else if(P.s0&&!P.drag){ranges=wlnRanges(lvl,wlnUnit(lvl,ink.net,P.s0));
      const on=ranges.length&&ranges.every(g=>mkpCovered(ink,lvl,g));res=mkpApply(MKP.ink,lvl,ranges,P.erase||on);
      if(res)res.toggledOff=!!(P.erase||on);}
    $('hud').textContent=!res||(!res.added&&!res.removed)?'Kattints vagy húzz egy falon ('+(ink.net==='c'?'középvonal':'falfelület')+').'
      :(P.erase||res.toggledOff?'Levéve: ':'Jelölve: ')+ink.n+' · '+ranges.length+' szakasz';
    if(typeof rbPanelDraw==='function')rbPanelDraw();draw();return true;},
  key(e){return false;},esc(){mkpOff();draw();},mode(){mkpOff();}});
function mkpPiecesSvg(pieces,z,col,w,op){if(!pieces||!pieces.length)return '';
  return pieces.map(p=>`<polyline points="${p2b([[p.pa[0],p.pa[1],z],[p.pb[0],p.pb[1],z]])}" fill="none" stroke="${col}" stroke-width="${vsP(w)}" stroke-opacity="${op}" stroke-linecap="round"/>`).join('');}
STK_OVERLAY.push(()=>{if(!MKP.on)return '';const ink=mkpInk(MKP.ink);if(!ink)return '';const lvl=state.active,z=dz(lvl,0),P=MKP.press;
  const col=P&&P.erase?'#e8641c':ink.col;let s='';
  if(P&&P.box&&P.drag&&P.p1){const a=P.p0,b=P.p1,R=[[a[0],a[1]],[b[0],a[1]],[b[0],b[1]],[a[0],b[1]]];
    return `<polygon points="${p2b(R.map(q=>[q[0],q[1],z]))}" fill="${col}" fill-opacity="0.08" stroke="${col}" stroke-width="${vsP(1.2)}" stroke-dasharray="${vsDash('5 3')}"/>`;}
  if(P&&P.drag&&P.path)s+=mkpPiecesSvg(P.path,z,col,5,0.85);
  else{const h=P&&P.s0?{s:P.s0}:MKP.hover;if(h&&h.s){s+=mkpPiecesSvg(wlnUnit(lvl,ink.net,h.s),z,col,4,0.35);
    const b=planToBase(h.s.pt[0],h.s.pt[1],z);s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(3)}" fill="#fff" stroke="${col}" stroke-width="${vsP(1.5)}"/>`;}}
  return s;});

window.wlnNet=wlnNet;window.wlnNearest=wlnNearest;window.wlnRoute=wlnRoute;window.wlnUnit=wlnUnit;window.wlnRanges=wlnRanges;
window.mkpStart=mkpStart;window.mkpOff=mkpOff;window.mkpApply=mkpApply;window.mkpInk=mkpInk;window.mkpCovered=mkpCovered;window.MKP=MKP;
