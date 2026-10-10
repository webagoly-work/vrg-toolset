// ==========================================================================
// 02-geometry.js — geometry helpers, fine mode, snapping, wall geometry + properties
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// geometry helpers ////////////////////
function newell(p){let nx=0,ny=0,nz=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];
  nx+=(a[1]-b[1])*(a[2]+b[2]);ny+=(a[2]-b[2])*(a[0]+b[0]);nz+=(a[0]-b[0])*(a[1]+b[1]);}
  const m=Math.hypot(nx,ny,nz)||1;return [nx/m,ny/m,nz/m];}
function rotN(n,deg){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [n[0]*c-n[1]*s,n[0]*s+n[1]*c,n[2]];}
const LIGHT=(()=>{const v=[0.35,0.30,0.90],m=Math.hypot(...v);return v.map(k=>k/m);})();
function shade(base,n){const f=0.55+0.45*Math.max(0,n[0]*LIGHT[0]+n[1]*LIGHT[1]+n[2]*LIGHT[2]);
  return '#'+base.map(c=>Math.min(255,c*f|0).toString(16).padStart(2,'0')).join('');}
const stage=document.getElementById('stage'), vp=document.getElementById('vp');
// ---- FINE MODE (hold Alt): the pointer keeps moving, the model follows at 1/5 speed ----
// Damping the client point itself means every drag, ghost and snap inherits it for free.
let fineAnchor=null,lastPtr=[0,0];const FINE_K=0.2;
function fineOn(cx,cy){if(fineAnchor)return;fineAnchor={cx,cy};
  $('hud').textContent='🔍 Finomhangolt mozgatás (Alt) — '+Math.round(1/FINE_K)+'× lassabb, 1 mm-es lépés';}
function fineOff(){if(!fineAnchor)return;fineAnchor=null;if($('fineBtn'))$('fineBtn').classList.remove('on');}
function fineToggle(){state.fineLock=!state.fineLock;
  if(state.fineLock)fineOn(lastPtr[0],lastPtr[1]);else{state.fineLock=false;fineAnchor=null;}
  if($('fineBtn'))$('fineBtn').classList.toggle('on',!!state.fineLock);
  $('hud').textContent=state.fineLock?'🔍 Finomhangolás BEKAPCSOLVA (1 mm) — kattints újra a kikapcsoláshoz':'Finomhangolás ki.';}
function fineXY(cx,cy){if(!fineAnchor)return [cx,cy];
  return [fineAnchor.cx+(cx-fineAnchor.cx)*FINE_K, fineAnchor.cy+(cy-fineAnchor.cy)*FINE_K];}
function fineStep(mm){return fineAnchor?1:mm;}          // grid step while fine-tuning
function clientToBase(e){const p=stage.createSVGPoint();const f=fineXY(e.clientX,e.clientY);p.x=f[0];p.y=f[1];
  const u=p.matrixTransform(stage.getScreenCTM().inverse());return [(u.x-state.panX)/state.zoom,(u.y-state.panY)/state.zoom];}
function boxCorners(r,z0,z1){return [[r.x0,r.y0,z0],[r.x1,r.y0,z0],[r.x1,r.y1,z0],[r.x0,r.y1,z0],
  [r.x0,r.y0,z1],[r.x1,r.y0,z1],[r.x1,r.y1,z1],[r.x0,r.y1,z1]];}
const FACES=[[4,5,6,7],[0,1,2,3],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];

//////////////////// snapping ////////////////////
function nearestOnSeg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy||1;
  let t=((px-ax)*dx+(py-ay)*dy)/l2;t=Math.max(0,Math.min(1,t));return {t,qx:ax+t*dx,qy:ay+t*dy,d:Math.hypot(px-(ax+t*dx),py-(ay+t*dy))};}
// a door/window belongs IN the wall, never on one of its faces — pull the point onto the centreline
function openingOnCentreline(w,level){let best=null,bd=1e9;
  (WALLS[level]||[]).forEach(r=>{const wi=wallInfo(r),a=wi.seg[0],b=wi.seg[1];
    const nr=nearestOnSegPlain(w.x,w.y,a[0],a[1],b[0],b[1]);
    if(nr.d<bd){bd=nr.d;const t=Math.max(0,Math.min(1,nr.t));
      best={x:a[0]+t*(b[0]-a[0]),y:a[1]+t*(b[1]-a[1])};}});
  return (best&&bd<900)?best:{x:w.x,y:w.y};}
function snapWall(e,level,h){const [bx,by]=clientToBase(e),zz=dz(level,h||0);let best=null,bd=16/state.zoom;
  for(const seg of SNAP[level]){const [a0,a1]=planToBase(seg[0][0],seg[0][1],zz),[b0,b1]=planToBase(seg[1][0],seg[1][1],zz);
    const r=nearestOnSeg(bx,by,a0,a1,b0,b1);if(r.d<bd){bd=r.d;
      const x=seg[0][0]+r.t*(seg[1][0]-seg[0][0]),y=seg[0][1]+r.t*(seg[1][1]-seg[0][1]);
      const ang=Math.atan2(seg[1][1]-seg[0][1],seg[1][0]-seg[0][0]);best={x,y,ang,seg};}}
  return best;}
function snap(e,level,farSide){const h=drawHmm(level);const w=snapWall(e,level,h);
  if(w){let x=w.x,y=w.y;if(farSide){const px=-Math.sin(w.ang),py=Math.cos(w.ang);x+=px*150;y+=py*150;}
    return {level,x,y,h,snap:farSide?'wall/far':'wall'};}
  let [x,y]=baseToPlan(...clientToBase(e),dz(level,h));
  if(state.grid){x=Math.round(x/state.gridSize)*state.gridSize;y=Math.round(y/state.gridSize)*state.gridSize;}
  return {level,x,y,h,snap:state.grid?'grid':'free'};}
