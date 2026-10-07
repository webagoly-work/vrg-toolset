// ==========================================================================
// 05p-hardware.js — the hardware nodes of a BRIDGE Stack (WP-C1, C2, C4)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Hardware nodes are DEVICES with their own `type` (rbx, base, meter, entry, ssc; the Elosztószekrény is the
// existing `board`), so they inherit placement, room membership, links to routes, ids and undo.
//   rbx  {rb:'RB-M', serves:null|[roomId…], radios:['thread',…]}   serves null = automatic (C2)
//   base {units:['NET','COMP','MEDIA']}                              any non-empty subset (C4)
// A device sits on the FACE of its wall (x,y = the face point, side = which face), so deviceHostWall (05h)
// and the Wall View agree on the side. Its 3D box is DERIVED at draw time (STK_BOXES) — never stored, so it
// can never go stale when the device moves. Prefix: hw.

const HW_TYPES={rbx:'RoomBox (RBX)',base:'BASE',meter:'Mérőóra',entry:'Adatbelépési pont',ssc:'Biztonsági központ (SSC)'};
// RoomBox classes, w × h × d mm (Outline §3). RB-E is its own class family; sized as RB-M until STD-001 fixes it.
const HW_RB={'RB-M':[400,500,110],'RB-L':[500,600,110],'RB-H':[600,600,120],'RB-E':[400,500,110],'RB-O':[400,500,150],'RB-S':[300,400,110]};
const HW_RB_DEF='RB-M';
const HW_BASE_UNITS={NET:{n:'NET — kommunikáció',c:'#3b82c4'},COMP:{n:'COMP — koordinátor',c:'#3fa36b'},MEDIA:{n:'MEDIA — tárolás, streamek',c:'#c2638a'}};
const HW_UNIT_ORDER=['NET','COMP','MEDIA'];
const HW_BASE_SIZE=[600,1800,400];   /*r*/ // one column, units stacked; the real size comes from the joinery design
// per type: default centre height (mm), plan label, body colour, the stack role whose layer it goes on,
// the vertical-strip tag it is attracted to (05n), and a size for the types without a class table
const HW_DEF={
 rbx:  {h:2150,lbl:'RBX', col:'#c9d6e3',role:'hw',  strip:'rbx'},   // STD-001-A1: bottom ≥ 1.90 m → RB-M centred at 2150 spans 1900–2400
 board:{h:2000,lbl:'EL',  col:'#ffe9b0',role:'hw',  strip:'elo'},
 meter:{h:1500,lbl:'kWh', col:'#d8d2c4',role:'hw',  size:[300,450,150]},   /*r*/
 entry:{h:300, lbl:'ISP', col:'#cfe3d4',role:'hw',  size:[200,300,100]},   /*r*/
 ssc:  {h:1800,lbl:'SSC', col:'#e3cfcf',role:'hw',  strip:'ssc',size:[400,500,120]},   /*r*/
 base: {h:900, lbl:'BASE',col:'#dfe6ef',role:'base',strip:'base'}};
// guidance shown while placing BASE (C4). sev = what a violation raises. mm values reasoned, not measured.
const HW_BASE_RULES=[
 {k:'dry',    sev:'error',n:'BASE nem kerülhet nedves / vizes helyiségbe.'},
 {k:'board',  sev:'warn', n:'BASE az Elosztószekrény közelében: PANEL LINK + 2–3 rendszerkör. Javasolt ≤ 8 m.', mm:8000},
 {k:'entry',  sev:'info', n:'NET az adatbelépési pont közelében (≤ 10 m).', mm:10000},
 {k:'column', sev:'warn', n:'NET · COMP · MEDIA egy oszlopban (≤ 1 m), hacsak nem szándékosan osztott (LAYER TIE).', mm:1000},
 {k:'centre', sev:'info', n:'A szint közepéhez közel: jobb rádiós lefedettség és UWB/BLE helymeghatározás.'},
 {k:'strip',  sev:'info', n:'Jelölt „BASE helye” sávban.'},
 {k:'cat6a',  sev:'error',n:'Minden RBX ≤ 90 m Cat6A nyomvonalon (állandó link, ISO/IEC 11801).', mm:90000}];
Object.assign(DEV,HW_TYPES);            // DEV (02-state) names device types everywhere — an earlier const, safe at load

// ---- records ---------------------------------------------------------------------------------------------------
function hwIs(d){return !!(d&&HW_TYPES[d.type]);}
function hwList(type,level){return data.devices.filter(d=>d&&(type?d.type===type:(hwIs(d)||d.type==='board'))&&(!level||d.level===level));}
function hwDefRadios(){return (typeof RF_RBX_RADIOS!=='undefined')?RF_RBX_RADIOS.slice():['thread','ble','espnow'];}   // 05q may be absent
function hwUnits(d){return (d&&Array.isArray(d.units)&&d.units.length)?HW_UNIT_ORDER.filter(u=>d.units.indexOf(u)>=0):HW_UNIT_ORDER.slice();}
// {w, ht, dp} — width along the wall, height, depth into the wall
function hwSize(d){
  if(d.type==='rbx'){const s=HW_RB[d.rb]||HW_RB[HW_RB_DEF];return {w:s[0],ht:s[1],dp:s[2]};}
  if(d.type==='base'){const n=hwUnits(d).length;return {w:HW_BASE_SIZE[0],ht:Math.max(600,Math.round(HW_BASE_SIZE[1]*n/3)),dp:HW_BASE_SIZE[2]};}
  if(d.type==='board')return {w:d.rw||BOARD_RW,ht:800,dp:d.rd||BOARD_RD};
  const s=(HW_DEF[d.type]||{}).size||[300,300,100];return {w:s[0],ht:s[1],dp:s[2]};}
