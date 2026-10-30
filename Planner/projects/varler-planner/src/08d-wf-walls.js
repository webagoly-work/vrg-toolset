// ==========================================================================
// 08d-wf-walls.js — workflow round (docs/workflow), WP-F3 + WP-F4: Falak létrehozása / Padló létrehozása
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The pen (08c) stores each room's CLEAR outline — the inner sizes the user measured (Q-F01 = A, answered 2026-10-14).
// Create Walls keeps every one of those sizes:
//  1. SHIFT — every room moves RIGIDLY, never stretches: a room drawn against another room's line (a shared wall) moves
//     by the inner wall thickness relative to it, chained through the rooms that actually touch (per axis, the largest
//     push wins). Where the measured sizes do not add up, an outer line that was straight gets a step — reported.
//  2. BANDS — every orthogonal edge gets a band outside the room: the gap to the facing room where one faces it (a
//     shared wall), else the outer thickness. Convex corners get the corner square, so L / T / X joints close exactly.
//  3. CELLS — the bands are cut on one grid; a cell that is in a band and in no room is wall. Horizontal walls own the
//     junction cells (through), vertical walls butt on them — no overlap, no notch, nothing double-painted.
// 45° edges stay floor-only for now (Q-F02 = A) and are listed. Walls made here carry gen:'wfw'; a re-run replaces
// only those, hand-drawn walls stay. Rooms keep stage 'outline' until Padló létrehozása (F4).
if(!state.penThick)state.penThick={ext:300,int:200};
if(state.floorTint==null)state.floorTint=true;
const WFW_EPS=5;

function wfwRooms(level){return data.floors.map((fl,i)=>({fl,i})).filter(r=>r.fl&&r.fl.level===level&&r.fl.clear&&r.fl.poly&&r.fl.poly.length>=3);}
function wfwOrient(P){let a=0;for(let i=0,j=P.length-1;i<P.length;j=i++)a+=(P[j][0]*P[i][1]-P[i][0]*P[j][1]);return a>=0?1:-1;}
// the edges of a polygon with their outward normal; axis = 'h' | 'v' | null (diagonal)
function wfwEdges(P){const s=wfwOrient(P),out=[];
  P.forEach((a,k)=>{const b=P[(k+1)%P.length],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<0.5)return;
    // for a positive-area (counter-clockwise in math axes) polygon the outward normal is (dy,-dx)/L
    const n=[s*dy/L,-s*dx/L],axis=Math.abs(dy)<0.5?'h':Math.abs(dx)<0.5?'v':null;out.push({k,a,b,n,axis});});
  return out;}

// ---- 1. the rigid shift ------------------------------------------------------------------------------------------------
// contacts: an edge of one room lying on an edge of another with opposite outward normals, overlapping ≥ 100 mm.
// {axis:'x'|'y', lo: the room on the − side, hi: the room on the + side, c: the line}
function wfwContacts(rooms){const out=[];const E=rooms.map(r=>({r,e:wfwEdges(r.fl.poly)}));
  E.forEach((A,ia)=>A.e.forEach(ea=>{if(!ea.axis)return;E.forEach((B,ib)=>{if(ib<=ia)return;B.e.forEach(eb=>{if(eb.axis!==ea.axis)return;
    const u=ea.axis==='h'?1:0,w=1-u;                     // u: the fixed coordinate, w: along the edge
    if(Math.abs(ea.a[u]-eb.a[u])>WFW_EPS||ea.n[u]*eb.n[u]>=0)return;
    const lo=Math.max(Math.min(ea.a[w],ea.b[w]),Math.min(eb.a[w],eb.b[w])),hi=Math.min(Math.max(ea.a[w],ea.b[w]),Math.max(eb.a[w],eb.b[w]));
    if(hi-lo<100)return;
    // the room whose outward normal points + is on the − side of the line
    const [m,p]=ea.n[u]>0?[A.r.i,B.r.i]:[B.r.i,A.r.i];
    if(!out.some(c=>c.axis===(u?'y':'x')&&c.lo===m&&c.hi===p))out.push({axis:u?'y':'x',lo:m,hi:p,c:(ea.a[u]+eb.a[u])/2});});});}));
  return out;}
