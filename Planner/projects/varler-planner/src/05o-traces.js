// ==========================================================================
// 05o-traces.js — movement traces (WP-B4) and the portal graph derived from them (WP-B5)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A trace is a polyline drawn on a floor or ceiling plane that says how people move through a room:
//   {id, layer, level, plane, mode:'line45'|'free'|'smooth', pts:[[x,y]…], a:<door id>|null, b:<door id>|null,
//    dir:1|0, tags:['mozgas']}      dir 1 = directional (a→b, the drawing order), 0 = both ways.
// The portal graph (prt*) is DERIVED from doors, rooms and traces — never stored. Prefixes: trc, prt.

const TRC={step:100, ang:45, snapDoor:600, approach:250, rdpEps:50, chaikin:2, freeMin:20};
// step/ang: the 45° line mode moves in 100 mm steps [user]. snapDoor: an end within 600 mm of a door
// centre attaches to the door [Q16=A]. approach: the attached end sits 250 mm inside the room on the door's
// normal. rdpEps + chaikin: the "smooth" mode [Q17=A]. freeMin: freehand samples closer than 20 mm are dropped.
const PRT={grid:500, resample:250};  // [user] 500×500 mm encoding grid; traces resampled every 250 mm first
const TRC_COL={mozgas:'#2a8c8c',atjaras:'#5470b0',ejszakai:'#7a5cc0',lepcso:'#b07a2a'};

function trcList(){if(!Array.isArray(data.traces))data.traces=[];return data.traces;}
function trcRound(p){return [Math.round(p[0]),Math.round(p[1])];}
function trcDist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function trcLen(pts){let s=0;for(let i=1;i<pts.length;i++)s+=trcDist(pts[i-1],pts[i]);return s;}
function trcIsMode(k){return k==='line45'||k==='free'||k==='smooth';}

// ---- 45° steps -----------------------------------------------------------------------------------------------
// the next vertex from `last` towards the pointer: direction = the pointer vector's angle rounded to a multiple
// of 45° (relative to the plan axes, so a gamepad's eight directions map 1:1), length = its projection on that
// direction rounded to 100 mm (min 100); coordinates rounded to 1 mm
function trcStep(last,p){const vx=p[0]-last[0],vy=p[1]-last[1],a=Math.round(Math.atan2(vy,vx)/(TRC.ang*Math.PI/180))*(TRC.ang*Math.PI/180);
  const dx=Math.cos(a),dy=Math.sin(a),proj=vx*dx+vy*dy,len=Math.max(TRC.step,Math.round(proj/TRC.step)*TRC.step);
  return trcRound([last[0]+dx*len,last[1]+dy*len]);}

// ---- smoothing -------------------------------------------------------------------------------------------------
// Ramer–Douglas–Peucker: drop every point closer than eps to the line through the kept neighbours; both ends stay
function trcRdp(pts,eps){if(pts.length<3)return pts.slice();
  const keep=new Array(pts.length).fill(false);keep[0]=keep[pts.length-1]=true;
  const rec=(i,j)=>{const a=pts[i],b=pts[j],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;let md=-1,mi=-1;
    for(let k=i+1;k<j;k++){const p=pts[k];let d;
      if(!l2)d=trcDist(p,a);else{const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2));d=trcDist(p,[a[0]+t*dx,a[1]+t*dy]);}
      if(d>md){md=d;mi=k;}}
    if(md>eps){keep[mi]=true;rec(i,mi);rec(mi,j);}};
  rec(0,pts.length-1);return pts.filter((_,i)=>keep[i]);}
// Chaikin corner cutting with the END POINTS FIXED (the textbook version moves them): the first segment
// contributes only its far quarter point, the last only its near one
function trcChaikin(pts,n){let p=pts.slice();
  for(let pass=0;pass<n&&p.length>2;pass++){const out=[p[0]],m=p.length-1;
    for(let i=0;i<m;i++){const a=p[i],b=p[i+1];
      if(i>0)out.push([0.75*a[0]+0.25*b[0],0.75*a[1]+0.25*b[1]]);
      if(i<m-1)out.push([0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1]]);}
    out.push(p[m]);p=out;}
  return p;}
function trcSmooth(pts){return trcChaikin(trcRdp(pts,TRC.rdpEps),TRC.chaikin).map(trcRound);}

