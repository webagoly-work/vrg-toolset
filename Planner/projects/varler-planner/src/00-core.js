// ==========================================================================
// 00-core.js — projection maths, level table, building model, example house geometry
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

//////////////////// core (verified) ////////////////////
const C=Math.cos(Math.PI/6), S=Math.sin(Math.PI/6);
let CXv=7300, CYv=4900, GAP=2600; const W=1000,Hh=720;

//////////////////// view scale (nézeti méretarány) ////////////////////
// SC is base units per model mm — the drawing's BASE scale, under the pan/zoom transform.
// A scale step grows the model in base space and shrinks the zoom by the same factor, so the
// picture does not jump; what changes is the band the zoom range covers. Step 1 is the widest
// view (the whole building fits); step 10 reaches ten times closer before the zoom ceiling.
//
// Sizes fall into three kinds, and only the third needs help:
//   * model mm (geometry, nvMM room text)  — scale with the model, correct by construction;
//   * paper mm (bpU/nvSW/bpSW/bpFS)        — carry SC already, correct by construction;
//   * base units written as a literal       — would shrink on screen; pass them through vsP().
// Anything of the form `C/state.zoom` is already screen-constant and needs nothing.
const SC_BASE=0.045;
const VIEW_SCALES=[1,2,5,10];
let SC=SC_BASE;
function vsK(){return SC/SC_BASE;}                 // the active step, 1 = the old fixed scale
function vsOk(f){return VIEW_SCALES.indexOf(+f)>=0?+f:1;}
function vsP(baseUnits){return +(baseUnits*vsK()).toFixed(3);}   // a size authored in base units at 1×
function vsDash(d){return vsK()===1?d:String(d).trim().split(/\s+/).map(v=>vsP(+v)).join(' ');}
// A badge — a label, a node dot, a cursor read-out — is a fixed SCREEN size pinned to a point, not
// a thing on the building. Scaling the group about its own anchor carries the literal sizes AND the
// little ±3 nudges with it, which is why these are wrapped rather than edited number by number.
// Model-true geometry must never go through here: use vsP() on its stroke width instead.
function vsBadge(x,y,svg){const k=vsK();
  return k===1?svg:`<g transform="translate(${(+x).toFixed(1)},${(+y).toFixed(1)}) scale(${k}) translate(${(-x).toFixed(1)},${(-y).toFixed(1)})">${svg}</g>`;}
// the two symbol scales authored in base units, carried through the view-scale step
function devK(){return (state.devScale||0.72)*vsK();}
function pathK(){return (state.pathScale||1)*vsK();}
function vsClamp(z){return Math.max(0.15/vsK(),Math.min(5,z));}  // step 1's full range, plus the extra reach
// state → SC, without moving the camera (load, undo, boot)
function vsApply(){SC=SC_BASE*vsOk(state.viewScale);}
// 12-boot's home view (zoom .5 centred), expressed at the active step
function vsHomeView(){const r=vsK();return {zoom:.5/r,panX:(1-.5/r)*W/2,panY:(1-.5/r)*Hh/2};}
// Switch step without moving the picture: note the PLAN point under the viewport centre, change
// the scale, divide the zoom by the same factor, then re-pan that point back to the centre. Going
// through plan coordinates (not base ones) keeps it exact even when the zoom clamp bites.
function vsSet(f){f=vsOk(f);const prev=vsK();if(f===prev)return false;
  const z=state.zoom,zz=dz(state.active,0);
  const plan=baseToPlanB((W/2-state.panX)/z,(Hh/2-state.panY)/z,zz);
  state.viewScale=f;vsApply();
  state.zoom=vsClamp(z*prev/f);
  const now=planToBase(plan[0],plan[1],zz);
  state.panX=W/2-now[0]*state.zoom;state.panY=Hh/2-now[1]*state.zoom;
  setTransform();draw();return true;}
const ORD=['basement','ground','upper'];
const LH={basement:2500,ground:2700,upper:2700};
// Álmennyezet: per level, 0 = nincs. A room may override it (rm.dropC) — a lowered ceiling
// usually only covers part of a storey (fürdő, közlekedő), so the room wins where it is set.
const DROPC={basement:0,ground:0,upper:0};
const DROP_PLENUM=250;                                   // default gap under the slab when none is given
function dropCeilMm(level,rm){if(rm&&rm.dropC>0)return rm.dropC;
  const v=DROPC[level]||0;return v>0?v:0;}
