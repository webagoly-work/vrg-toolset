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
let CXv=7300, CYv=4900, GAP=2600; const W=1000,Hh=720,SC=0.045;
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