// ---- doors -----------------------------------------------------------------------------------------------------
function trcUsableDoors(level){return (data.openings||[]).filter(o=>o&&o.type==='door'&&o.level===level&&
  (typeof mrkOpeningTags!=='function'||mrkOpeningTags(o.id).indexOf('nemhasznalt')<0));}
// the nearest usable door whose centre is within TRC.snapDoor of the point, else null (a door tagged nemhasznalt is never snapped to)
function trcDoorNear(level,x,y){let best=null,bd=TRC.snapDoor;
  trcUsableDoors(level).forEach(o=>{const d=Math.hypot(o.x-x,o.y-y);if(d<=bd){bd=d;best=o;}});return best;}
function trcDoorNormal(o){return [-Math.sin(o.ang||0),Math.cos(o.ang||0)];}
// the point TRC.approach from the door centre along the normal, on the side where `towards` lies
function trcApproach(o,towards){const n=trcDoorNormal(o),dot=(towards[0]-o.x)*n[0]+(towards[1]-o.y)*n[1],s=dot<0?-1:1;
  return trcRound([o.x+n[0]*s*TRC.approach,o.y+n[1]*s*TRC.approach]);}
// attach both ends to the doors in range; the side is chosen by the NEXT point of the trace, not by the pointer
function trcAttach(level,pts){const out=pts.map(p=>p.slice());let a=null,b=null;const n=pts.length;if(n<2)return {pts:out,a,b};
  const d0=trcDoorNear(level,pts[0][0],pts[0][1]);if(d0){a=d0.id;out[0]=trcApproach(d0,pts[1]);}
  const d1=trcDoorNear(level,pts[n-1][0],pts[n-1][1]);if(d1){b=d1.id;out[n-1]=trcApproach(d1,pts[n-2]);}
  return {pts:out,a,b};}

// ---- the tool modes (dispatched by the plane tool of 05n) -------------------------------------------------------------
MRK_PLANE_MODES.push({k:'line45',n:'Vonal 45°-onként'},{k:'free',n:'Szabadkézi'},{k:'smooth',n:'Simított szabadkézi'});
let TRC_D=null,TRC_H=null,TRC_B=null,TRC_LAST=0;      // the draft, hover point, the brush (last tags), time of the last click
function trcCancel(){TRC_D=null;TRC_H=null;}
function trcSync(){if(TRC_D&&(TRC_D.mode!==MRK_P.mode||TRC_D.plane!==MRK_P.plane||TRC_D.level!==state.active))TRC_D=null;}
function trcDown(e){if(e.button!==0||(e.buttons&3)===3)return false;trcSync();
  const q=mrkPlanePt(e),p=[q.x,q.y],mode=MRK_P.mode,now=Date.now();
  try{stage.setPointerCapture(e.pointerId);}catch(_){}
  if(mode==='line45'){
    if(!TRC_D)TRC_D={mode,level:q.level,plane:MRK_P.plane,pts:[trcRound(p)],cur:null};
    else{const last=TRC_D.pts[TRC_D.pts.length-1];
      if(now-TRC_LAST<350&&TRC_D.pts.length>=2&&trcDist(p,last)<250){TRC_LAST=0;trcFinish({shift:e.shiftKey});return true;}   // double-click finishes
      TRC_D.pts.push(trcStep(last,p));}
    TRC_LAST=now;draw();return true;}
  TRC_D={mode,level:q.level,plane:MRK_P.plane,pts:[trcRound(p)],drawing:true};draw();return true;}
function trcMove(e){trcSync();const q=mrkPlanePt(e),p=[q.x,q.y];
  if(!TRC_D){TRC_H=p;draw();return false;}               // hover: the door ring follows the pointer
  if(TRC_D.mode==='line45'){TRC_D.cur=trcStep(TRC_D.pts[TRC_D.pts.length-1],p);draw();return true;}
  if(TRC_D.drawing){const last=TRC_D.pts[TRC_D.pts.length-1];if(trcDist(p,last)>=TRC.freeMin)TRC_D.pts.push(trcRound(p));draw();return true;}
  return false;}
function trcUp(e){trcSync();if(!TRC_D)return false;
  if(TRC_D.drawing){const q=mrkPlanePt(e),p=trcRound([q.x,q.y]),last=TRC_D.pts[TRC_D.pts.length-1];
    if(trcDist(p,last)>=1)TRC_D.pts.push(p);trcFinish({shift:e.shiftKey});return true;}
  return true;}                                          // line45: the click was handled on press