// shift[hi] ≥ shift[lo] + t along every contact — the longest push chain (contacts never form a cycle on one axis)
function wfwShifts(rooms,contacts,t){const sh={};rooms.forEach(r=>{sh[r.i]={x:0,y:0};});
  ['x','y'].forEach(ax=>{const C=contacts.filter(c=>c.axis===ax).sort((a,b)=>a.c-b.c);
    for(let pass=0;pass<rooms.length+1;pass++){let ch=false;C.forEach(c=>{const v=sh[c.lo][ax]+t;if(v>sh[c.hi][ax]+0.01){sh[c.hi][ax]=v;ch=true;}});if(!ch)break;}});
  return sh;}
function wfwExpand(rooms,t){const C=wfwContacts(rooms),sh=wfwShifts(rooms,C,t);
  return rooms.map(r=>({i:r.i,poly:r.fl.poly.map(p=>[p[0]+sh[r.i].x,p[1]+sh[r.i].y])}));}
// outer lines that were straight before the shift and are stepped after it (two rooms' outer edges on one line)
function wfwSteps(rooms,polys){const out=[],before=rooms.map(r=>wfwEdges(r.fl.poly)),after=polys.map(p=>wfwEdges(p.poly));
  for(let a=0;a<rooms.length;a++)for(let b=a+1;b<rooms.length;b++)before[a].forEach((ea,ka)=>{if(!ea.axis)return;before[b].forEach((eb,kb)=>{
    if(eb.axis!==ea.axis)return;const u=ea.axis==='h'?1:0;if(Math.abs(ea.a[u]-eb.a[u])>WFW_EPS||ea.n[u]*eb.n[u]<=0)return;
    const xa=after[a][ka],xb=after[b][kb];if(!xa||!xb)return;const d=Math.abs(xa.a[u]-xb.a[u]);
    if(d>WFW_EPS&&!out.some(o=>o.a===rooms[a].i&&o.b===rooms[b].i))out.push({a:rooms[a].i,b:rooms[b].i,d:Math.round(d)});});});
  return out;}