function hwDefH(type,units){if(type==='base')return Math.round(hwSize({type,units}).ht/2);   // stands on the floor
  return (HW_DEF[type]||{h:1500}).h;}
// the wall a device sits on — {r, wi, px, py, nx, ny} (05h), or null when it stands free
function hwHost(d){return (typeof deviceHostWall==='function'&&d&&d.side!=null)?deviceHostWall(d):null;}
// where the body is in plan: centre, angle, the face normal it looks along. A wall box is recessed with its front
// 10 mm proud of the face (a RoomBox lives IN the wall); a free-standing one is centred on its point.
function hwFrame(d){const S=hwSize(d),h=hwHost(d);
  if(!h)return {cx:d.x,cy:d.y,ang:d.ang||0,n:null,S,host:null};
  const fx=h.px+h.nx*h.wi.thick/2,fy=h.py+h.ny*h.wi.thick/2,k=10-S.dp/2;
  return {cx:fx+h.nx*k,cy:fy+h.ny*k,ang:h.wi.horiz?0:Math.PI/2,n:[h.nx,h.ny],S,host:h};}
// the 3D box of a device: object-shaped, so pushObj (04-render) draws it
function hwBox(d){const F=hwFrame(d);
  return {level:d.level,x:F.cx,y:F.cy,z:Math.max(0,(d.h||0)-F.S.ht/2),w:F.S.w,d:F.S.dp,ht:F.S.ht,ang:F.ang,
    color:(HW_DEF[d.type]||{}).col||'#ccc',layer:d.layer,name:HW_TYPES[d.type]||d.type,hwFor:d.id};}
function hwFootprint(d,z){const F=hwFrame(d),c=Math.cos(F.ang),s=Math.sin(F.ang),hw=F.S.w/2,hd=F.S.dp/2;
  const P=(u,v)=>[F.cx+c*u-s*v,F.cy+s*u+c*v,z];return [P(-hw,-hd),P(hw,-hd),P(hw,hd),P(-hw,hd)];}
// the room number a box is keyed to (STD-004: boxes keyed to their room) — the last digit group of num
function hwRoomNo(roomId){const e=mrkRoomById(roomId),num=e&&e.rm.num?String(e.rm.num):'';const m=/(\d+)\D*$/.exec(num);
  return m?(m[1].length<2?'0'+m[1]:m[1]):null;}
function hwRef(d){
  if(d.type==='rbx'){const own=hwAutoServes(d)[0],no=own?hwRoomNo(own):null;
    let base='RBX'+(no||String(hwList('rbx').indexOf(d)+1).padStart(2,'0')),ref=base,k=0;
    while(hwList('rbx').some(x=>x!==d&&x.ref===ref))ref=base+String.fromCharCode(98+(k++));   // RBX03, RBX03b …
    return ref;}
  const pre={base:'BASE',meter:'MÉRŐ',entry:'ISP',ssc:'SSC'}[d.type]||d.type.toUpperCase();
  const n=hwList(d.type).filter(x=>x!==d).length;return n?pre+(n+1):pre;}

// ---- symbols: plan, Wall View, 3D ------------------------------------------------------------------------------------
function hwSymbol(d,x,y,k,back){if(!hwIs(d))return null;
  const z=dz(d.level,d.h||0),F=hwFrame(d),col=back?'#9299a0':'#222',def=HW_DEF[d.type],c=planToBase(F.cx,F.cy,z);
  const lbl=d.type==='base'?hwUnits(d).map(u=>u[0]).join('·'):def.lbl,R=v=>+(v*k).toFixed(2);
  let s=`<polygon points="${p2b(hwFootprint(d,z))}" fill="${def.col}" stroke="${col}" stroke-width="${R(1.6)}"/>`;
  s+=`<text x="${c[0].toFixed(1)}" y="${(c[1]+R(3.5)).toFixed(1)}" font-size="${R(10)}" text-anchor="middle" font-weight="700" fill="${col}">${esc(lbl)}</text>`;
  if(d.type==='rbx')s+=`<text x="${c[0].toFixed(1)}" y="${(c[1]+R(13)).toFixed(1)}" font-size="${R(7.5)}" text-anchor="middle" fill="${col}">${esc(d.rb||HW_RB_DEF)}</text>`;
  return s;}
STK_DEVSYM.push(hwSymbol);
// Wall View / Plane View: the real body, centred on the device's height
function hwWvBox(dv,x,y,sc,col,back){const d=data.devices[dv.di];if(!hwIs(d))return null;
  const S=hwSize(d),w=S.w*sc,h=S.ht*sc,def=HW_DEF[d.type];
  let s=`<rect x="${(x-w/2).toFixed(1)}" y="${(y-h/2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${back?'#eef0f2':def.col}" stroke="${col}" stroke-width="1.4"${back?' stroke-dasharray="4 3"':''}/>`;
  if(d.type==='base'){const us=hwUnits(d),bh=h/us.length;us.forEach((u,i)=>{
    s+=`<rect x="${(x-w/2).toFixed(1)}" y="${(y-h/2+i*bh).toFixed(1)}" width="${w.toFixed(1)}" height="${bh.toFixed(1)}" fill="${HW_BASE_UNITS[u].c}" fill-opacity="0.25" stroke="none"/>`
      +`<text x="${x.toFixed(1)}" y="${(y-h/2+i*bh+bh/2+3).toFixed(1)}" font-size="9" text-anchor="middle" fill="${col}">${u}</text>`;});}
  else s+=`<text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" font-size="10" text-anchor="middle" font-weight="700" fill="${col}">${esc(def.lbl)}</text>`;
  if(d.type==='rbx')s+=`<text x="${x.toFixed(1)}" y="${(y+14).toFixed(1)}" font-size="8" text-anchor="middle" fill="${col}">${esc(d.rb||HW_RB_DEF)}</text>`;
  return s;}