function trcKey(e){trcSync();if(!TRC_D||TRC_D.mode!=='line45')return false;
  if(e.key==='Enter'){e.preventDefault();trcFinish({shift:e.shiftKey});return true;}
  if(e.key==='Backspace'){e.preventDefault();TRC_D.pts.pop();if(!TRC_D.pts.length)TRC_D=null;draw();return true;}
  return false;}
// Esc finishes a trace of 2+ points, else drops the lone start point (a draft is not data)
function trcEsc(){if(!TRC_D)return false;if(TRC_D.pts.length>=2)trcFinish({});else{TRC_D=null;draw();}return true;}

// ---- finishing -----------------------------------------------------------------------------------------------------------
function trcFinish(opt){opt=opt||{};const d=TRC_D;TRC_D=null;if(!d)return false;
  let pts=d.mode==='smooth'?trcSmooth(d.pts):d.pts.map(trcRound);
  if(pts.length>=2){const t=trcAttach(d.level,pts);pts=t.pts;var a=t.a,b=t.b;}
  if(pts.length<2||trcLen(pts)<200){$('hud').textContent='Túl rövid nyom — nem mentettem.';draw();return false;}
  const make=res=>trcCommit({level:d.level,plane:d.plane,mode:d.mode,pts,a:a||null,b:b||null,dir:res.dir?1:0,tags:res.tags});
  if(opt.shift&&TRC_B&&TRC_B.tags.length){make(TRC_B);return true;}
  trcPicker(null,res=>{TRC_B={tags:res.tags.slice(),dir:res.dir};make(res);});return true;}
function trcCommit(rec){pushUndo(['traces']);rec.layer=mrkLayer();trcList().push(rec);ensureIds(data);draw();
  $('hud').textContent='Mozgásnyom mentve: '+rec.pts.length+' pont, '+(rec.a?'ajtótól ':'')+(rec.b?'ajtóig':'')+(rec.dir?'':' (kétirányú)');return rec;}
// the small tag dialog: MRK_TRACE_TAGS + a two-way switch
function trcPicker(t,onOk){const cur=t||(TRC_B?{tags:TRC_B.tags,dir:TRC_B.dir}:{tags:['mozgas'],dir:1});
  openModal('Mozgásnyom',
    MRK_TRACE_TAGS.map(g=>`<div><label><input type="checkbox" class="tpTag" value="${g.k}" ${(cur.tags||[]).indexOf(g.k)>=0?'checked':''}> ${g.n}</label></div>`).join('')
   +`<div class="mrow"><label><input type="checkbox" id="tpTwo" ${cur.dir===0?'checked':''}> kétirányú</label></div>`,
    ()=>{onOk({tags:[...document.querySelectorAll('.tpTag')].filter(c=>c.checked).map(c=>c.value),dir:$('tpTwo').checked?0:1});});}

// ---- drawing -----------------------------------------------------------------------------------------------------------------------
function trcCol(t){const k=(t.tags||[])[0];return TRC_COL[k]||'#2a8c8c';}
// the points `step` mm apart along the polyline, starting `first` mm in
function trcAlong(pts,step,first){const out=[];let s=0,next=first;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=trcDist(a,b);
    while(next<=s+L&&L>0){const f=(next-s)/L;out.push({x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,dx:(b[0]-a[0])/L,dy:(b[1]-a[1])/L});next+=step;}
    s+=L;}
  return out;}
// a direction triangle in screen units (computed geometry — an SVG <marker> would be dropped by exporters)
function trcTriangle(x,y,dx,dy,z,col){const c=planToBase(x,y,z),q=planToBase(x+dx*50,y+dy*50,z);let ux=q[0]-c[0],uy=q[1]-c[1];const l=Math.hypot(ux,uy)||1;ux/=l;uy/=l;
  const tip=[c[0]+ux*6,c[1]+uy*6],bl=[c[0]-ux*4-uy*4,c[1]-uy*4+ux*4],br=[c[0]-ux*4+uy*4,c[1]-uy*4-ux*4];
  return `<polygon points="${[tip,bl,br].map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="${col}"/>`;}
function trcDot(p,z,col,r,fill){const b=planToBase(p[0],p[1],z);
  return `<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${r}" fill="${fill||col}" stroke="${col}" stroke-width="1"/>`;}