// ---- 2 + 3. bands, corner squares, cells -------------------------------------------------------------------------------
function wfwBands(polys,T){const bands=[],corners=[],skipped=[];
  polys.forEach((p,ri)=>{const E=wfwEdges(p.poly),ends=[];
    E.forEach((e,ei)=>{if(!e.axis){skipped.push({room:p.i,edge:e.k,why:'ferde él — fal később'});ends[ei]=null;return;}
      const u=e.axis==='h'?1:0,w=1-u,lo=Math.min(e.a[w],e.b[w]),hi=Math.max(e.a[w],e.b[w]),side=e.n[u];
      // facing edges of other rooms: parallel, opposite normal, within the outer thickness → the gap between them
      const cuts=[lo,hi],faces=[];
      polys.forEach((q,qi)=>{if(qi===ri)return;wfwEdges(q.poly).forEach(f=>{if(f.axis!==e.axis||f.n[u]*side>=0)return;
        const gap=(f.a[u]-e.a[u])*side;if(gap<=WFW_EPS||gap>T.ext+WFW_EPS)return;
        const flo=Math.max(lo,Math.min(f.a[w],f.b[w])),fhi=Math.min(hi,Math.max(f.a[w],f.b[w]));if(fhi-flo<1)return;
        faces.push({lo:flo,hi:fhi,gap});cuts.push(flo,fhi);});});
      cuts.sort((x,y)=>x-y);const tAt={};
      for(let k=0;k+1<cuts.length;k++){const a=cuts[k],b=cuts[k+1];if(b-a<0.5)continue;const m=(a+b)/2;
        const f=faces.filter(x=>x.lo<=m&&x.hi>=m).sort((x,y)=>x.gap-y.gap)[0],t=f?f.gap:T.ext;
        if(Math.abs(a-lo)<0.5)tAt.lo=t;if(Math.abs(b-hi)<0.5)tAt.hi=t;
        const o0=e.a[u],o1=e.a[u]+side*t;
        bands.push(e.axis==='h'?{x0:a,x1:b,y0:Math.min(o0,o1),y1:Math.max(o0,o1),o:'h'}:{y0:a,y1:b,x0:Math.min(o0,o1),x1:Math.max(o0,o1),o:'v'});}
      // the thickness at the edge's START (point a) and END (point b)
      const aLo=Math.abs(e.a[w]-lo)<0.5;ends[ei]={e,tA:aLo?tAt.lo:tAt.hi,tB:aLo?tAt.hi:tAt.lo};});
    // convex corners: the square diagonally outside, sized by the two edges' thicknesses there
    for(let k=0;k<E.length;k++){const A=ends[k],B=ends[(k+1)%E.length];if(!A||!B)continue;
      const cross=A.e.n[0]*B.e.n[1]-A.e.n[1]*B.e.n[0],turn=(A.e.b[0]-A.e.a[0])*(B.e.b[1]-B.e.a[1])-(A.e.b[1]-A.e.a[1])*(B.e.b[0]-B.e.a[0]);
      // convex = the outline turns the same way as its orientation; a reflex corner needs no square (its two bands overlap)
      if(Math.abs(cross)<0.5||turn*wfwOrient(p.poly)<=0)continue;
      const v=A.e.b,ta=A.tB,tb=B.tA;
      const q=[v[0]+A.e.n[0]*ta+B.e.n[0]*tb,v[1]+A.e.n[1]*ta+B.e.n[1]*tb];
      corners.push({x0:Math.min(v[0],q[0]),x1:Math.max(v[0],q[0]),y0:Math.min(v[1],q[1]),y1:Math.max(v[1],q[1]),o:'c'});}});
  return {bands,corners,skipped};}
function wfwCells(polys,B){const R=B.bands.concat(B.corners);
  const xs=[...new Set(R.flatMap(r=>[r.x0,r.x1]).map(v=>Math.round(v*2)/2))].sort((a,b)=>a-b);
  const ys=[...new Set(R.flatMap(r=>[r.y0,r.y1]).map(v=>Math.round(v*2)/2))].sort((a,b)=>a-b);
  const inR=(x,y,r)=>x>r.x0&&x<r.x1&&y>r.y0&&y<r.y1;
  const cell=[];for(let j=0;j+1<ys.length;j++){cell[j]=[];for(let i=0;i+1<xs.length;i++){const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
    if(xs[i+1]-xs[i]<0.5||ys[j+1]-ys[j]<0.5||polys.some(p=>pointInPoly(x,y,p.poly))){cell[j][i]=null;continue;}
    const hit=R.filter(r=>inR(x,y,r));cell[j][i]=hit.length?{h:hit.some(r=>r.o==='h'),v:hit.some(r=>r.o==='v'),c:hit.some(r=>r.o==='c'),used:false}:null;}}
  // a junction cell (corner squares only) belongs to the wall that runs THROUGH it: a partition ends on the outer wall's
  // face, never through it. Through both ways (X) or neither (L corner) → the horizontal wall takes it.
  const W=(j,i)=>!!(cell[j]&&cell[j][i]);
  cell.forEach((row,j)=>row.forEach((c,i)=>{if(!c||c.h||c.v)return;const hT=W(j,i-1)&&W(j,i+1),vT=W(j-1,i)&&W(j+1,i);
    if(vT&&!hT)c.v=true;else c.h=true;}));
  return {xs,ys,cell};}