// ---- wall geometry (for cable lock, hover, wall tool) ----
function wallInfo(r){const horiz=(r.x1-r.x0)>=(r.y1-r.y0);const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
  return {horiz,seg:horiz?[[r.x0,cy],[r.x1,cy]]:[[cx,r.y0],[cx,r.y1]],
    thick:horiz?(r.y1-r.y0):(r.x1-r.x0),perp:horiz?[0,1]:[1,0]};}
function wallDist(r,bx,by,zz){const wi=wallInfo(r);const [a0,a1]=planToBase(wi.seg[0][0],wi.seg[0][1],zz),[b0,b1]=planToBase(wi.seg[1][0],wi.seg[1][1],zz);
  const nr=nearestOnSeg(bx,by,a0,a1,b0,b1);return {d:nr.d,t:nr.t,wi};}
function cableSnap(e){const level=state.active,h=drawHmm(level),zz=dz(level,h);const [bx,by]=clientToBase(e);
  const walls=WALLS[level]||[];
  if(state.wallLock && walls.length && !isFreeHeight()){
    let best=null,bi=-1;walls.forEach((r,i)=>{const dd=wallDist(r,bx,by,zz);if(!best||dd.d<best.d){best=dd;bi=i;}});
    if(lock!=null && lock<walls.length){const cur=wallDist(walls[lock],bx,by,zz);const margin=16/state.zoom;
      if(best.d < cur.d - margin){lock=bi;} else {best=cur;bi=lock;}}
    else lock=bi;
    lock=bi;const wi=best.wi,t=Math.max(0,Math.min(1,best.t));
    const cxp=wi.seg[0][0]+t*(wi.seg[1][0]-wi.seg[0][0]),cyp=wi.seg[0][1]+t*(wi.seg[1][1]-wi.seg[0][1]);
    const off=(state.side?1:-1)*wi.thick/2;
    return {level,x:cxp+wi.perp[0]*off,y:cyp+wi.perp[1]*off,h,snap:'fal'+(state.side?'/túl':'/köz'),wall:walls[bi]};}
  lock=null;let [x,y]=baseToPlan(bx,by,zz);
  if(state.grid){x=Math.round(x/state.gridSize)*state.gridSize;y=Math.round(y/state.gridSize)*state.gridSize;}
  return {level,x,y,h,snap:state.grid?'grid':'szabad',wall:null};}
// ---- wall geometry: thickness keeps the centreline, length keeps the centre ----
function wallGeom(r){const horiz=(r.x1-r.x0)>=(r.y1-r.y0);
  return {horiz,len:horiz?(r.x1-r.x0):(r.y1-r.y0),th:horiz?(r.y1-r.y0):(r.x1-r.x0),
    cx:(r.x0+r.x1)/2,cy:(r.y0+r.y1)/2};}
function setWallGeom(r,level,o){const g=wallGeom(r);
  const th=Math.max(20,o.th!=null?o.th:g.th),len=Math.max(50,o.len!=null?o.len:g.len);
  if(g.horiz){r.x0=g.cx-len/2;r.x1=g.cx+len/2;r.y0=g.cy-th/2;r.y1=g.cy+th/2;}
  else{r.y0=g.cy-len/2;r.y1=g.cy+len/2;r.x0=g.cx-th/2;r.x1=g.cx+th/2;}
  if(o.h!=null){if(o.h>0)r.h=o.h;else delete r.h;}
  if(o.z0!=null){if(o.z0>0)r.z0=o.z0;else delete r.z0;}
  if(o.name!=null){if(o.name)r.name=o.name;else delete r.name;}
  if(o.mat!=null){if(o.mat)r.mat=o.mat;else delete r.mat;}
  SNAP[level]=centerlines(WALLS[level]);}
const WALL_PRESETS=[
  {n:'Pengefal 100 mm (válaszfal)',th:100},
  {n:'Válaszfal 120 mm',th:120},
  {n:'Gipszkarton 100 mm (CW75)',th:100,mat:'gipszkarton'},
  {n:'Gipszkarton 125 mm (CW100)',th:125,mat:'gipszkarton'},
  {n:'Teherhordó 300 mm',th:300,mat:'tégla'},
  {n:'Teherhordó 380 mm',th:380,mat:'tégla'}];