STK_WVBOX.push(hwWvBox);
STK_BOXES.push(()=>hwList().filter(d=>hwIs(d)&&layerShows(d,'device')).map(hwBox));

// ---- room serving (C2) -------------------------------------------------------------------------------------------------
// the rooms on the two faces of the box's wall, front first [Q21=A: both faces]; a free-standing box: its own room
function hwAutoServes(d){const h=hwHost(d);
  if(!h){const r=(typeof roomOfDevice==='function')?roomOfDevice(d):null;return r&&stkRoomId(r)?[stkRoomId(r)]:[];}
  const side=Math.sign(h.nx*h.wi.perp[0]+h.ny*h.wi.perp[1])||1,u=mrkU(h.r,d.x,d.y),out=[];
  [side,-side].forEach(s=>{const e=mrkRoomOfFace(d.level,h.r,s,u),id=e&&stkRoomId(e);if(id&&out.indexOf(id)<0)out.push(id);});
  return out;}
// every room has exactly ONE RoomBox [Q22=A]. Claims are ranked: a manual list (d.serves) first, then the room a box
// faces, then the room behind its wall; ties go to the lower id. `dup` lists rooms two equal-rank claims fight over.
function hwServeMap(){const claims={};
  const add=(rid,d,p)=>{if(!rid)return;(claims[rid]=claims[rid]||[]).push({d,p});};
  hwList('rbx').forEach(d=>{if(Array.isArray(d.serves))d.serves.forEach(r=>add(r,d,0));else hwAutoServes(d).forEach((r,i)=>add(r,d,i===0?1:2));});
  const own={},dup={};
  Object.keys(claims).forEach(r=>{const c=claims[r].sort((a,b)=>a.p-b.p||prtIdCmp(a.d.id||'',b.d.id||''));own[r]=c[0].d;
    const top=c.filter(x=>x.p===c[0].p);if(top.length>1)dup[r]=top.map(x=>x.d);});
  return {own,dup};}
function hwServes(d){const M=hwServeMap();return Object.keys(M.own).filter(r=>M.own[r]===d&&mrkRoomById(r)).sort(prtIdCmp);}
function hwRoomRbx(roomId){return hwServeMap().own[roomId]||null;}
function hwUnserved(level){const own=hwServeMap().own;return stkRooms(level).filter(r=>r.id&&!own[r.id]);}

// pick mode: clicks on rooms toggle them in the box's own list
let HW_SP=null;                                       // {id: rbx device id, pushed}
function hwServePick(d){if(!d||d.type!=='rbx')return;if(state.mode!=='select')setMode('select');
  if(typeof mrkToolsOff==='function')mrkToolsOff();HW_T.on=false;
  HW_SP={id:d.id,pushed:false};lyrHud('Helyiségek hozzárendelése: '+(d.ref||d.id)+' — kattints a helyiségekre · Enter / Esc: kész');draw();}
function hwServeToggle(rid){const d=byId('devices',HW_SP&&HW_SP.id);if(!d||!rid)return false;
  if(!HW_SP.pushed){pushUndo(['devices']);HW_SP.pushed=true;}
  if(!Array.isArray(d.serves))d.serves=hwServes(d).slice();
  const i=d.serves.indexOf(rid);
  if(i>=0){d.serves.splice(i,1);lyrHud('Levéve: '+hwRoomLabel(rid));draw();return true;}
  const other=hwRoomRbx(rid);
  if(other&&other!==d){if(!confirm(hwRoomLabel(rid)+' jelenleg: '+(other.ref||other.id)+'. Átteszed ide?'))return false;
    other.serves=hwServes(other).filter(x=>x!==rid);}
  d.serves.push(rid);lyrHud('Hozzáadva: '+hwRoomLabel(rid));draw();return true;}
function hwRoomLabel(rid){const e=mrkRoomById(rid);return e?((e.rm.num?e.rm.num+' ':'')+(e.rm.name||rid)):rid;}
STK_TOOLS.push({k:'hwServe',active:()=>{if(!HW_SP)return false;if(state.mode!=='select'||!byId('devices',HW_SP.id)){HW_SP=null;return false;}return true;},
  down(e){if(e.button!==0)return false;const rh=roomHitAt(e);if(!rh)return false;hwServeToggle(stkRoomId(rh));return true;},
  key(e){if(e.key==='Enter'){HW_SP=null;lyrHud('Hozzárendelés kész.');draw();return true;}return false;},
  esc(){HW_SP=null;draw();}});

// ---- the placement tool (C1) ----------------------------------------------------------------------------------------------
let HW_T={on:false,type:'rbx',rb:HW_RB_DEF,units:HW_UNIT_ORDER.slice(),g:null};
// the nearest visible wall within 16 px at height h, the face the pointer is on, the position along it
function hwPick(e,h){const level=state.active,[bx,by]=clientToBase(e),zz=dz(level,h||0);let best=null,bd=16/state.zoom;
  (WALLS[level]||[]).forEach(r=>{if(!r||!r.id||!layerShows(r,'wall'))return;const w=wallDist(r,bx,by,zz);if(w.d<bd){bd=w.d;best=r;}});
  if(!best)return null;
  const p=baseToPlan(bx,by,zz),wi=wallInfo(best),a=wi.seg[0],off=(p[0]-a[0])*wi.perp[0]+(p[1]-a[1])*wi.perp[1];
  return {level,r:best,id:best.id,u:mrkU(best,p[0],p[1]),side:off>=0?1:-1};}