function wfwMerge(G){const {xs,ys,cell}=G,out=[],W2=(j,i)=>!!(cell[j]&&cell[j][i]);
  // horizontal walls first (they own the junction and corner cells), then whatever is left runs vertically
  for(let j=0;j+1<ys.length;j++){let s=-1;for(let i=0;i<=xs.length-1;i++){const c=cell[j]&&cell[j][i];const on=!!(c&&c.h&&!c.v&&!c.used)||!!(c&&c.h&&c.v&&!c.used&&!(W2(j-1,i)&&W2(j+1,i)&&!(W2(j,i-1)&&W2(j,i+1))));
    if(on&&s<0)s=i;if((!on||i===xs.length-2)&&s>=0){const e=on?i:i-1;for(let k=s;k<=e;k++)cell[j][k].used=true;
      out.push({x0:xs[s],x1:xs[e+1],y0:ys[j],y1:ys[j+1],o:'h'});s=-1;}}}
  for(let i=0;i+1<xs.length;i++){let s=-1;for(let j=0;j<=ys.length-1;j++){const c=cell[j]&&cell[j][i];const on=!!(c&&!c.used);
    if(on&&s<0)s=j;if((!on||j===ys.length-2)&&s>=0){const e=on?j:j-1;for(let k=s;k<=e;k++)cell[k][i].used=true;
      out.push({x0:xs[i],x1:xs[i+1],y0:ys[s],y1:ys[e+1],o:'v'});s=-1;}}}
  // strips cut by unrelated grid lines join back: same span, touching across
  let again=true;while(again){again=false;
    for(let a=0;a<out.length&&!again;a++)for(let b=0;b<out.length&&!again;b++){if(a===b)continue;const A=out[a],Bq=out[b];if(A.o!==Bq.o)continue;
      if(A.o==='h'&&Math.abs(A.x0-Bq.x0)<0.5&&Math.abs(A.x1-Bq.x1)<0.5&&Math.abs(A.y1-Bq.y0)<0.5){A.y1=Bq.y1;out.splice(b,1);again=true;}
      else if(A.o==='v'&&Math.abs(A.y0-Bq.y0)<0.5&&Math.abs(A.y1-Bq.y1)<0.5&&Math.abs(A.x1-Bq.x0)<0.5){A.x1=Bq.x1;out.splice(b,1);again=true;}}}
  return out;}

// the dry run: {polys:[{i,poly}], walls:[rect], moves:[{i,name,dx,dy,dw,dh}], skipped}
function wfwPlan(level,opt){opt=opt||{};level=level||state.active;const T=Object.assign({ext:300,int:200},state.penThick,opt.thick);
  const rooms=wfwRooms(level);if(!rooms.length)return {polys:[],walls:[],moves:[],steps:[],skipped:[],empty:true};
  const polys=wfwExpand(rooms,T.int),B=wfwBands(polys,T),walls=wfwMerge(wfwCells(polys,B)),steps=wfwSteps(rooms,polys);
  const box=P=>{const X=P.map(p=>p[0]),Y=P.map(p=>p[1]);return {x0:Math.min(...X),y0:Math.min(...Y),w:Math.max(...X)-Math.min(...X),h:Math.max(...Y)-Math.min(...Y)};};
  const moves=[];polys.forEach(p=>{const o=box(data.floors[p.i].poly),n=box(p.poly),m={i:p.i,name:data.floors[p.i].name||'',dx:n.x0-o.x0,dy:n.y0-o.y0,dw:n.w-o.w,dh:n.h-o.h};
    if(m.dx||m.dy||m.dw||m.dh)moves.push(m);});
  return {polys,walls,moves,steps,skipped:B.skipped,thick:T};}