function wallPropsDialog(r,level){const g=wallGeom(r),fullH=wallH(level);
  const opt=WALL_PRESETS.map((w,i)=>`<option value="${i}">${esc(w.n)}</option>`).join('');
  openModal('Fal tulajdonságai',
     `<div class="mrow"><label style="width:120px">Megnevezés</label><input id="wpName" value="${esc(r.name||'')}" placeholder="pl. Pengefal a kamra mellett" style="flex:1"></div>`
    +`<div class="mrow"><label style="width:120px">Sablon</label><select id="wpPre" style="flex:1"><option value="">— egyedi —</option>${opt}</select></div>`
    +`<div class="mrow"><label style="width:120px">Vastagság</label><input id="wpTh" type="number" step="10" min="20" value="${Math.round(g.th)}" style="width:90px"> mm`
    +`<span style="color:#999;font-size:11px;margin-left:8px">a fal középvonala nem mozdul</span></div>`
    +`<div class="mrow"><label style="width:120px">Hossz</label><input id="wpLen" type="number" step="10" min="50" value="${Math.round(g.len)}" style="width:90px"> mm`
    +`<span style="color:#999;font-size:11px;margin-left:8px">a fal közepéhez képest nő/csökken</span></div>`
    +`<div class="mrow"><label style="width:120px">Magasság</label><input id="wpH" type="number" step="10" min="0" value="${Math.round(r.h||0)}" style="width:90px"> mm`
    +`<span style="color:#999;font-size:11px;margin-left:8px">0 = teljes belmagasság (${fullH} mm)</span></div>`
    +`<div class="mrow"><label style="width:120px">Indul a padlótól</label><input id="wpZ" type="number" step="10" min="0" value="${Math.round(r.z0||0)}" style="width:90px"> mm`
    +`<span style="color:#999;font-size:11px;margin-left:8px">&gt;0 → lebegő fal / mellvéd / áthidaló sáv</span></div>`
    +`<div class="mrow"><label style="width:120px">Anyag</label><input id="wpMat" value="${esc(r.mat||'')}" placeholder="tégla / gipszkarton / beton" style="flex:1"></div>`
    +`<div class="mrow" id="wpInfo" style="font-size:11px;color:#777"></div>`,
    ()=>{pushUndo();
      setWallGeom(r,level,{th:+$('wpTh').value,len:+$('wpLen').value,h:+$('wpH').value,z0:+$('wpZ').value,
        name:$('wpName').value.trim(),mat:$('wpMat').value.trim()});
      draw();},'Alkalmaz');
  const info=()=>{const th=+$('wpTh').value||0,len=+$('wpLen').value||0,h=(+$('wpH').value||fullH),z=+$('wpZ').value||0;
    const A=len*h/1e6,V=A*th/1000;
    $('wpInfo').innerHTML=`Felület <b>${A.toFixed(2)} m²</b> · térfogat <b>${V.toFixed(3)} m³</b> · teteje a padlótól <b>${Math.round(z+h)} mm</b>`
      +(z>0?' · <b style="color:#c0530f">lebegő fal</b>':'')+(th<=120?' · <b style="color:#2f6fb0">pengefal-vastagság</b>':'');};
  ['wpTh','wpLen','wpH','wpZ'].forEach(id=>{$(id).oninput=info;});
  $('wpPre').onchange=e=>{const w=WALL_PRESETS[+e.target.value];if(!w)return;
    $('wpTh').value=w.th;if(w.mat)$('wpMat').value=w.mat;info();};
  info();}
function wallHitRect(e){const [bx,by]=clientToBase(e),lvl=state.active,arr=WALLS[lvl]||[];const zz=dz(lvl,0);
  const [px,py]=baseToPlan(bx,by,zz);
  for(const r of arr){if(!hitOkWall(r,lvl))continue;          // a wall that is not drawn is not hit (U1, 09-menus)
    if(px>=r.x0-30&&px<=r.x1+30&&py>=r.y0-30&&py<=r.y1+30)return r;}return null;}
function wallPointSnap(e,startPt){const lvl=state.active,zz=dz(lvl,0);let [x,y]=baseToPlan(...clientToBase(e),zz);
  // snap tolerance is a fixed SCREEN distance (px) converted to plan mm, so it stays sane at any zoom
  const tolMM=Math.min(600,140/state.zoom/SC*1);   // ~fixed on screen, capped so it never eats open space
  const tol=Math.max(120,Math.min(600,tolMM));
  let bestD=tol,best=null;
  // 1) nearest existing wall CORNER
  for(const r of (WALLS[lvl]||[])){for(const c of [[r.x0,r.y0],[r.x1,r.y0],[r.x1,r.y1],[r.x0,r.y1]]){
    const d=Math.hypot(x-c[0],y-c[1]);if(d<bestD){bestD=d;best=[c[0],c[1]];}}}
  // 2) if no corner, try snapping to a wall centreline (aligns new walls to existing ones)
  if(!best){for(const r of (WALLS[lvl]||[])){const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,horiz=(r.x1-r.x0)>=(r.y1-r.y0);
    if(horiz&&Math.abs(y-cy)<tol&&x>Math.min(r.x0,r.x1)-tol&&x<Math.max(r.x0,r.x1)+tol){if(Math.abs(y-cy)<bestD){bestD=Math.abs(y-cy);best=[x,cy];}}
    else if(!horiz&&Math.abs(x-cx)<tol&&y>Math.min(r.y0,r.y1)-tol&&y<Math.max(r.y0,r.y1)+tol){if(Math.abs(x-cx)<bestD){bestD=Math.abs(x-cx);best=[cx,y];}}}}
  let p=best?[best[0],best[1]]:[x,y];
  // grid snap when not snapped to geometry
  if(!best&&state.grid){const gs=state.gridSize;p=[Math.round(p[0]/gs)*gs,Math.round(p[1]/gs)*gs];}
  // orthogonal lock relative to the start point (so the 2nd click makes a clean H/V wall)
  if(startPt){const ddx=Math.abs(p[0]-startPt[0]),ddy=Math.abs(p[1]-startPt[1]);
    if(ddx>=ddy)p=[p[0],startPt[1]]; else p=[startPt[0],p[1]];}
  return p;}   // NEVER returns null — degenerate walls are filtered in addWall instead
function addWall(a,b){const T=state.wallThick,dx=Math.abs(b[0]-a[0]),dy=Math.abs(b[1]-a[1]);let r;
  if(dx>=dy){const y=a[1];r={x0:Math.min(a[0],b[0]),y0:y-T/2,x1:Math.max(a[0],b[0]),y1:y+T/2};}
  else{const x=a[0];r={x0:x-T/2,y0:Math.min(a[1],b[1]),x1:x+T/2,y1:Math.max(a[1],b[1])};}
  const len=Math.max(Math.abs(r.x1-r.x0),Math.abs(r.y1-r.y0));if(len<120)return;
  r.layer=curLayer();WALLS[state.active].push(r);SNAP[state.active]=centerlines(WALLS[state.active]);draw&&draw();}