function dropCeilOrDefault(level,rm){const v=dropCeilMm(level,rm);
  return v>0?v:Math.max(0,wallH(level)-((state&&state.plenum)||DROP_PLENUM));}
function hasDropCeil(level,rm){return dropCeilMm(level,rm)>0;}
function plenumMm(level,rm){return Math.max(0,wallH(level)-dropCeilOrDefault(level,rm));}
function rot(x,y,deg){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=x-CXv,dy=y-CYv;
  return [CXv+dx*c-dy*s, CYv+dx*s+dy*c];}
function camK(){const p=Math.max(5,Math.min(90,state.pitch)),t=Math.max(0,Math.min(1,(p-30)/60));
  return {p,rad:p*Math.PI/180,extra:45*(1-t),kx:1.2247+(1-1.2247)*t,ky:1.4142+(1-1.4142)*t,kz:Math.cos(p*Math.PI/180)/Math.cos(Math.PI/6)};}
function project(x,y,z,deg){const c=camK();const [rx,ry]=rot(x,y,deg+c.extra);
  return [rx*c.kx, ry*Math.sin(c.rad)*c.ky - z*c.kz];}
// ---- camera presets + 90° rotation lock (Views WP V2, docs/views/WORKPLAN.md) ----
// state.pitch is NOT a true view angle: camK blends a true isometric at 30 (with a hidden +45° yaw,
// `extra`) into the plan at 90. So a preset is a (pitch, phase) pair in the Planner's own terms, and
// the lock snaps the EFFECTIVE yaw (rot + extra) to phase + k·90. Pitches are chosen so extra is a
// whole degree (setRot rounds): extra = 0.75·(90 − p) for p in 30…90, 45 below 30.
const CAM_PRESETS=[
 {k:'iso', n:'Izometrikus',           pitch:30, phase:45, hint:'Egyenlő tengelyek — a klasszikus 30°-os rajz.'},
 {k:'dim', n:'Dimetrikus (alacsony)', pitch:20, phase:45, hint:'Alacsonyabb, nyugodtabb rálátás; a falak magasabbnak látszanak.'},
 {k:'axo', n:'Axonometria',           pitch:46, phase:45, hint:'Meredekebb rálátás: a helyiségek alaprajzként olvashatók, magassággal.'},
 {k:'mil', n:'Katonai (alaprajz-hű)', pitch:70, phase:45, hint:'Az alaprajz szinte torzítatlan, a magasság rövidítve — rajzoláshoz.'},
 {k:'elev',n:'Homlokzati',            pitch:15, phase:0,  hint:'Szemből egy falra, enyhe rálátással.'}];
function camPreset(k){return CAM_PRESETS.find(p=>p.k===k)||null;}
function camExtraAt(p){const q=Math.max(5,Math.min(90,p)),t=Math.max(0,Math.min(1,(q-30)/60));return 45*(1-t);}   // = camK().extra
function camNorm(d){return ((Math.round(d)%360)+360)%360;}
// the rot nearest to `rot` whose effective yaw sits on phase + k·90 at this pitch
function camQuadRot(rot,pitch,phase){const base=phase-camExtraAt(pitch);return camNorm(base+90*Math.round((rot-base)/90));}
function camLockOn(){return !!state.camLock&&state.pitch<88;}            // 2D has nothing to rotate
function camLockPhase(){const p=camPreset(state.camPreset);return p?p.phase:45;}
let camLockAcc=0;   // drag degrees gathered toward the next quadrant step
// every yaw write goes through here: free → unchanged; locked → a whole quadrant or nothing
function camLockYaw(deg){if(!camLockOn())return deg;
  const cur=state.rot,ph=camLockPhase(),d=((deg-cur)%360+540)%360-180;
  if(Math.abs(d)>=60){camLockAcc=0;return camQuadRot(deg,state.pitch,ph);}   // a jump (±90 key, 0°/90° button): land on it
  camLockAcc+=d;
  if(Math.abs(camLockAcc)>=45){const s=Math.sign(camLockAcc);camLockAcc=0;return camQuadRot(cur+90*s,state.pitch,ph);}
  return camQuadRot(cur,state.pitch,ph);}