function wfwApply(plan,level){level=level||state.active;if(!plan||plan.empty)return 0;
  pushUndo();                                                   // unscoped: floors AND walls in one step
  plan.polys.forEach(p=>{data.floors[p.i].poly=p.poly.map(q=>[Math.round(q[0]*2)/2,Math.round(q[1]*2)/2]);});
  // a re-run keeps the id of the old wall a new one overlaps most (same orientation) — marks (R2) hold walls by id
  const old=(WALLS[level]||[]).filter(r=>r.gen==='wfw'),taken=new Set();
  const ov=(p,q)=>Math.max(0,Math.min(p.x1,q.x1)-Math.max(p.x0,q.x0))*Math.max(0,Math.min(p.y1,q.y1)-Math.max(p.y0,q.y0));
  WALLS[level]=(WALLS[level]||[]).filter(r=>r.gen!=='wfw');
  const lay=curLayer();plan.walls.forEach(r=>{const hz=(r.x1-r.x0)>=(r.y1-r.y0);let best=null,ba=0;
    old.forEach(o=>{if(taken.has(o.id)||((o.x1-o.x0)>=(o.y1-o.y0))!==hz)return;const v=ov(o,r);if(v>ba){ba=v;best=o;}});
    const n={x0:r.x0,y0:r.y0,x1:r.x1,y1:r.y1,gen:'wfw',layer:lay};if(best&&best.id){n.id=best.id;taken.add(best.id);}WALLS[level].push(n);});
  SNAP[level]=centerlines(WALLS[level]);ensureIds(data);draw();
  $('hud').textContent='Falak létrehozva: '+plan.walls.length+' fal'+(plan.moves.length?' · '+plan.moves.length+' helyiség eltolva':'')+(plan.skipped.length?' · '+plan.skipped.length+' ferde él kimaradt':'');
  return plan.walls.length;}
function wfwKindName(k){const e=(typeof NEED_KINDS!=='undefined'?NEED_KINDS:[]).find(x=>x.k===k);return e?e.n:k;}
function wfwRoomName(i){const fl=data.floors[i];return esc(fl.name||(fl.kinds&&fl.kinds.length?fl.kinds.map(wfwKindName).join(' + '):'')||('Helyiség '+(fl.id||i)));}
function wfwDialog(level){level=level||state.active;const plan=wfwPlan(level);
  if(plan.empty){$('hud').textContent='Nincs helyiség-körvonal ezen a szinten — rajzolj a Helyiség-tollal.';return;}
  const mm=v=>(v>0?'+':'')+wfpMm(v);
  const rows=plan.moves.map(m=>`<tr><td>${wfwRoomName(m.i)}</td><td style="text-align:right">${m.dx||m.dy?mm(m.dx)+' / '+mm(m.dy):'—'}</td>`
    +`<td style="text-align:right;${m.dw||m.dh?'color:#c0392b;font-weight:700':''}">${m.dw||m.dh?mm(m.dw)+' × '+mm(m.dh):'változatlan'}</td></tr>`).join('');
  const body=`<div style="font-size:12px;margin-bottom:6px">Külső fal <b>${plan.thick.ext}</b> mm · belső fal <b>${plan.thick.int}</b> mm, szimmetrikusan a vonalra; `
    +`a rajzolt méretek <b>belméretek</b> maradnak (a közös falak mentén a szomszéd helyiségek eltolódnak).</div>`
    +`<div style="font-size:12px"><b>${plan.walls.length}</b> fal · <b>${plan.polys.length}</b> helyiség · eltolva <b>${plan.moves.length}</b>`
    +(plan.skipped.length?` · <span style="color:var(--pc-crit,#c0392b)">${plan.skipped.length} ferde él kimarad (fal később)</span>`:'')+`</div>`
    +(rows?`<table style="font-size:12px;margin-top:6px;border-collapse:collapse;width:100%"><tr style="color:var(--pc-mute,#777)"><td>Helyiség</td><td style="text-align:right">eltolás X / Y</td><td style="text-align:right">méretváltozás</td></tr>${rows}</table>`:'')
    +(plan.steps.length?`<div style="font-size:11.5px;color:var(--pc-crit,#c0392b);margin-top:6px"><b>Lépcső a külső falon</b> — a mért méretek nem adnak ki egy egyenes falat:<br>${plan.steps.map(st=>wfwRoomName(st.a)+' ↔ '+wfwRoomName(st.b)+': '+wfpMm(st.d)+' mm').join('<br>')}<br><span style="color:var(--pc-mute,#777)">Ellenőrizd a méréseket, vagy húzd egyenesbe a Helyiség-tollal.</span></div>`:'')
    +((WALLS[level]||[]).some(r=>r.gen==='wfw')?`<div style="font-size:11px;color:var(--pc-mute,#777);margin-top:4px">Az előző „Falak létrehozása” falai lecserélődnek; a kézzel rajzolt falak maradnak.</div>`:'');
  openModal('Falak létrehozása',body,()=>wfwApply(plan,level),'Alkalmaz');}