function trcSvg(t,preview){const z=dz(t.level,0),col=trcCol(t),pts=t.pts;if(!pts||pts.length<2)return '';
  let s=`<polyline points="${p2b(pts.map(p=>[p[0],p[1],z]))}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${(t.plane==='ceiling'||preview)?' stroke-dasharray="6 4"':''}/>`;
  if(t.dir===0){s+=trcDot(pts[0],z,col,3)+trcDot(pts[pts.length-1],z,col,3);}
  else{const len=trcLen(pts),first=len<1000?len/2:500;trcAlong(pts,1000,first).forEach(q=>{s+=trcTriangle(q.x,q.y,q.dx,q.dy,z,col);});}
  if(t.a)s+=trcDot(pts[0],z,col,3,'#fff');if(t.b)s+=trcDot(pts[pts.length-1],z,col,3,'#fff');
  return s;}
function trcSceneSvg(){let s='';
  trcList().forEach(t=>{if(!state.levels[t.level]||!layerShows(t,'trace'))return;const svg=trcSvg(t);if(svg)s+=lyrWrap(t,'trace',svg);});return s;}
// overlay: the draft with its next segment, and a ring on the door the pointer (or an end) is in range of
function trcOverlaySvg(){if(typeof MRK_P==='undefined'||!MRK_P.on||!trcIsMode(MRK_P.mode))return '';
  trcSync();const level=state.active,z=dz(level,0);let s='';
  const ring=o=>{const c=planToBase(o.x,o.y,z),R=Math.max(10,((o.w||900)/2)*SC*0.9);
    return `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${R.toFixed(1)}" fill="none" stroke="#2a8c8c" stroke-width="2.5" stroke-dasharray="4 3" pointer-events="none"/>`;};
  const probe=TRC_D?TRC_D.pts[TRC_D.pts.length-1]:TRC_H;
  if(TRC_D){const pts=TRC_D.cur?TRC_D.pts.concat([TRC_D.cur]):TRC_D.pts;
    if(pts.length>=2)s+=`<g opacity="0.9" pointer-events="none">`+trcSvg({level,plane:TRC_D.plane,pts,dir:1,tags:(TRC_B&&TRC_B.tags)||['mozgas']},true)+`</g>`;
    else s+=trcDot(pts[0],z,'#2a8c8c',4);
    const d0=trcDoorNear(level,TRC_D.pts[0][0],TRC_D.pts[0][1]);if(d0)s+=ring(d0);}
  if(probe){const d=trcDoorNear(level,probe[0],probe[1]);if(d)s+=ring(d);}
  return s;}
STK_SCENE.push(trcSceneSvg);
STK_OVERLAY.push(trcOverlaySvg);

// ---- right-click on a trace ---------------------------------------------------------------------------------------------------------------
function trcHit(e){const [bx,by]=clientToBase(e),lim=10/state.zoom;let best=null,bd=lim;
  trcList().forEach(t=>{if(!state.levels[t.level]||!layerShows(t,'trace'))return;const z=dz(t.level,0);
    for(let i=1;i<t.pts.length;i++){const A=planToBase(t.pts[i-1][0],t.pts[i-1][1],z),B=planToBase(t.pts[i][0],t.pts[i][1],z),d=nearestOnSeg(bx,by,A[0],A[1],B[0],B[1]).d;
      if(d<bd){bd=d;best=t;}}});
  return best;}
function trcReverse(t){pushUndo(['traces']);t.pts=t.pts.slice().reverse();const x=t.a;t.a=t.b;t.b=x;draw();}
function trcToggleDir(t){pushUndo(['traces']);t.dir=t.dir?0:1;draw();}
function trcSmoothNow(t){if(t.mode!=='free')return false;pushUndo(['traces']);t.pts=trcSmooth(t.pts);t.mode='smooth';draw();return true;}
// re-run the door snapping of §3 on a stored trace (its first/last point is already an approach point or a free end)
function trcReattach(t){const r=trcAttach(t.level,t.pts);pushUndo(['traces']);t.pts=r.pts;t.a=r.a;t.b=r.b;draw();return r;}
function trcEditTags(t){trcPicker(t,res=>{pushUndo(['traces']);t.tags=res.tags;t.dir=res.dir;draw();});}
function trcRemove(t){const i=trcList().indexOf(t);if(i<0)return;pushUndo(['traces']);trcList().splice(i,1);draw();}
function trcMenu(t){return [
  {label:'Címkék…',act:()=>trcEditTags(t)},
  {label:'Irány megfordítása',act:()=>trcReverse(t)},
  {label:t.dir?'Kétirányú be':'Kétirányú ki',act:()=>trcToggleDir(t)},
  {label:'Simítás most',act:()=>{if(!trcSmoothNow(t))$('hud').textContent='Csak szabadkézi nyomot lehet simítani.';}},
  {label:'Ajtókhoz kötés újra',act:()=>trcReattach(t)},
  {label:'Törlés',act:()=>trcRemove(t)}];}