// the ghost of what a click would place. A box is attracted to a vertical strip carrying its tag within 400 mm along
// the same face; a `ban` mark under it turns it red (placement is still allowed — the check warns).
function hwGhost(e){const t=HW_T.type,h=hwDefH(t,HW_T.units),pk=hwPick(e,h);
  if(!pk){if(t!=='base')return null;                     // a BASE column may stand free in a room
    const [bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(state.active,0));
    return {type:t,level:state.active,x:Math.round(p[0]),y:Math.round(p[1]),free:true,h,ban:[],snapped:false};}
  return hwGhostFrom(pk,t,h);}
// the same from a plan point (scripts, tests): the nearest visible wall within `tol` mm
function hwPickPlan(level,x,y,tol){let best=null,bd=tol||400;
  (WALLS[level]||[]).forEach(r=>{if(!r||!r.id||!layerShows(r,'wall'))return;const wi=wallInfo(r),a=wi.seg[0],b=wi.seg[1],nr=nearestOnSegPlain(x,y,a[0],a[1],b[0],b[1]);
    if(nr.d<bd){bd=nr.d;best=r;}});
  if(!best)return null;const wi=wallInfo(best),a=wi.seg[0],off=(x-a[0])*wi.perp[0]+(y-a[1])*wi.perp[1];
  return {level,r:best,id:best.id,u:mrkU(best,x,y),side:off>=0?1:-1};}
function hwGhostAt(type,level,x,y){const h=hwDefH(type,HW_T.units),pk=hwPickPlan(level,x,y);
  if(!pk)return type==='base'?{type,level,x:Math.round(x),y:Math.round(y),free:true,h,ban:[],snapped:false}:null;
  return hwGhostFrom(pk,type,h);}
function hwGhostFrom(pk,t,h){const def=HW_DEF[t];
  let u=pk.u,snapped=false;
  if(def.strip&&typeof mrkList==='function'){let best=null,bd=400;
    mrkList().forEach(m=>{if(m.kind!=='vstrip'||m.level!==pk.level||m.wall!==pk.id||m.side!==pk.side||(m.tags||[]).indexOf(def.strip)<0)return;
      const c=(m.u0+m.u1)/2,dd=Math.abs(c-u);if(dd<bd){bd=dd;best=c;}});
    if(best!=null){u=best;snapped=true;}}
  u=Math.round(Math.max(0,Math.min(mrkWallLen(pk.r),u)));
  const onCentre=t==='board',p=mrkFacePt(pk.r,pk.side,u,onCentre?-wallInfo(pk.r).thick/2:0);      // the board keeps its centreline convention
  const ban=(typeof mrkAt==='function')?mrkAt(pk.level,pk.id,pk.side,u,h).filter(x=>x.pol==='ban'):[];
  return {type:t,level:pk.level,x:Math.round(p[0]),y:Math.round(p[1]),side:pk.side>0?1:0,wall:pk.id,u,h,
    ang:wallInfo(pk.r).horiz?0:Math.PI/2,snapped,ban};}
// the device a ghost turns into (not yet in data)
function hwFromGhost(g){const t=g.type,S=(typeof stkActive==='function')?stkActive():null,L=S?stkLayer(S.id,HW_DEF[t].role):null;
  const d={type:t,level:g.level,x:g.x,y:g.y,h:g.h,layer:L?L.id:state.activeLayer};
  if(!g.free)d.side=g.side;
  if(t==='rbx'){d.rb=HW_T.rb;d.serves=null;d.radios=hwDefRadios();}
  if(t==='base'){d.units=HW_T.units.slice();d.h=hwDefH('base',d.units);}
  if(t==='board'){Object.assign(d,{h:BOARD_DEFAULT_Z,z:BOARD_DEFAULT_Z,rw:BOARD_RW,rd:BOARD_RD,ang:g.ang||0,autoObj:true});delete d.side;}
  return d;}
function hwPlace(g){if(!g)return null;const d=hwFromGhost(g);
  pushUndo(['devices','objects']);data.devices.push(d);ensureIds(data);
  if(d.type==='board'){if(typeof ensureBoardObject==='function')ensureBoardObject(d);if(!d.ref)d.ref='EL'+(hwList('board').length>1?hwList('board').length:'1');}
  else d.ref=hwRef(d);
  draw();
  lyrHud((HW_TYPES[d.type]||DEV[d.type]||d.type)+' elhelyezve: '+d.ref+(g.ban&&g.ban.length?' — figyelem: tilos zóna ('+g.ban.map(b=>(b.tags||[]).join(',')||'⛔').join('; ')+')':''));
  return d;}
function hwToolStart(type){if(typeof mrkToolsOff==='function')mrkToolsOff();HW_SP=null;
  if(state.mode!=='select')setMode('select');
  if(type==='base'){hwBaseUnitPicker(units=>{Object.assign(HW_T,{on:true,type,units,g:null});hwHint();draw();});return;}
  HW_T.on=true;HW_T.type=type;HW_T.g=null;hwHint();draw();}
function hwHint(){const mh=$('modeHint');if(!mh)return;
  mh.textContent=HW_T.on?((HW_TYPES[HW_T.type]||'Elosztószekrény')+' elhelyezése'+(HW_T.type==='rbx'?' · '+HW_T.rb+' · Tab: osztály':'')
    +(HW_T.type==='base'?' · '+HW_T.units.join(' + '):'')+' · Esc kilép'):(typeof HINTS!=='undefined'?HINTS[state.mode]||'':'');}