// ---- F4: Padló létrehozása + the room-type tint -------------------------------------------------------------------------
const WFW_TINT_BASE='#e2ddd0';
const WFW_KIND_HUE={nappali:ROOMS.NAGYSZOBA,halo:ROOMS.HALO,konyha:ROOMS.KONYHA,kamra:ROOMS.KAMRA,kozlekedo:ROOMS.CORR,eloszoba:ROOMS.CORR,
  gepeszet:ROOMS.GARAZS,furdo:'#c9dde6',wc:'#d3e0e6',etkezo:'#e8dcc4',dolgozo:'#dad3e6',kulter:'#d5e3cc'};
function wfwMix(a,b,k){const h=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));const A=h(a),B=h(b);
  return '#'+A.map((v,i)=>Math.round(v*k+B[i]*(1-k)).toString(16).padStart(2,'0')).join('');}
function wfwKindOf(fl){return (fl.kinds&&fl.kinds[0])||fl.kind||(typeof needKind==='function'?needKind(fl):null);}
function wfwTintOf(fl){const hue=state.floorTint?WFW_KIND_HUE[wfwKindOf(fl)]:null;return hue?wfwMix(hue,WFW_TINT_BASE,0.35):WFW_TINT_BASE;}
// a fill the user set is theirs (no fillAuto flag) — only automatic fills follow the kind and the toggle
function wfwRetint(level){data.floors.forEach(fl=>{if(fl.fillAuto&&(!level||fl.level===level))fl.fill=wfwTintOf(fl);});}
function wfwFloors(level){level=level||state.active;const L=data.floors.filter(fl=>fl.level===level&&fl.stage==='outline');
  if(!L.length){$('hud').textContent='Nincs padló nélküli helyiség ezen a szinten.';return 0;}
  pushUndo(UNDO_SCOPE.floor);let A=0;
  L.forEach(fl=>{fl.stage='floor';if(!fl.fill||fl.fillAuto){fl.fill=wfwTintOf(fl);fl.fillAuto=true;}A+=polyAreaMM(fl.poly);});
  draw();$('hud').textContent='Padló létrehozva: '+L.length+' helyiség, '+wfpFmt(A/1e6)+' m²';return L.length;}
function wfwTintToggle(on){state.floorTint=on==null?!state.floorTint:!!on;wfwRetint();draw();return state.floorTint;}

registerActions([
  {id:'wf.walls',label:'Falak létrehozása',icon:'🧱',group:'Fal',alias:'create walls falak letrehozasa',
   hint:'A Helyiség-tollal rajzolt helyiségek köré falat épít (külső 300, belső 200 mm); a belméretek megmaradnak.',
   need:'Rajzolj helyiséget a Helyiség-tollal.',when:()=>wfwRooms(state.active).length>0,run:()=>wfwDialog()},
  {id:'wf.floors',label:'Padló létrehozása',icon:'▦',group:'Helyiség',alias:'create floors padlo letrehozasa',
   hint:'A körvonal-helyiségek padlót kapnak, a helyiségtípus színével.',need:'Nincs padló nélküli helyiség.',
   when:()=>data.floors.some(fl=>fl.level===state.active&&fl.stage==='outline'),run:()=>wfwFloors()},
  {id:'wf.tint',label:'Helyiségtípus színezés',icon:'🎨',group:'Nézet',alias:'floor tint room colour',
   hint:'A padló színe a helyiség típusát követi (ki/be).',when:()=>true,run:()=>wfwTintToggle()}]);
(function(){const b1=$('wfWallsBtn'),b2=$('wfFloorsBtn');if(b1)b1.onclick=()=>wfwDialog();if(b2)b2.onclick=()=>wfwFloors();})();