// ---- floor as a polygon: point after point, closing on the first point ----
function polyAreaMM(p){let a=0;for(let i=0,j=p.length-1;i<p.length;j=i++)a+=(p[j][0]*p[i][1]-p[i][0]*p[j][1]);return Math.abs(a/2);}
function polyPerimMM(p,closed){let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);
  if(closed&&p.length>2)L+=Math.hypot(p[0][0]-p[p.length-1][0],p[0][1]-p[p.length-1][1]);return L;}
function addFloorPoly(poly,opt){opt=opt||{};
  if(!poly||poly.length<3||polyAreaMM(poly)<1e5)return -1;      // under 0.1 m² is a misclick, not a room
  data.floors.push({level:opt.level||state.active,poly:poly.map(p=>[p[0],p[1]]),
    fill:opt.fill||'#e2ddd0',name:opt.name||'',layer:curLayer()});
  return data.floors.length-1;}
// ---- the space enclosed by walls around a point ----
// The wall edges cut the plan into a grid of cells; the cells reachable from the clicked one
// without crossing a wall ARE the room. If the flood reaches the outside, the space is not
// closed and the caller says so instead of drawing a floor over half the drawing.
function enclosedOutlineAt(px,py,level){
  const walls=(WALLS[level]||[]).filter(r=>layerShows(r,'wall'));
  if(!walls.length)return null;
  const M=2000;                                   // margin ring, so "escaped to the outside" is detectable
  const xs=new Set(),ys=new Set();
  walls.forEach(r=>{xs.add(r.x0);xs.add(r.x1);ys.add(r.y0);ys.add(r.y1);});
  const bb={x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
  if(px<bb.x0-M||px>bb.x1+M||py<bb.y0-M||py>bb.y1+M)return null;
  xs.add(bb.x0-M);xs.add(bb.x1+M);ys.add(bb.y0-M);ys.add(bb.y1+M);
  const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b);
  const nx=X.length-1,ny=Y.length-1;
  const solid=(i,j)=>{const cx=(X[i]+X[i+1])/2,cy=(Y[j]+Y[j+1])/2;
    return walls.some(r=>cx>r.x0&&cx<r.x1&&cy>r.y0&&cy<r.y1);};
  let ci=-1,cj=-1;
  for(let i=0;i<nx;i++)if(px>=X[i]&&px<=X[i+1]){ci=i;break;}
  for(let j=0;j<ny;j++)if(py>=Y[j]&&py<=Y[j+1]){cj=j;break;}
  if(ci<0||cj<0||solid(ci,cj))return null;         // clicked inside a wall
  const seen=new Set(),stack=[[ci,cj]],cells=[];let escaped=false;
  while(stack.length){const [i,j]=stack.pop(),k=i+','+j;
    if(seen.has(k))continue;seen.add(k);
    if(i<0||j<0||i>=nx||j>=ny){escaped=true;continue;}
    if(solid(i,j))continue;
    if(i===0||j===0||i===nx-1||j===ny-1)escaped=true;   // reached the margin ring: open to the outside
    cells.push({x0:X[i],y0:Y[j],x1:X[i+1],y1:Y[j+1]});
    stack.push([i+1,j],[i-1,j],[i,j+1],[i,j-1]);}
  if(escaped||!cells.length)return null;
  const poly=rectsUnionOutline(cells);
  return (poly&&poly.length>=3)?poly:null;}
function addFloor(a,b){if(Math.abs(b[0]-a[0])<200||Math.abs(b[1]-a[1])<200)return;
  const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
  data.floors.push({level:state.active,poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],fill:'#e2ddd0',layer:curLayer()});}
function viewCentrePlan(){ // plan coords at the middle of the current viewport
  const bcx=(W/2-state.panX)/state.zoom, bcy=(Hh/2-state.panY)/state.zoom;
  return baseToPlanB(bcx,bcy,dz(state.active,0));}
function rectWalls(x0,y0,x1,y1,T,inner){ // four wall rects around a room; inner=true keeps footprint inside
  const o=inner?T/2:0; // if inner, walls sit inside the given rectangle
  const X0=x0,X1=x1,Y0=y0,Y1=y1;
  return [
   {x0:X0-T/2,y0:Y0-T/2,x1:X1+T/2,y1:Y0+T/2}, // north
   {x0:X0-T/2,y0:Y1-T/2,x1:X1+T/2,y1:Y1+T/2}, // south
   {x0:X0-T/2,y0:Y0-T/2,x1:X0+T/2,y1:Y1+T/2}, // west
   {x0:X1-T/2,y0:Y0-T/2,x1:X1+T/2,y1:Y1+T/2}, // east
  ];}