function camLockPitch(v){return camLockOn()&&state.camLockPitch!=null?state.camLockPitch:v;}
function camRotStep(){return camLockOn()?90:15;}
// the preset the camera currently matches, or null (a free camera)
function camPresetNow(){if(state.pitch>=88)return null;
  return CAM_PRESETS.find(p=>Math.abs(state.pitch-p.pitch)<0.5&&camQuadRot(state.rot,p.pitch,p.phase)===camNorm(state.rot))||null;}
function camPresetApply(k){const p=camPreset(k);
  if(!p){state.camPreset=null;draw();camSyncUI();return false;}
  state.camPreset=k;state.camLockPitch=p.pitch;camLockAcc=0;
  const lock=state.camLock;state.camLock=false;                // the preset itself may move pitch and yaw
  if(typeof recentrePivot==='function')recentrePivot();
  state.pitch=p.pitch;state.flat=false;if($('view3d'))$('view3d').textContent='2D';
  setRot(camQuadRot(state.rot,p.pitch,p.phase));state.camLock=lock;camSyncUI();
  if($('hud'))$('hud').textContent='Vetület: '+p.n+(lock?' · forgatás 90°-onként':'')+' — '+p.hint;
  return true;}
function camLockSet(on){state.camLock=!!on;camLockAcc=0;
  if(state.camLock){if(state.pitch>=88)$('view3d')&&$('view3d').onclick();   // the lock is a 3D thing: leave 2D first
    const p=camPreset(state.camPreset);state.camLockPitch=p?p.pitch:state.pitch;
    state.pitch=state.camLockPitch;setRot(camQuadRot(state.rot,state.pitch,camLockPhase()));}
  camSyncUI();
  if($('hud'))$('hud').textContent=state.camLock?'Forgatás 90°-onként — a dőlés rögzítve ('+Math.round(state.pitch)+'°); jobb gombos húzás vagy ←/→ negyedet fordít.'
    :'Szabad kamera.';
  return state.camLock;}
function camSyncUI(){const s=$('camPreset'),b=$('camLock'),p=camPresetNow();
  if(s)s.value=p?p.k:'';if(b)b.checked=!!state.camLock;}
function floorRealZ(l){let z=0;for(const k of ORD){if(k===l)break;z+=LH[k];}return z;}
function floorDispZ(l){let z=0;for(const k of ORD){if(k===l)break;z+=LH[k]+(state.exploded?GAP:0);}return z;}
function wallH(l){return LH[l];}
function dz(l,h){return floorDispZ(l)+(h||0);}
function wz(l,h){return floorRealZ(l)+(h||0);}
function Pc(){return project(CXv,CYv,0,state.rot);}
function pivotAtCursor(e){
  // if the cursor is over any room floor, pivot the camera about that plan point (stays in-room while rotating)
  const rm=roomHitAt(e);if(!rm)return false;
  const [bx,by]=clientToBase(e);const [px,py]=baseToPlan(bx,by,dz(state.active,0));
  CXv=px;CYv=py;
  const now=planToBase(px,py,dz(state.active,0));
  state.panX=W/2-now[0]*state.zoom;state.panY=Hh/2-now[1]*state.zoom;setTransform();return true;}
function recentrePivot(){
  // The pan/zoom live in the <g> transform, so the base-space point at the
  // viewport centre is (viewBoxCentre - pan)/zoom. Move the pivot there and
  // re-pan so that base point stays under the viewport centre.
  const bcx=(W/2-state.panX)/state.zoom, bcy=(Hh/2-state.panY)/state.zoom;
  const plan=baseToPlanB(bcx,bcy,dz(state.active,0));
  CXv=plan[0];CYv=plan[1];
  const now=planToBase(plan[0],plan[1],dz(state.active,0));
  state.panX=W/2-now[0]*state.zoom;
  state.panY=Hh/2-now[1]*state.zoom;
  setTransform();}
function baseToPlanB(bx,by,z){const c=camK(),[cx,cy]=Pc();const px=(bx-W/2)/SC+cx, py=(by-Hh/2)/SC+cy;
  const qx=px/c.kx, qy=(py+z*c.kz)/(Math.sin(c.rad)*c.ky);return rot(qx,qy,-(state.rot+c.extra));}