STK_CTX.push(e=>{const t=trcHit(e);return t?trcMenu(t):null;});

// ---- validation -----------------------------------------------------------------------------------------------------------------------------
VALIDATORS.push({code:'trace.*',run:()=>{const out=[];
  trcList().forEach(t=>{
    [t.a,t.b].forEach(id=>{if(id&&!(data.openings||[]).some(o=>o.id===id))out.push({sev:'warn',code:'trace.door',msg:'A nyom ajtója már nincs meg: '+t.id,ref:t.id});});
    const rooms=new Set();(t.pts||[]).forEach(p=>{const r=mrkRoomAtPt(t.level,p[0],p[1]);if(r)rooms.add(stkRoomId(r)||'?');});
    if(rooms.size>1)out.push({sev:'info',code:'trace.room',msg:'A nyom több helyiségen halad át: helyiségenként rajzold, ajtótól ajtóig.',ref:t.id});});
  return out;}});

// ====================================================================================================================
// WP-B5 — the portal graph: doors are nodes, line of sight, the 500 mm trace encoding, the heat map
// ====================================================================================================================
// pure geometry --------------------------------------------------------------------------------------------------------
function prtOrient(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
// two segments cross at a point interior to both (touching, sharing a vertex or lying along each other is NOT a crossing)
function prtCross(a,b,c,d){const o1=prtOrient(a,b,c),o2=prtOrient(a,b,d),o3=prtOrient(c,d,a),o4=prtOrient(c,d,b),e=1e-9;
  return ((o1>e&&o2<-e)||(o1<-e&&o2>e))&&((o3>e&&o4<-e)||(o3<-e&&o4>e));}
// does segment a–b stay inside the polygon? no proper crossing of any edge AND the midpoint inside
function prtSegInPoly(a,b,poly){const n=poly.length;
  for(let i=0;i<n;i++)if(prtCross(a,b,poly[i],poly[(i+1)%n]))return false;
  return pointInPoly((a[0]+b[0])/2,(a[1]+b[1])/2,poly);}
// the grid cells whose centre lies in the polygon (absolute grid, origin 0,0)
function prtGrid(poly,g){g=g||PRT.grid;const bb=polyBBox(poly),cells=[];
  for(let i=Math.floor(bb.x0/g);i<=Math.floor(bb.x1/g);i++)for(let j=Math.floor(bb.y0/g);j<=Math.floor(bb.y1/g);j++)
    if(pointInPoly((i+0.5)*g,(j+0.5)*g,poly))cells.push({i,j});
  return cells;}
// 8-neighbour A* over the free cells. A diagonal step needs both orthogonal neighbours free (no corner cutting).
// Cost 1·g orthogonal, √2·g diagonal. Ties are broken by (f, h, i, j) so the result is deterministic.
// → {len_mm, cells:[[i,j]…]} or null. len_mm includes the way from each end point to the centre of its cell.
function prtAStar(poly,a,b,g){g=g||PRT.grid;
  const free=new Set(prtGrid(poly,g).map(c=>c.i+','+c.j));if(!free.size)return null;
  const near=p=>{let i=Math.floor(p[0]/g),j=Math.floor(p[1]/g);if(free.has(i+','+j))return [i,j];
    let best=null,bd=1e18;free.forEach(k=>{const [ci,cj]=k.split(',').map(Number),d=Math.hypot((ci+0.5)*g-p[0],(cj+0.5)*g-p[1]);
      if(d<bd||(d===bd&&best&&(ci<best[0]||(ci===best[0]&&cj<best[1])))){bd=d;best=[ci,cj];}});return best;};
  const s=near(a),t=near(b);if(!s||!t)return null;
  const h=(i,j)=>{const dx=Math.abs(i-t[0]),dy=Math.abs(j-t[1]);return (Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy))*g;};
  const key=(i,j)=>i+','+j,gs={},from={},closed=new Set(),open=[{i:s[0],j:s[1],g:0,f:h(s[0],s[1]),h:h(s[0],s[1])}];gs[key(s[0],s[1])]=0;
  const less=(x,y)=>x.f-y.f||x.h-y.h||x.i-y.i||x.j-y.j;
  while(open.length){open.sort(less);const c=open.shift(),ck=key(c.i,c.j);if(closed.has(ck))continue;closed.add(ck);
    if(c.i===t[0]&&c.j===t[1]){const cells=[];let k=ck;while(k){const [ci,cj]=k.split(',').map(Number);cells.unshift([ci,cj]);k=from[k];}
      const len=c.g+Math.hypot((s[0]+0.5)*g-a[0],(s[1]+0.5)*g-a[1])+Math.hypot((t[0]+0.5)*g-b[0],(t[1]+0.5)*g-b[1]);
      return {len_mm:len,cells};}
    for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){if(!di&&!dj)continue;
      const ni=c.i+di,nj=c.j+dj,nk=key(ni,nj);if(!free.has(nk)||closed.has(nk))continue;
      if(di&&dj&&(!free.has(key(c.i+di,c.j))||!free.has(key(c.i,c.j+dj))))continue;              // no corner cutting
      const ng=c.g+(di&&dj?Math.SQRT2:1)*g;
      if(gs[nk]===undefined||ng<gs[nk]-1e-9){gs[nk]=ng;from[nk]=ck;open.push({i:ni,j:nj,g:ng,f:ng+h(ni,nj),h:h(ni,nj)});}}}
  return null;}