function rectsUnionOutline(rects){ // returns an ordered polygon outline of axis-aligned rects' union
  // collect all x and y grid lines
  const xs=[...new Set(rects.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b);
  const ys=[...new Set(rects.flatMap(r=>[r.y0,r.y1]))].sort((a,b)=>a-b);
  const inside=(cx,cy)=>rects.some(r=>cx>r.x0&&cx<r.x1&&cy>r.y0&&cy<r.y1);
  // build the set of filled cells and trace the boundary via marching edges
  const edges=new Map(); // key "x0,y0,x1,y1" count toggles
  const addEdge=(ax,ay,bx,by)=>{const k=ax<bx||(ax===bx&&ay<by)?`${ax},${ay},${bx},${by}`:`${bx},${by},${ax},${ay}`;
    edges.set(k,(edges.get(k)||0)+1);};
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
    const cx=(xs[i]+xs[i+1])/2,cy=(ys[j]+ys[j+1])/2;if(!inside(cx,cy))continue;
    addEdge(xs[i],ys[j],xs[i+1],ys[j]);addEdge(xs[i+1],ys[j],xs[i+1],ys[j+1]);
    addEdge(xs[i+1],ys[j+1],xs[i],ys[j+1]);addEdge(xs[i],ys[j+1],xs[i],ys[j]);}
  // boundary edges appear an odd number of times (once)
  const bnd=[...edges.entries()].filter(([k,c])=>c%2===1).map(([k])=>k.split(',').map(Number));
  if(!bnd.length)return rects.length?[[rects[0].x0,rects[0].y0],[rects[0].x1,rects[0].y0],[rects[0].x1,rects[0].y1],[rects[0].x0,rects[0].y1]]:[];
  // stitch edges into a loop
  const adj=new Map();const key=(x,y)=>x+','+y;
  bnd.forEach(([x0,y0,x1,y1])=>{(adj.get(key(x0,y0))||adj.set(key(x0,y0),[]).get(key(x0,y0))).push([x1,y1]);
    (adj.get(key(x1,y1))||adj.set(key(x1,y1),[]).get(key(x1,y1))).push([x0,y0]);});
  const start=bnd[0].slice(0,2);const poly=[start];let prev=null,cur=start;
  for(let guard=0;guard<bnd.length*2+4;guard++){const nb=adj.get(key(cur[0],cur[1]))||[];
    const nx=nb.find(n=>!prev||n[0]!==prev[0]||n[1]!==prev[1]);if(!nx)break;
    if(nx[0]===start[0]&&nx[1]===start[1])break;poly.push(nx);prev=cur;cur=nx;}
  // simplify colinear points
  const out=[];for(let i=0;i<poly.length;i++){const a=poly[(i-1+poly.length)%poly.length],b=poly[i],c=poly[(i+1)%poly.length];
    const col=(a[0]===b[0]&&b[0]===c[0])||(a[1]===b[1]&&b[1]===c[1]);if(!col)out.push(b);}
  return out.length>=3?out:poly;}
function snapRectToWalls(rc,level){ // shift a rect so its nearest edge sticks to a nearby wall centreline
  const tol=400,walls=WALLS[level]||[];let dx=0,dy=0,bestX=tol,bestY=tol;
  walls.forEach(r=>{const horiz=(r.x1-r.x0)>=(r.y1-r.y0),cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
    if(horiz){[rc.y0,rc.y1].forEach(ry=>{const dd=Math.abs(ry-cy);if(dd<bestY){bestY=dd;dy=cy-ry;}});}
    else{[rc.x0,rc.x1].forEach(rx=>{const dd=Math.abs(rx-cx);if(dd<bestX){bestX=dd;dx=cx-rx;}});}});
  return {x0:rc.x0+dx,y0:rc.y0+dy,x1:rc.x1+dx,y1:rc.y1+dy};}
// ---- visual wall merge: the outline of a union of axis-aligned rectangles ----
// Walls overlap at every corner and butt end-to-end along a run, so drawing each
// rectangle's own outline leaves the seams that make a finished plan look chopped up.
// This keeps only the edge pieces that are genuinely on the OUTSIDE: an edge piece is
// dropped when the space just outside it belongs to another rectangle. Corners come out
// symmetric for free, because the surviving pieces meet on the union boundary.
// Nothing is stored — the walls themselves are untouched and stay individually selectable.
const WMERGE_EPS=0.6;   // mm — how far outside an edge we look for a neighbour
function rectsUnionSegs(rects){const out=[];
  const inside=(x,y,q)=>x>q.x0+WMERGE_EPS&&x<q.x1-WMERGE_EPS&&y>q.y0+WMERGE_EPS&&y<q.y1-WMERGE_EPS;
  rects.forEach((r,ri)=>{
    // each edge, with the outward normal that says which side is "not this rectangle"
    const edges=[{a:[r.x0,r.y0],b:[r.x1,r.y0],n:[0,-1],horiz:true},
                 {a:[r.x0,r.y1],b:[r.x1,r.y1],n:[0, 1],horiz:true},
                 {a:[r.x0,r.y0],b:[r.x0,r.y1],n:[-1,0],horiz:false},
                 {a:[r.x1,r.y0],b:[r.x1,r.y1],n:[ 1,0],horiz:false}];
    edges.forEach(e=>{
      const lo=e.horiz?e.a[0]:e.a[1], hi=e.horiz?e.b[0]:e.b[1];
      // cut the edge wherever a neighbour starts or ends, then judge each piece on its own
      const cuts=[lo,hi];
      rects.forEach((q,qi)=>{if(qi===ri)return;
        (e.horiz?[q.x0,q.x1]:[q.y0,q.y1]).forEach(v=>{if(v>lo+WMERGE_EPS&&v<hi-WMERGE_EPS)cuts.push(v);});});
      cuts.sort((x,y)=>x-y);
      let run=null;   // merge adjacent surviving pieces back into one segment
      for(let i=0;i<cuts.length-1;i++){const c0=cuts[i],c1=cuts[i+1];if(c1-c0<WMERGE_EPS)continue;
        const m=(c0+c1)/2;
        const px=(e.horiz?m:e.a[0])+e.n[0]*WMERGE_EPS*2, py=(e.horiz?e.a[1]:m)+e.n[1]*WMERGE_EPS*2;
        const buried=rects.some((q,qi)=>qi!==ri&&inside(px,py,q));
        if(buried){if(run){out.push(run);run=null;}continue;}
        if(run)run[e.horiz?2:3]=c1;
        else run=e.horiz?[c0,e.a[1],c1,e.a[1]]:[e.a[0],c0,e.a[0],c1];}
      if(run)out.push(run);});});
  return out;}