function planToBase(x,y,z){const [px,py]=project(x,y,z,state.rot),[cx,cy]=Pc();return [(px-cx)*SC+W/2,(py-cy)*SC+Hh/2];}
function baseToPlan(bx,by,z){const c=camK(),[cx,cy]=Pc();const px=(bx-W/2)/SC+cx, py=(by-Hh/2)/SC+cy;
  const qx=px/c.kx, qy=(py+z*c.kz)/(Math.sin(c.rad)*c.ky);return rot(qx,qy,-(state.rot+c.extra));}

function viewE(){const c=camK();return [0,Math.cos(c.rad),Math.sin(c.rad)];}
function depthOf(x,y,z){const c=camK();const [rx,ry]=rot(x,y,state.rot+c.extra);return ry*Math.cos(c.rad)+(z||0)*Math.sin(c.rad);}
function faceVisible(n){const c=camK(),E=viewE(),m=rotN(n,state.rot+c.extra);return m[0]*E[0]+m[1]*E[1]+m[2]*E[2]>1e-6;}
//////////////////// plan model ////////////////////
const g={xLo:0,xLi:300,xRi:14300,xRo:14600,nx0:300,nx1:6300,p1a:6300,p1b:6450,cx0:6450,cx1:7650,
 p2a:7650,p2b:7800,sx0:7800,sx1:9400,p3a:9400,p3b:9550,gx0:9550,gx1:14300,hx0:300,hx1:4700,
 pAa:4700,pAb:4850,kx0:4850,kx1:13150,pBa:13150,pBb:13300,mx0:13300,mx1:14300,
 yTo:0,yTi:300,yMt:6300,yMb:6500,yBt:9500,yBb:9800};
const ROOMS={NAGYSZOBA:'#ecdcc2',GARAZS:'#cdd1d6',HALO:'#c9d9ea',KONYHA:'#cfe4c9',KAMRA:'#e6d6b6',CORR:'#dde0e3',SHAFT:'#c7cace'};
function R(x0,y0,x1,y1){return {x0,y0,x1,y1};}
const groundRooms=[
 {poly:[[g.nx0,g.yTi],[g.nx1,g.yTi],[g.nx1,g.yMt],[g.nx0,g.yMt]],fill:ROOMS.NAGYSZOBA,name:'NAGYSZOBA'},
 {poly:[[g.gx0,g.yTi],[g.gx1,g.yTi],[g.gx1,g.yMt],[g.gx0,g.yMt]],fill:ROOMS.GARAZS,name:'GARÁZS'},
 {poly:[[g.hx0,g.yMb],[g.hx1,g.yMb],[g.hx1,g.yBt],[g.hx0,g.yBt]],fill:ROOMS.HALO,name:'HÁLÓ'},
 {poly:[[g.kx0,g.yMb],[g.kx1,g.yMb],[g.kx1,g.yBt],[g.kx0,g.yBt]],fill:ROOMS.KONYHA,name:'KONYHA/ÉTKEZŐ'},
 {poly:[[g.mx0,g.yMb],[g.mx1,g.yMb],[g.mx1,g.yBt],[g.mx0,g.yBt]],fill:ROOMS.KAMRA,name:'KAMRA'},
 {poly:[[g.cx0,g.yTi],[g.cx1,g.yTi],[g.cx1,g.yMt],[g.cx0,g.yMt]],fill:ROOMS.CORR,name:'KÖZLEKEDŐ'},
 {poly:[[g.sx0,g.yTi],[g.sx1,g.yTi],[g.sx1,g.yMt],[g.sx0,g.yMt]],fill:ROOMS.SHAFT,name:'LÉPCSŐ'}];
const groundWalls=[R(0,0,14600,300),R(0,9500,14600,9800),R(0,0,300,9800),R(14300,0,14600,9800),
 R(300,6300,14300,6500),R(6300,300,6450,6300),R(9400,300,9550,6300),
 R(4700,6500,4850,9500),R(13150,6500,13300,9500)];
const baseSlab=[[0,0],[9550,0],[9550,6300],[14600,6300],[14600,9800],[0,9800]];
const baseGhost=[[9550,0],[14600,0],[14600,6300],[9550,6300]];
const baseWalls=[R(0,0,9550,300),R(9400,0,9550,6300),R(9550,6300,14600,6500),R(14300,6300,14600,9800),R(0,9500,14600,9800),R(0,0,300,9800)];
const upperSlab=[[0,0],[14600,0],[14600,9800],[0,9800]];
const upperWalls=[R(0,0,14600,300),R(0,9500,14600,9800),R(0,0,300,9800),R(14300,0,14600,9800)];
function centerlines(walls){return walls.map(w=>{const horiz=(w.x1-w.x0)>=(w.y1-w.y0);
  return horiz?[[w.x0,(w.y0+w.y1)/2],[w.x1,(w.y0+w.y1)/2]]:[[(w.x0+w.x1)/2,w.y0],[(w.x0+w.x1)/2,w.y1]];});}