// a door's frame in one room: origin = the approach point, u = along the wall, v = into that room
function prtFrame(o,approachPt){const n=trcDoorNormal(o),dot=(approachPt[0]-o.x)*n[0]+(approachPt[1]-o.y)*n[1],s=dot<0?-1:1;
  return {ox:approachPt[0],oy:approachPt[1],ux:Math.cos(o.ang||0),uy:Math.sin(o.ang||0),vx:n[0]*s,vy:n[1]*s};}
function prtToFrame(F,x,y){return [(x-F.ox)*F.ux+(y-F.oy)*F.uy,(x-F.ox)*F.vx+(y-F.oy)*F.vy];}
// degrees −180…180 of (x,y) seen from the origin; 0 = straight into the room
function prtBearing(F,x,y){const f=prtToFrame(F,x,y);return Math.atan2(f[0],f[1])*180/Math.PI;}
function prtCell(v,g){return Math.floor(v/g+1e-6);}                      // the epsilon: −1e-13 must not become cell −1
function prtResample(pts,step){const out=[];if(!pts||!pts.length)return out;out.push(pts[0].slice());
  let carry=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=trcDist(a,b);let pos=step-carry;
    while(pos<=L+1e-9&&L>0){const f=pos/L;out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);pos+=step;}
    carry=L-(pos-step);}
  const last=pts[pts.length-1],e=out[out.length-1];if(trcDist(e,last)>1e-6)out.push(last.slice());
  return out;}
function prtIdCmp(a,b){return (idNum(a)-idNum(b))||(a<b?-1:a>b?1:0);}