// the wall rectangles of a level that are actually drawn, as plain rects
function wallMergeOn(){return state.style==='blueprint'||state.wallMerge===true;}

// ---- wall refine — the PLAN (round 2026-10-10, WP-G2; rules in docs/round-2026-10-10/01_MATERIAL §6) ----
// Pure: reads WALLS[level], returns what refining would move, mutates nothing. Every L corner becomes the full square of
// the two bands, every T stem stops exactly on the through wall's face (Q-G02 = A; B = the nearest exact form per
// junction, C = stems through to the far face). The wall tool snaps to the partner's CENTRELINE, which leaves a notch
// outside and half an overlap inside every L — that is the "not clean" corner this fixes.
// Coordinates are first rounded to 1 mm (P33's were fractional after a 180° turn), so targets are whole mm and a second
// run finds nothing to do. The result: {round, junctions[{type,a,b,moves,multi?}], collinear[], skipped[{ids,why}], moves}.
function wrfPlan(level,opt){opt=opt||{};const form=opt.form||'A',H=wallH(level);
  const all=(WALLS[level]||[]).filter(r=>r&&r.id&&(!opt.layer||(r.layer||'L0')===opt.layer)&&layerShows(r,'wall'));
  const R={},round=[];   // id → the wall after the 1 mm pre-pass
  all.forEach(r=>{const q={id:r.id,x0:Math.round(r.x0),x1:Math.round(r.x1),y0:Math.round(r.y0),y1:Math.round(r.y1),z0:r.z0||0,h:r.h||H,
    lock:!!layerById(r.layer||'L0').lock,horiz:(r.x1-r.x0)>=(r.y1-r.y0)};R[r.id]=q;
    if(q.x0!==r.x0||q.x1!==r.x1||q.y0!==r.y0||q.y1!==r.y1)round.push(r.id);});
  const W=Object.values(R),Hs=W.filter(q=>q.horiz),Vs=W.filter(q=>!q.horiz);
  const out={round,junctions:[],collinear:[],skipped:[],moves:[]},cand=[];   // cand: {id,end,to,j,dist}
  for(const A of Hs)for(const B of Vs){
    if(Math.abs(A.z0-B.z0)>10||A.z0>10||B.z0>10)continue;          // raised walls (lebegő fal, pengefal) take no part
    const tA=A.y1-A.y0,tB=B.x1-B.x0,TOL=Math.max(60,1.5*Math.max(tA,tB));
    if(!(A.x0<=B.x1+TOL&&A.x1>=B.x0-TOL&&B.y0<=A.y1+TOL&&B.y1>=A.y0-TOL))continue;
    const passA=A.x0<B.x0-TOL&&A.x1>B.x1+TOL,passB=B.y0<A.y0-TOL&&B.y1>A.y1+TOL;
    const type=passA&&passB?'X':(passA||passB)?'T':'L',j={type,a:A.id,b:B.id,moves:[]};out.junctions.push(j);
    if(type==='X')continue;
    if(A.lock||B.lock){out.skipped.push({ids:[A.id,B.id],why:'zárolt'});j.skip=true;continue;}
    const cA=(A.y0+A.y1)/2,cB=(B.x0+B.x1)/2;
    const aEnd=Math.abs(A.x0-cB)<=Math.abs(A.x1-cB)?'x0':'x1',bEnd=Math.abs(B.y0-cA)<=Math.abs(B.y1-cA)?'y0':'y1';
    // B's faces seen from A's near end: the one towards A's body (near) and away from it (outer); likewise for A
    const bNear=aEnd==='x0'?B.x1:B.x0,bOuter=aEnd==='x0'?B.x0:B.x1,aNear=bEnd==='y0'?A.y1:A.y0,aOuter=bEnd==='y0'?A.y0:A.y1;
    const cost=ms=>ms.reduce((s,m)=>s+Math.abs(R[m.id][m.end]-m.to),0);
    let ms;
    if(type==='T'){const stem=passA?{id:B.id,end:bEnd,near:aNear,far:aOuter}:{id:A.id,end:aEnd,near:bNear,far:bOuter};
      const butt=[{id:stem.id,end:stem.end,to:stem.near}],thru=[{id:stem.id,end:stem.end,to:stem.far}];
      ms=form==='C'?thru:form==='B'?(cost(thru)<cost(butt)?thru:butt):butt;}
    else{const square=[{id:A.id,end:aEnd,to:bOuter},{id:B.id,end:bEnd,to:aOuter}],
        aOwns=[{id:A.id,end:aEnd,to:bOuter},{id:B.id,end:bEnd,to:aNear}],bOwns=[{id:A.id,end:aEnd,to:bNear},{id:B.id,end:bEnd,to:aOuter}];
      ms=form==='B'?[square,aOwns,bOwns].reduce((best,f)=>cost(f)<cost(best)?f:best,square):square;}
    ms.forEach(m=>{const w=R[m.id],dist=m.id===A.id?Math.abs(w[m.end]-cB):Math.abs(w[m.end]-cA);cand.push({...m,j,dist});});}
  // one end, two junctions (a three-wall meeting): the end belongs to the junction whose partner band is nearest
  const byEnd={};cand.forEach(c=>{(byEnd[c.id+'.'+c.end]=byEnd[c.id+'.'+c.end]||[]).push(c);});
  const keep=[];Object.values(byEnd).forEach(L=>{L.sort((p,q)=>p.dist-q.dist);keep.push(L[0]);
    L[0].js=L.filter(c=>c.to===L[0].to).map(c=>c.j);   // a shared end (same target from two junctions) counts for both
    if(L.some(c=>c.to!==L[0].to)){L.forEach(c=>{c.j.multi=true;});out.skipped.push({ids:[...new Set(L.flatMap(c=>[c.j.a,c.j.b]))],why:'többszörös csomópont'});}});
  // collinear pairs: same orientation, bands overlapping, ends within TOL — a ≤ 20 mm band offset is snapped and the gap closed
  [[Hs,'x','y'],[Vs,'y','x']].forEach(([L,u,v])=>{for(let i=0;i<L.length;i++)for(let k=i+1;k<L.length;k++){const P=L[i],Q=L[k];
    if(!(P[v+'0']<Q[v+'1']&&Q[v+'0']<P[v+'1']))continue;
    const TOL=Math.max(60,1.5*Math.max(P[v+'1']-P[v+'0'],Q[v+'1']-Q[v+'0']));
    const [l,r]=P[u+'0']<=Q[u+'0']?[P,Q]:[Q,P],gap=r[u+'0']-l[u+'1'];if(Math.abs(gap)>TOL)continue;
    const off=Math.abs((P[v+'0']+P[v+'1'])/2-(Q[v+'0']+Q[v+'1'])/2),entry={a:P.id,b:Q.id,offset:Math.round(off),gap:Math.round(gap)};out.collinear.push(entry);
    if(off>20||(off<0.5&&gap===0))continue;                          // a deliberate step in the wall, or already exact
    if(P.lock||Q.lock){out.skipped.push({ids:[P.id,Q.id],why:'zárolt'});continue;}
    const [lo,hi]=(P[u+'1']-P[u+'0'])<(Q[u+'1']-Q[u+'0'])?[P,Q]:[Q,P],dv=(hi[v+'0']+hi[v+'1'])/2-(lo[v+'0']+lo[v+'1'])/2;
    entry.band=Math.round(dv);
    keep.push({id:lo.id,end:v+'0',to:lo[v+'0']+dv,band:true},{id:lo.id,end:v+'1',to:lo[v+'1']+dv,band:true});
    if(gap!==0)keep.push(lo===l?{id:lo.id,end:u+'1',to:r[u+'0']}:{id:lo.id,end:u+'0',to:l[u+'1']});}});
  // guards: a move longer than max(300, 2 × thickness), a wall left under 120 mm, an opening left outside its wall
  const next={};W.forEach(q=>{next[q.id]={...q};});
  const real=keep.filter(m=>Math.abs(R[m.id][m.end]-m.to)>=0.5);
  const bad=new Set();
  real.forEach(m=>{const q=R[m.id],t=q.horiz?q.y1-q.y0:q.x1-q.x0;if(!m.band&&Math.abs(q[m.end]-m.to)>Math.max(300,2*t)){bad.add(m);out.skipped.push({ids:[m.id],why:'kézi ellenőrzés — '+Math.round(Math.abs(q[m.end]-m.to))+' mm mozgás'});}});
  real.filter(m=>!bad.has(m)).forEach(m=>{next[m.id][m.end]=m.to;});
  W.forEach(q=>{const n=next[q.id],len=q.horiz?n.x1-n.x0:n.y1-n.y0;let why=null;
    if(len<120)why='túl rövid fal ('+Math.round(len)+' mm)';
    else (data.openings||[]).forEach(o=>{if(o.level!==level||why||opnHost(o)!==WALLS[level].find(r=>r.id===q.id))return;
      const w=o.w||(o.type==='window'?WIN_W:DOOR_W),u=q.horiz?o.x:o.y;if(u-w/2<(q.horiz?n.x0:n.y0)-1||u+w/2>(q.horiz?n.x1:n.y1)+1)why='nyílászáró a falon kívül';});
    if(why){real.filter(m=>m.id===q.id&&!bad.has(m)).forEach(m=>bad.add(m));out.skipped.push({ids:[q.id],why});}});
  out.moves=real.filter(m=>!bad.has(m)).map(m=>({id:m.id,end:m.end,from:R[m.id][m.end],to:m.to,band:!!m.band,js:m.js||[]}));
  out.moves.forEach(m=>{m.js.forEach(j=>j.moves.push({id:m.id,end:m.end,from:m.from,to:m.to}));delete m.js;});
  return out;}