function wr(a){if(Array.isArray(a))return {x0:a[0],y0:a[1],x1:a[2],y1:a[3]};const r={x0:a.x0,y0:a.y0,x1:a.x1,y1:a.y1};if(a.id)r.id=a.id;if(a.h)r.h=a.h;if(a.z0)r.z0=a.z0;if(a.name)r.name=a.name;if(a.mat)r.mat=a.mat;if(a.layer)r.layer=a.layer;return r;}
function rectArr(R){const o={x0:R.x0,y0:R.y0,x1:R.x1,y1:R.y1};if(R.id)o.id=R.id;if(R.h)o.h=R.h;if(R.z0)o.z0=R.z0;if(R.name)o.name=R.name;if(R.mat)o.mat=R.mat;if(R.layer)o.layer=R.layer;return o;}

function blankBuilding(){return {name:'Új terv',center:[6000,4000],heights:{basement:2500,ground:2700,upper:2700},
  walls:{basement:[],ground:[],upper:[]},slabs:{},ghosts:{},rooms:{},roofs:{}};}
const HOUSE={name:'Példa ház',center:[7300,4900],heights:{basement:2500,ground:2700,upper:2700},
  walls:{basement:baseWalls.map(rectArr),ground:groundWalls.map(rectArr),upper:upperWalls.map(rectArr)},
  slabs:{basement:baseSlab,ground:null,upper:upperSlab},ghosts:{basement:baseGhost},
  rooms:{ground:groundRooms},roofs:{}};

// ---- Outer garage: E-plan (from blueprint), 2 bays open to front, mono-pitch roof on Emelet ----
const GARAGE=(function(){const D=4600,F=6600,t=300,oh=400;
  const walls=[wr([0,0,D,t]),wr([0,F-t,D,F]),wr([0,0,t,F]),wr([0,(F-t)/2,D,(F+t)/2])];
  const slab=[[0,0],[D,0],[D,F],[0,F]];
  const bay1=[[t,t],[D,t],[D,(F-t)/2],[t,(F-t)/2]];
  const bay2=[[t,(F+t)/2],[D,(F+t)/2],[D,F-t],[t,F-t]];
  const roof=[{p:[[-oh,-oh,620],[D+oh,-oh,120],[D+oh,F+oh,120],[-oh,F+oh,620]],fill:'#8d9298'}];
  return {name:'Külső garázs',center:[D/2,F/2],heights:{basement:0,ground:2500,upper:2500},
    walls:{basement:[],ground:walls.map(rectArr),upper:[]},
    slabs:{basement:null,ground:slab,upper:null},ghosts:{},
    rooms:{ground:[{poly:bay1,name:'ÁLLÁS 1',fill:'#d7d9dc'},{poly:bay2,name:'ÁLLÁS 2',fill:'#d7d9dc'}]},
    roofs:{upper:roof}};})();

let B,WALLS,SLAB,GHOST,ROOMSB,ROOFS,SNAP;
function loadBuilding(o,keep){B=o;CXv=o.center[0];CYv=o.center[1];
  LH.basement=o.heights.basement;LH.ground=o.heights.ground;LH.upper=o.heights.upper;
  WALLS={};SLAB={};GHOST={};ROOMSB={};ROOFS={};SNAP={};
  for(const l of ORD){WALLS[l]=((o.walls&&o.walls[l])||[]).map(wr);
    SLAB[l]=(o.slabs&&o.slabs[l])||null;GHOST[l]=(o.ghosts&&o.ghosts[l])||null;
    ROOMSB[l]=(o.rooms&&o.rooms[l])||[];ROOFS[l]=(o.roofs&&o.roofs[l])||[];
    SNAP[l]=centerlines(WALLS[l]);}
  if(!keep)['cables','devices','notes','measures','openings'].forEach(k=>data[k]=[]);
  const hb=document.getElementById('hBase');if(hb){hb.value=LH.basement;document.getElementById('hGround').value=LH.ground;document.getElementById('hUpper').value=LH.upper;}}