// the derived graph: plain JSON ------------------------------------------------------------------------------------------------
function prtGraph(level){const g=PRT.grid,rooms=allRooms(level),polys={},rids=[];
  rooms.forEach(e=>{const id=stkRoomId(e);if(id){polys[id]=e.rm.poly;rids.push(id);}});rids.sort(prtIdCmp);
  const odoors=trcUsableDoors(level).slice().sort((p,q)=>prtIdCmp(p.id,q.id)),byId={};
  const doors=odoors.map(o=>{byId[o.id]=o;const tags=mrkOpeningTags(o.id),rr=mrkDoorRooms(o).map(e=>e?stkRoomId(e):null);
    return {id:o.id,x:Math.round(o.x),y:Math.round(o.y),ang:o.ang||0,w:o.w||0,tier:mrkDoorTier(o.id),tags,open:tags.indexOf('nyitva')>=0,
      anchor:tags.indexOf('bejarat')>=0?'house':tags.indexOf('lepcso')>=0?'floor':null,rooms:rr};});
  const dInfo={};doors.forEach(d=>{dInfo[d.id]=d;});
  const into=(d,rid)=>{const o=byId[d.id],n=trcDoorNormal(o),s=d.rooms[0]===rid?1:-1;return trcRound([o.x+n[0]*s*TRC.approach,o.y+n[1]*s*TRC.approach]);};
  const edges=[];
  rids.forEach(rid=>{const ds=doors.filter(d=>d.rooms.indexOf(rid)>=0);
    for(let i=0;i<ds.length;i++)for(let j=i+1;j<ds.length;j++){const A=ds[i],B=ds[j],pa=into(A,rid),pb=into(B,rid),poly=polys[rid];
      const d=Math.round(trcDist(pa,pb)),los=prtSegInPoly(pa,pb,poly);let dGrid=d;
      if(!los){const r=prtAStar(poly,pa,pb,g);dGrid=r?Math.round(r.len_mm):null;}
      edges.push({a:A.id,b:B.id,room:rid,d,los,dGrid,
        bearA:Math.round(prtBearing(prtFrame(byId[A.id],pa),pb[0],pb[1])),bearB:Math.round(prtBearing(prtFrame(byId[B.id],pb),pa[0],pa[1])),pa,pb});}});
  const traces=[],heat={};
  trcList().filter(t=>t.level===level&&t.plane==='floor'&&t.pts&&t.pts.length>=2).sort((p,q)=>prtIdCmp(p.id||'',q.id||'')).forEach(t=>{
    const rs=prtResample(t.pts,PRT.resample),cnt={};
    rs.forEach(p=>{const r=mrkRoomAtPt(level,p[0],p[1]);if(r){const id=stkRoomId(r);if(id)cnt[id]=(cnt[id]||0)+1;}});
    const room=Object.keys(cnt).sort((p,q)=>cnt[q]-cnt[p]||prtIdCmp(p,q))[0]||null,door=t.a?byId[t.a]:null;
    let cells,rel=false;
    if(door){const F=prtFrame(door,t.pts[0]);rel=true;cells=[];
      rs.forEach(p=>{const f=prtToFrame(F,p[0],p[1]),c=[prtCell(f[0],g),prtCell(f[1],g)],l=cells[cells.length-1];if(!l||l[0]!==c[0]||l[1]!==c[1])cells.push(c);});}
    else{cells=[];rs.forEach(p=>{const c=[prtCell(p[0],g),prtCell(p[1],g)],l=cells[cells.length-1];if(!l||l[0]!==c[0]||l[1]!==c[1])cells.push(c);});}
    const len=Math.round(trcLen(t.pts));let ratio=null;
    if(t.a&&t.b){const ed=edges.find(x=>x.room===room&&((x.a===t.a&&x.b===t.b)||(x.a===t.b&&x.b===t.a)));if(ed&&ed.dGrid)ratio=Math.round(len/ed.dGrid*100)/100;}
    traces.push({id:t.id,room,a:t.a||null,b:t.b||null,dir:t.dir,len,ratio,rel,cells});
    if(room){const seen=new Set(),h=heat[room]||(heat[room]={});
      rs.forEach(p=>{const k=prtCell(p[0],g)+','+prtCell(p[1],g);if(!seen.has(k)){seen.add(k);h[k]=(h[k]||0)+1;}});}});
  return {level,grid:g,doors,edges,traces,heat};}

// overlays: derived views, not drawing — both off by default ------------------------------------------------------------------------
function prtOverlaySvg(){if(!state.prtShow&&!state.prtHeat)return '';
  const level=state.active,z=dz(level,0),G=prtGraph(level),g=G.grid;let s='';
  if(state.prtHeat){Object.keys(G.heat).forEach(rid=>{const h=G.heat[rid],max=Math.max.apply(null,Object.keys(h).map(k=>h[k]));
    Object.keys(h).forEach(k=>{const [i,j]=k.split(',').map(Number);
      s+=`<polygon points="${p2b([[i*g,j*g,z],[(i+1)*g,j*g,z],[(i+1)*g,(j+1)*g,z],[i*g,(j+1)*g,z]])}" fill="#d0503a" fill-opacity="${(0.08+0.42*h[k]/max).toFixed(2)}" stroke="none"/>`;});});}
  if(state.prtShow){
    G.edges.forEach(e=>{
      if(e.los)s+=`<polyline points="${p2b([[e.pa[0],e.pa[1],z],[e.pb[0],e.pb[1],z]])}" fill="none" stroke="#3b6ea5" stroke-width="1.5" stroke-dasharray="6 4"/>`;
      else{const room=mrkRoomById(e.room),r=room&&prtAStar(room.rm.poly,e.pa,e.pb,g);
        if(r)s+=`<polyline points="${p2b([[e.pa[0],e.pa[1],z]].concat(r.cells.map(c=>[(c[0]+0.5)*g,(c[1]+0.5)*g,z])).concat([[e.pb[0],e.pb[1],z]]))}" fill="none" stroke="#3b6ea5" stroke-width="1.5" stroke-dasharray="1.5 4" stroke-linecap="round"/>`;}
      if(e.dGrid!=null)s+=mrkText((e.pa[0]+e.pb[0])/2,(e.pa[1]+e.pb[1])/2,z,(e.dGrid/1000).toFixed(1)+' m','#3b6ea5',9);});
    G.doors.forEach(d=>{const c=planToBase(d.x,d.y,z),f=d.open?'#fff':'#3b6ea5';
      s+=`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="8" fill="${f}" stroke="#3b6ea5" stroke-width="2"/>`;
      if(d.anchor)s+=`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="12" fill="none" stroke="#3b6ea5" stroke-width="1.5"/>`;});}
  return `<g pointer-events="none">`+s+`</g>`;}