// the dry-run numbers the dialog (and the ⏸ report) show
function wrfSummary(p){const n=t=>p.junctions.filter(j=>j.type===t).length,big=p.moves.reduce((m,x)=>Math.max(m,Math.abs(x.to-x.from)),0);
  return {L:n('L'),T:n('T'),X:n('X'),collinear:p.collinear.length,exact:p.junctions.filter(j=>j.type!=='X'&&!j.skip&&!j.multi&&!j.moves.length).length,
    moves:p.moves.length,maxMove:Math.round(big),rounded:p.round.length,
    multi:p.skipped.filter(s=>s.why==='többszörös csomópont').length,skipped:p.skipped.map(s=>s.ids.join('+')+': '+s.why)};}
function createRoom(opt){ // opt {rects:[{w,d,ox,oy}]|w,d, name,mat,walls,thick,cx,cy,level,snap}
  const lvl=opt.level||state.active;
  let cx=opt.cx,cy=opt.cy;if(cx==null||cy==null){const c=viewCentrePlan();cx=c[0];cy=c[1];}
  if(state.grid){cx=Math.round(cx/state.gridSize)*state.gridSize;cy=Math.round(cy/state.gridSize)*state.gridSize;}
  // build the list of rectangles (single, or several with per-rect offset for L/T/U shapes)
  let rects;
  if(opt.rects&&opt.rects.length){rects=opt.rects.map(r=>{const w=Math.max(300,r.w),d=Math.max(300,r.d),ox=r.ox||0,oy=r.oy||0;
    return {x0:cx+ox-w/2,y0:cy+oy-d/2,x1:cx+ox+w/2,y1:cy+oy+d/2};});}
  else{const w=Math.max(300,opt.w||3000),d=Math.max(300,opt.d||3000);rects=[{x0:cx-w/2,y0:cy-d/2,x1:cx+w/2,y1:cy+d/2}];}
  if(opt.snap){rects=rects.map(r=>snapRectToWalls(r,lvl));}
  pushUndo();
  const poly=rects.length>1?rectsUnionOutline(rects):[[rects[0].x0,rects[0].y0],[rects[0].x1,rects[0].y0],[rects[0].x1,rects[0].y1],[rects[0].x0,rects[0].y1]];
  data.floors.push({level:lvl,poly,fill:opt.fill||'#e9e5da',name:opt.name||'',mat:opt.mat||'hidegburkolat',layer:curLayer()});
  if(opt.walls){const T=opt.thick||state.wallThick||100;
    // frame each rectangle; overlapping/duplicate wall segments are harmless (centerlines de-dups snap)
    rects.forEach(rc=>rectWalls(rc.x0,rc.y0,rc.x1,rc.y1,T).forEach(r=>{r.layer=curLayer();WALLS[lvl].push(r);}));
    SNAP[lvl]=centerlines(WALLS[lvl]);}
  draw();$('hud').textContent=`Helyiség létrehozva: ${opt.name||'névtelen'} (${rects.length} rész)`;}