function hwToolOff(){HW_T.on=false;HW_T.g=null;hwHint();}
STK_TOOLS.push({k:'hwPlace',active:()=>{if(!HW_T.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){hwToolOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const g=hwGhost(e);if(!g)return false;HW_T.g=g;hwPlace(g);return true;},
  move(e){HW_T.g=hwGhost(e);draw();return false;},
  key(e){if(e.key==='Tab'&&HW_T.type==='rbx'){e.preventDefault();const ks=Object.keys(HW_RB),i=ks.indexOf(HW_T.rb);
    HW_T.rb=ks[(i+(e.shiftKey?ks.length-1:1))%ks.length];hwHint();lyrHud('RB osztály: '+HW_T.rb+' ('+HW_RB[HW_T.rb].join(' × ')+' mm)');draw();return true;}
    return false;},
  esc(){hwToolOff();draw();}});

// ---- overlay: the ghost, its coverage, guidance ------------------------------------------------------------------------------
function hwRoomPolyId(rid){const e=mrkRoomById(rid);return e?e.rm.poly:null;}
// direct coverage: the served rooms tinted, and a half-disc field on each face that has a room, clipped to it
function hwCoverageSvg(d,rooms,tag){const z=dz(d.level,0);let s='';
  rooms.forEach((rid,i)=>{const poly=hwRoomPolyId(rid);if(!poly)return;
    s+=`<polygon points="${p2b(poly.map(p=>[p[0],p[1],z]))}" fill="#3b82c4" fill-opacity="0.10" stroke="#3b82c4" stroke-width="0.5"/>`;
    const h=hwHost(d);if(!h)return;
    const side=Math.sign(h.nx*h.wi.perp[0]+h.ny*h.wi.perp[1])||1,u=mrkU(h.r,d.x,d.y);
    [side,-side].forEach(sg=>{const e=mrkRoomOfFace(d.level,h.r,sg,u);if(!e||stkRoomId(e)!==rid)return;
      const bb=polyBBox(poly),R=Math.min(3000,Math.hypot(bb.x1-bb.x0,bb.y1-bb.y0)/2),f=mrkFacePt(h.r,sg,u,0);
      const nx=h.wi.perp[0]*sg,ny=h.wi.perp[1]*sg,a0=Math.atan2(ny,nx),pts=[[f[0],f[1],z]];
      for(let k=0;k<=24;k++){const a=a0-Math.PI/2+k*Math.PI/24;pts.push([f[0]+Math.cos(a)*R,f[1]+Math.sin(a)*R,z]);}
      const id='hwcv-'+tag+'-'+i+'-'+(sg>0?'p':'n');
      s+=`<clipPath id="${id}"><polygon points="${p2b(poly.map(p=>[p[0],p[1],z]))}"/></clipPath>`
        +`<g clip-path="url(#${id})"><polygon points="${p2b(pts)}" fill="#3b82c4" fill-opacity="0.16" stroke="none"/></g>`;});});
  return s;}
function hwUnservedSvg(level){const z=dz(level,0);const us=hwUnserved(level);if(!us.length)return '';
  return `<defs><pattern id="hwhatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#c8372d" stroke-width="1.2"/></pattern></defs>`
    +us.map(r=>`<polygon points="${p2b(r.poly.map(p=>[p[0],p[1],z]))}" fill="url(#hwhatch)" fill-opacity="0.25" stroke="none"/>`).join('');}
function hwStageIs(role){const S=(typeof stkActive==='function')?stkActive():null;if(!S)return false;
  const L=lyrLayer(state.activeLayer);return !!(L&&L.stack===S.id&&L.role===role);}
function hwOverlaySvg(){let s='';const level=state.active;
  if(hwStageIs('hw'))s+=hwUnservedSvg(level);
  // the selected RBX (or the one being assigned) shows what it covers
  const sd=HW_SP?byId('devices',HW_SP.id):((typeof selected!=='undefined'&&selected&&selected.t==='devices')?data.devices[selected.i]:null);
  if(sd&&sd.type==='rbx'&&state.levels[sd.level]){s+=hwCoverageSvg(sd,hwServes(sd),'sel');
    if(state.hwCloud&&typeof rfCoverageSvg==='function')s+=rfCoverageSvg([sd]);}
  if(sd&&sd.type==='base'&&state.levels[sd.level])s+=hwBaseGuideSvg(sd);
  const g=HW_T.on?HW_T.g:null;
  if(g){const d=hwFromGhost(g);d.id='ghost';
    if(d.type==='rbx'){s+=hwCoverageSvg(d,hwAutoServes(d),'gh');if(state.hwCloud&&typeof rfCoverageSvg==='function')s+=rfCoverageSvg([d]);}
    if(d.type==='base')s+=hwBaseGuideSvg(d);
    const z=dz(d.level,d.h||0),col=g.ban&&g.ban.length?'#c8372d':(d.type==='base'?hwBaseWorst(d):g.snapped?'#2e9e5b':'#2f6fb0');
    if(d.type==='board'){const c=planToBase(d.x,d.y,z);s+=`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="10" fill="none" stroke="${col}" stroke-width="2.5" stroke-dasharray="4 3"/>`;}
    else s+=`<polygon points="${p2b(hwFootprint(d,z))}" fill="${col}" fill-opacity="0.25" stroke="${col}" stroke-width="2"/>`;}
  return s?`<g pointer-events="none">`+s+`</g>`:'';}
STK_OVERLAY.push(hwOverlaySvg);

// ---- BASE (C4) -------------------------------------------------------------------------------------------------------------------
function hwBasePlaced(except){const m={};hwList('base').forEach(d=>{if(d===except)return;hwUnits(d).forEach(u=>{if(!m[u])m[u]=d;});});return m;}
function hwBaseUnitPicker(ok,dev){const placed=hwBasePlaced(dev),cur=dev?hwUnits(dev):HW_UNIT_ORDER.filter(u=>!placed[u]);
  openModal(dev?'BASE egységek':'BASE elhelyezése — egységek',
    HW_UNIT_ORDER.map(u=>`<div class="mrow"><label><input type="checkbox" class="hbU" value="${u}" ${cur.indexOf(u)>=0&&!placed[u]?'checked':''} ${placed[u]?'disabled':''}> <b style="color:${HW_BASE_UNITS[u].c}">${u}</b> — ${esc(HW_BASE_UNITS[u].n.split(' — ')[1]||'')}`
      +(placed[u]?` <span style="color:#888">(már elhelyezve: ${esc(placed[u].ref||placed[u].id)})</span>`:'')+`</label></div>`).join('')
    +`<div class="mrow" style="font-size:11px;color:#888">Mindhárom = a teljes BASE egy oszlopként. Külön elhelyezve = osztott BASE (LAYER TIE).</div>`,
    ()=>{const us=[...document.querySelectorAll('.hbU')].filter(c=>c.checked&&!c.disabled).map(c=>c.value);
      if(!us.length){lyrHud('Legalább egy egységet válassz.');return false;}ok(us);});}
function hwSetUnits(d,units){units=HW_UNIT_ORDER.filter(u=>units.indexOf(u)>=0);if(!units.length)return false;
  const placed=hwBasePlaced(d);if(units.some(u=>placed[u]))return false;            // a unit lives in one device only
  pushUndo(['devices']);d.units=units;d.h=hwDefH('base',units);draw();return true;}
// the level's area-weighted room centroid and its bbox diagonal
function hwLevelCentre(level){let A=0,cx=0,cy=0,x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;
  allRooms(level).forEach(e=>{const p=e.rm.poly;let a=0,qx=0,qy=0;
    for(let i=0,j=p.length-1;i<p.length;j=i++){const f=p[j][0]*p[i][1]-p[i][0]*p[j][1];a+=f;qx+=(p[j][0]+p[i][0])*f;qy+=(p[j][1]+p[i][1])*f;
      x0=Math.min(x0,p[i][0]);y0=Math.min(y0,p[i][1]);x1=Math.max(x1,p[i][0]);y1=Math.max(y1,p[i][1]);}
    if(Math.abs(a)>1e-6){A+=a/2;cx+=qx/6;cy+=qy/6;}});
  if(!A)return null;return {x:cx/A,y:cy/A,diag:Math.hypot(x1-x0,y1-y0)};}
function hwNearest(type,d){let best=null,bd=1e18;hwList(type).forEach(o=>{if(o===d||o.level!==d.level)return;const dd=Math.hypot(o.x-d.x,o.y-d.y);if(dd<bd){bd=dd;best=o;}});
  return best?{d:best,mm:bd}:null;}
// → [{k, sev, ok, msg}] for a BASE device (placed or a ghost)
function hwBaseRules(d){const out=[],R=k=>HW_BASE_RULES.find(r=>r.k===k),us=hwUnits(d);
  const push=(k,ok,extra)=>{const r=R(k);out.push({k,sev:r.sev,ok,msg:r.n+(extra?' — '+extra:'')});};
  const room=(typeof roomOfDevice==='function')?roomOfDevice(d):null,env=room&&room.rm.env;
  push('dry',!(env==='nedves'||env==='vizes'),room?(room.rm.name||''):'');
  const b=hwNearest('board',d);push('board',!!b&&b.mm<=R('board').mm,b?(b.mm/1000).toFixed(1)+' m':'nincs Elosztószekrény');
  if(us.indexOf('NET')>=0){const en=hwNearest('entry',d);push('entry',!!en&&en.mm<=R('entry').mm,en?(en.mm/1000).toFixed(1)+' m':'nincs adatbelépés');}
  const others=hwList('base').filter(o=>o!==d&&o.id!==d.id&&o.level===d.level);
  if(others.length){const far=others.filter(o=>Math.hypot(o.x-d.x,o.y-d.y)>R('column').mm);push('column',!far.length,far.length?far.map(o=>o.ref||o.id).join(', '):'');}
  const c=hwLevelCentre(d.level);if(c)push('centre',Math.hypot(c.x-d.x,c.y-d.y)<=0.2*c.diag,'');
  const h=hwHost(d);let inStrip=false;
  if(h&&typeof mrkList==='function'){const side=Math.sign(h.nx*h.wi.perp[0]+h.ny*h.wi.perp[1])||1,u=mrkU(h.r,d.x,d.y);
    inStrip=mrkList().some(m=>m.kind==='vstrip'&&m.wall===h.r.id&&m.side===side&&u>=m.u0&&u<=m.u1&&(m.tags||[]).indexOf('base')>=0);}
  push('strip',inStrip,'');
  if(typeof chnLenToBase==='function'&&d.id&&d.id!=='ghost'){const long=hwList('rbx').filter(x=>{const L=chnLenToBase(x.id,d.id);return L!=null&&L>R('cat6a').mm;});
    push('cat6a',!long.length,long.map(x=>(x.ref||x.id)+' '+(chnLenToBase(x.id,d.id)/1000).toFixed(0)+' m').join(', '));}
  return out;}
function hwBaseWorst(d){const bad=hwBaseRules(d).filter(r=>!r.ok);
  return bad.some(r=>r.sev==='error')?'#c8372d':bad.some(r=>r.sev==='warn')?'#d08a1e':'#2e9e5b';}
// rings around the boards and the data entries, wet rooms hatched, the level centre, lines to the other units
function hwBaseGuideSvg(d){const z=dz(d.level,0),R=k=>HW_BASE_RULES.find(r=>r.k===k);let s='';
  const ring=(o,mm,col)=>{const pts=[];for(let i=0;i<=48;i++){const a=i*Math.PI/24;pts.push([o.x+Math.cos(a)*mm,o.y+Math.sin(a)*mm,z]);}
    return `<polygon points="${p2b(pts)}" fill="${col}" fill-opacity="0.05" stroke="${col}" stroke-width="1" stroke-dasharray="6 4"/>`;};
  hwList('board',d.level).forEach(b=>{s+=ring(b,R('board').mm,'#2e9e5b');});
  if(hwUnits(d).indexOf('NET')>=0)hwList('entry',d.level).forEach(en=>{s+=ring(en,R('entry').mm,'#3b82c4');});
  allRooms(d.level).forEach(e=>{if(e.rm.env==='nedves'||e.rm.env==='vizes')
    s+=`<polygon points="${p2b(e.rm.poly.map(p=>[p[0],p[1],z]))}" fill="#c8372d" fill-opacity="0.12" stroke="#c8372d" stroke-width="0.8" stroke-dasharray="3 3"/>`;});
  const c=hwLevelCentre(d.level);if(c){const b=planToBase(c.x,c.y,z);
    s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="6" fill="none" stroke="#7a5cc0" stroke-width="1.5"/><line x1="${(b[0]-9).toFixed(1)}" y1="${b[1].toFixed(1)}" x2="${(b[0]+9).toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#7a5cc0"/><line x1="${b[0].toFixed(1)}" y1="${(b[1]-9).toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${(b[1]+9).toFixed(1)}" stroke="#7a5cc0"/>`;}
  hwList('base',d.level).forEach(o=>{if(o===d||o.id===d.id)return;const far=Math.hypot(o.x-d.x,o.y-d.y)>R('column').mm;
    s+=`<polyline points="${p2b([[d.x,d.y,z],[o.x,o.y,z]])}" fill="none" stroke="${far?'#d08a1e':'#2e9e5b'}" stroke-width="1.5" stroke-dasharray="5 4"/>`;});
  if(typeof mrkList==='function')mrkList().forEach(m=>{if(m.kind!=='vstrip'||m.level!==d.level||(m.tags||[]).indexOf('base')<0)return;const r=mrkWallById(m.level,m.wall);if(!r)return;
    const a=mrkFacePt(r,m.side,m.u0,30),b=mrkFacePt(r,m.side,m.u1,30);s+=mrkLine(a,b,z,'#2e9e5b',8);});
  const bad=hwBaseRules(d).filter(r=>!r.ok);
  if(HW_T.on&&HW_T.g){const mh=$('modeHint');if(mh)mh.textContent=bad.length?bad.sort((a,b)=>({error:0,warn:1,info:2}[a.sev]-{error:0,warn:1,info:2}[b.sev])).map(r=>r.msg).join(' · '):'BASE: minden irányelv teljesül.';}
  return s;}

// ---- right-click on a hardware device (adds to the existing device menu) ---------------------------------------------------------
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!hwIs(d))return;
  if(d.type==='rbx'){
    Object.keys(HW_RB).forEach(k=>{if(k!==(d.rb||HW_RB_DEF))items.push({label:'▣ RB osztály: '+k+' ('+HW_RB[k].join('×')+')',act:()=>{pushUndo(['devices']);d.rb=k;draw();}});});
    items.push({label:'▣ Helyiségek hozzárendelése…',act:()=>hwServePick(d)});
    if(Array.isArray(d.serves))items.push({label:'▣ Automatikus hozzárendelés visszaállítása',act:()=>{pushUndo(['devices']);d.serves=null;draw();}});
    hwServes(d).forEach(rid=>items.push({label:'· '+hwRoomLabel(rid),act:()=>{}}));
    if(typeof rfRadiosDialog==='function')items.push({label:'📶 Rádiók…',act:()=>rfRadiosDialog(d)});}
  if(d.type==='base')items.push({label:'🖧 BASE egységek…',act:()=>hwBaseUnitPicker(us=>{if(!hwSetUnits(d,us))lyrHud('Egy egység csak egy BASE eszközben lehet.');},d)});
  items.push({label:'▣ Jelölés újraszámítása',act:()=>{pushUndo(['devices']);d.ref=hwRef(d);draw();}});});

// ---- checks ---------------------------------------------------------------------------------------------------------------------------
(STK_CHECKS.hw=STK_CHECKS.hw||[]).push(S=>{const out=[];
  if(!hwList('board').length)out.push({sev:'error',msg:'Nincs Elosztószekrény.'});
  if(!hwList('meter').length)out.push({sev:'warn',msg:'Nincs mérőóra elhelyezve.'});
  if(!hwList('entry').length)out.push({sev:'warn',msg:'Nincs adatbelépési pont elhelyezve.'});
  if(!hwList('rbx').length)out.push({sev:'info',msg:'Még nincs RBX.'});
  hwList().forEach(d=>{const h=hwHost(d);if(!h||typeof mrkAt!=='function')return;
    const side=Math.sign(h.nx*h.wi.perp[0]+h.ny*h.wi.perp[1])||1,ban=mrkAt(d.level,h.r.id,side,mrkU(h.r,d.x,d.y),d.h).filter(x=>x.pol==='ban');
    if(ban.length)out.push({sev:'warn',msg:(d.ref||d.id)+': tilos zónán ('+ban.map(b=>(b.tags||[]).join(', ')||'⛔').join('; ')+')'});});
  hwList('rbx').forEach(d=>{const r=(typeof roomOfDevice==='function')?roomOfDevice(d):null;
    if(r&&(r.rm.env==='nedves'||r.rm.env==='vizes'))out.push({sev:'warn',msg:(d.ref||d.id)+': nedves / vizes helyiségben.'});});
  const M=hwServeMap(),lv={};hwList('rbx').forEach(d=>{lv[d.level]=1;});
  Object.keys(lv).forEach(l=>hwUnserved(l).forEach(r=>out.push({sev:'warn',msg:((r.num?r.num+' ':'')+(r.name||r.id))+': nincs RBX hozzárendelve'})));
  Object.keys(M.dup).forEach(r=>out.push({sev:'error',msg:hwRoomLabel(r)+': két RBX egyenlő igénnyel ('+M.dup[r].map(d=>d.ref||d.id).join(', ')+')'}));
  hwList('rbx').forEach(d=>{const n=hwServes(d).length;if(n>3&&d.rb!=='RB-H')out.push({sev:'info',msg:(d.ref||d.id)+': '+n+' helyiséget szolgál ki — RB-H javasolt.'});});
  return out;});
(STK_CHECKS.base=STK_CHECKS.base||[]).push(S=>{const out=[],bs=hwList('base');
  if(!bs.length){out.push({sev:'error',msg:'Nincs BASE elhelyezve.'});return out;}
  const seen={};bs.forEach(d=>hwUnits(d).forEach(u=>{(seen[u]=seen[u]||[]).push(d);}));
  HW_UNIT_ORDER.forEach(u=>{if(!seen[u])out.push({sev:'warn',msg:u+' hiányzik minden BASE eszközből.'});
    else if(seen[u].length>1)out.push({sev:'error',msg:u+' két BASE eszközben is szerepel ('+seen[u].map(d=>d.ref||d.id).join(', ')+').'});});
  bs.forEach(d=>hwBaseRules(d).forEach(r=>{if(!r.ok)out.push({sev:r.sev,msg:(d.ref||d.id)+': '+r.msg});}));
  return out;});

// ---- actions ----------------------------------------------------------------------------------------------------------------------------
registerActions([
 {id:'hw.rbx',alias:'rbx roombox elhelyezes place room box',label:'RBX elhelyezése',icon:'▣',group:'Hardver',
  hint:'RoomBox a falra; a jelölt „RBX helye” sáv vonzza. Tab: RB osztály. A szellem mutatja, mely helyiségeket szolgálja ki.',run:()=>hwToolStart('rbx')},
 {id:'hw.board',alias:'elosztoszekreny elhelyezes board place',label:'Elosztószekrény elhelyezése',icon:'▤',group:'Hardver',run:()=>hwToolStart('board')},
 {id:'hw.meter',alias:'meroora villanyora meter place',label:'Mérőóra elhelyezése',icon:'◔',group:'Hardver',run:()=>hwToolStart('meter')},
 {id:'hw.entry',alias:'adatbelepes isp entry place',label:'Adatbelépési pont elhelyezése',icon:'⇲',group:'Hardver',run:()=>hwToolStart('entry')},
 {id:'hw.ssc',alias:'biztonsagi kozpont ssc security place',label:'Biztonsági központ (SSC) elhelyezése',icon:'⛨',group:'Hardver',run:()=>hwToolStart('ssc')},
 {id:'hw.base',alias:'base net comp media elhelyezes place',label:'BASE elhelyezése',icon:'🖧',group:'Hardver',
  hint:'NET · COMP · MEDIA egyenként vagy együtt; a szellem az irányelveket mutatja (Elosztó közelsége, száraz helyiség, oszlop, középpont).',run:()=>hwToolStart('base')},
 {id:'hw.serve',alias:'rbx helyiseg hozzarendeles serve rooms assign',label:'RBX: helyiségek hozzárendelése',icon:'▣',group:'Hardver',
  need:'Jelölj ki egy RBX-et.',when:c=>c.selType==='devices'&&data.devices[c.sel.i]&&data.devices[c.sel.i].type==='rbx',run:c=>hwServePick(data.devices[c.sel.i])},
 {id:'hw.cloud',alias:'vezetek nelkuli lefedettseg wireless cloud rf',label:'Vezeték nélküli lefedettség (RBX)',icon:'☁',group:'Rádió',
  hint:'A kijelölt / elhelyezés alatt álló RBX rádiós lefedettsége a szellemen.',
  run:()=>{state.hwCloud=!state.hwCloud;if(typeof rfCoverageSvg!=='function')lyrHud('A rádiós modell (C3) még nincs kész.');else lyrHud('Vezeték nélküli lefedettség '+(state.hwCloud?'be':'ki'));draw();}}
]);

// test hooks
window.HW_TYPES=HW_TYPES;window.HW_RB=HW_RB;window.HW_DEF=HW_DEF;window.HW_T=HW_T;window.HW_BASE_RULES=HW_BASE_RULES;
window.hwIs=hwIs;window.hwList=hwList;window.hwSize=hwSize;window.hwHost=hwHost;window.hwFrame=hwFrame;window.hwBox=hwBox;window.hwRef=hwRef;
window.hwSymbol=hwSymbol;window.hwAutoServes=hwAutoServes;window.hwServeMap=hwServeMap;window.hwServes=hwServes;window.hwRoomRbx=hwRoomRbx;
window.hwUnserved=hwUnserved;window.hwServePick=hwServePick;window.hwServeToggle=hwServeToggle;window.hwGhost=hwGhost;window.hwFromGhost=hwFromGhost;
window.hwPlace=hwPlace;window.hwToolStart=hwToolStart;window.hwToolOff=hwToolOff;window.hwOverlaySvg=hwOverlaySvg;window.hwCoverageSvg=hwCoverageSvg;
window.hwBaseRules=hwBaseRules;window.hwSetUnits=hwSetUnits;window.hwBasePlaced=hwBasePlaced;window.hwLevelCentre=hwLevelCentre;window.hwUnits=hwUnits;
window.hwServePickState=()=>HW_SP;window.hwGhostAt=hwGhostAt;window.hwPickPlan=hwPickPlan;window.hwBaseGuideSvg=hwBaseGuideSvg;