STK_OVERLAY.push(prtOverlaySvg);

// a room with two or more doors but no trace between any two of them
(STK_CHECKS.mark=STK_CHECKS.mark||[]).push(S=>{const out=[];let G;try{G=prtGraph(state.active);}catch(_){return out;}
  const rooms={};G.doors.forEach(d=>{d.rooms.forEach(r=>{if(r)(rooms[r]=rooms[r]||[]).push(d.id);});});
  Object.keys(rooms).sort(prtIdCmp).forEach(rid=>{const ds=rooms[rid];if(ds.length<2)return;
    const linked=trcList().some(t=>t.level===G.level&&t.a&&t.b&&ds.indexOf(t.a)>=0&&ds.indexOf(t.b)>=0);
    if(!linked){const r=mrkRoomById(rid);out.push({sev:'warn',msg:((r&&r.rm.name)||rid)+': nincs mozgásnyom két ajtó között.'});}});
  return out;});

registerActions([
 {id:'portal.graph',alias:'portalgraf portal graph ajto el door edge',label:'Portálgráf mutatása',icon:'⛓',group:'Jelölés',
  hint:'Az ajtók mint csomópontok, a rálátás szerinti élek és távolságuk a szinten (levezetett nézet).',
  run:()=>{state.prtShow=!state.prtShow;draw();$('hud').textContent='Portálgráf '+(state.prtShow?'be':'ki');}},
 {id:'portal.heat',alias:'mozgas hotermekep heatmap movement',label:'Mozgás-hőtérkép',icon:'♨',group:'Jelölés',
  hint:'A mozgásnyomok 500 mm-es cellánkénti gyakorisága a szinten.',
  run:()=>{state.prtHeat=!state.prtHeat;draw();$('hud').textContent='Mozgás-hőtérkép '+(state.prtHeat?'be':'ki');}},
 {id:'portal.export',alias:'portalgraf export json graph',label:'Portálgráf exportálása (JSON)',icon:'⬇',group:'Jelölés',
  hint:'A szint portálgráfja JSON-ban — a jelenlét-motor (STD-003) bemenete.',
  run:()=>{download('portalgraph-'+state.active+'.json',JSON.stringify(prtGraph(state.active),null,1));}}
]);

// test hooks
window.TRC=TRC;window.PRT=PRT;window.trcList=trcList;window.trcStep=trcStep;window.trcRdp=trcRdp;window.trcChaikin=trcChaikin;window.trcSmooth=trcSmooth;
window.trcDoorNear=trcDoorNear;window.trcApproach=trcApproach;window.trcAttach=trcAttach;window.trcFinish=trcFinish;window.trcCommit=trcCommit;window.trcSvg=trcSvg;
window.trcSceneSvg=trcSceneSvg;window.trcHit=trcHit;window.trcMenu=trcMenu;window.trcReverse=trcReverse;window.trcToggleDir=trcToggleDir;window.trcSmoothNow=trcSmoothNow;
window.trcReattach=trcReattach;window.trcIsMode=trcIsMode;window.trcCancel=trcCancel;window.trcAlong=trcAlong;window.trcLen=trcLen;
window.prtSegInPoly=prtSegInPoly;window.prtGrid=prtGrid;window.prtAStar=prtAStar;window.prtFrame=prtFrame;window.prtToFrame=prtToFrame;window.prtBearing=prtBearing;
window.prtGraph=prtGraph;window.prtResample=prtResample;window.prtOverlaySvg=prtOverlaySvg;