let roomMats=['hidegburkolat','parketta','laminált','beton','szőnyeg','csempe','járólap','OSB'];
let crRects=[];
function crRowHtml(r,i){return `<div class="mrow crRect" data-i="${i}" style="gap:4px">`
  +`<b style="width:16px">${i+1}.</b> Sz <input class="crW" type="number" value="${r.w}" style="width:70px"> M <input class="crD" type="number" value="${r.d}" style="width:70px">`
  +(i>0?` eltol X <input class="crOX" type="number" value="${r.ox||0}" style="width:60px"> Y <input class="crOY" type="number" value="${r.oy||0}" style="width:60px">`:`<span style="color:#aaa;font-size:11px">(alap)</span>`)
  +(i>0?` <button class="crDel" title="rész törlése">✕</button>`:``)+`</div>`;}
function crRefresh(){const box=$('crRects');if(!box)return;box.innerHTML=crRects.map(crRowHtml).join('');
  box.querySelectorAll('.crRect').forEach(row=>{const i=+row.dataset.i;
    const g=(sel)=>row.querySelector(sel);
    g('.crW').oninput=e=>{crRects[i].w=+e.target.value||300;crArea();};
    g('.crD').oninput=e=>{crRects[i].d=+e.target.value||300;crArea();};
    if(g('.crOX'))g('.crOX').oninput=e=>{crRects[i].ox=+e.target.value||0;};
    if(g('.crOY'))g('.crOY').oninput=e=>{crRects[i].oy=+e.target.value||0;};
    if(g('.crDel'))g('.crDel').onclick=()=>{crRects.splice(i,1);crRefresh();crArea();};});}
function crArea(){const el=$('crArea');if(!el)return;const a=crRects.reduce((t,r)=>t+r.w*r.d,0);
  el.textContent='terület (max): '+(a/1e6).toFixed(2).replace('.',',')+' m²'+(crRects.length>1?' — L/T/U alakzat':'');}
function openCreateRoom(){
  crRects=[{w:3600,d:3000}];
  const rows=`<div class="mrow">Név <input id="crN" placeholder="pl. HÁLÓSZOBA" style="width:180px"></div>`
   +`<div id="crRects"></div>`
   +`<div class="mrow"><button id="crAdd" style="font-size:12px">＋ Újabb téglalap (L/T/U alak)</button></div>`
   +`<div class="mrow" id="crArea" style="font-size:11.5px;color:#777">terület: 10,80 m²</div>`
   +`<div class="mrow">Burkolat <select id="crM" style="width:150px">${roomMats.map(m=>`<option>${m}</option>`).join('')}</select></div>`
   +`<div class="mrow"><label><input type="checkbox" id="crWalls" checked> Falakkal körbevéve</label>`
   +`<span style="margin-left:8px">vastagság <input id="crT" type="number" value="${state.wallThick||100}" style="width:60px"> mm</span></div>`
   +`<div class="mrow"><label><input type="checkbox" id="crSnap"> Meglévő falhoz illesztés</label></div>`
   +`<div class="mrow" style="font-size:11px;color:#888">A nézet közepére kerül. Több téglalappal L/T/U alak; a 2.+ résznél add meg az eltolást az 1. rész közepéhez képest. Utána a ✥ Move eszközzel igazítható.</div>`;
  openModal('Helyiség létrehozása',rows,()=>{
    createRoom({rects:crRects.map(r=>({w:r.w,d:r.d,ox:r.ox,oy:r.oy})),name:$('crN').value.trim(),mat:$('crM').value,
      walls:$('crWalls').checked,thick:+$('crT').value||state.wallThick,snap:$('crSnap').checked});
  },'Létrehoz');
  crRefresh();crArea();
  $('crAdd').onclick=()=>{const base=crRects[0]||{w:3600,d:3000};
    // place the wing so it overlaps the base's lower edge → forms a proper L (shared edge, not corner)
    crRects.push({w:Math.round(base.w*0.5),d:Math.round(base.d*0.7),ox:Math.round(base.w*0.25),oy:Math.round(base.d*0.6)});
    crRefresh();crArea();};
  setTimeout(()=>{$('crN')&&$('crN').focus();},50);}

