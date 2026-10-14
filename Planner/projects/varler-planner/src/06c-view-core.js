// ==========================================================================
// 06c-view-core.js — the view core (Views WP V1, docs/views/PRIMER-VIEWS.md)
//
// One pure function, viewRender(def), turns a level of the model into a TAGGED primitive list
// and an SVG drawn from it through a style sheet. Every later look (the clean axo, the exploded
// house, the stack plates, the time-of-day palettes) is a different view definition or a
// different style over the same primitives; nothing here touches draw() or the 3D view.
//
// The geometry is the grid painter proven by tools/p33-axo.js (V0). Planner walls are axis-aligned
// boxes and rooms are orthogonal, so every edge coordinate becomes a grid line; each cell holds a
// column of solid z-intervals (plinth, wall, lintel, sill, furniture). For a camera on the (cx, cy)
// side of the plan, drawing far cells first along each axis is an exact painter's order: two
// disjoint cells either share a row/column (the far one goes first) or are separated in both x and
// y, and then their screen projections cannot overlap. Only real edges get a stroke.
//
// viewWallClass() is the one wall classifier: the cutaway wall mode in the 3D view (V3) uses it
// against the live camera, this core against its own.
// ==========================================================================

const VIEW_DEF={level:'ground',yaw:225,pitch:50,k:0.105,cut:1500,nearCut:1000,plinth:200,style:'tiszta',
  labels:true,devices:true,objects:true,pad:40};

// ---- style sheets: data, keyed on the primitive tags ----
const VIEW_STYLES={
 tiszta:{name:'Tiszta axonometria',paper:'#f7f6f2',ink:'#262624',inkSoft:'#6d6a63',objInk:'#9a968c',
  face:{'wall.top.full':'#ffffff','wall.top.cut':'#c9c3b6','wall.a':'#efede8','wall.b':'#dddad3',
        'obj.top':'#fbfaf6','obj.a':'#f6f5f1','obj.b':'#ebe9e3','plinth.a':'#e6e3dc','plinth.b':'#d3cfc6','thresh':'#ebe8e1','plate.top':'#fdfcf9','plate.side':'#e4e0d7'},
  width:{wall:1.15,obj:0.75,plinth:1.0,base:0.6,room:0.45,drop:0.5,leader:0.6,plate:0.8,ghost:0.7,route:1.6},plateOp:0.34,ghostOp:0.55,
  font:"Jost,'Segoe UI',Arial,sans-serif",mono:"'Azeret Mono',Consolas,monospace"}};

// room floor tone from the room's name (Hungarian keywords); the style may override per name
function viewRoomTone(name){const n=(name||'').toLowerCase();
  if(/fürdő|wc|mosdó|zuhany/.test(n))return '#d3e6ef';
  if(/nappali|living/.test(n))return '#dce9c9';
  if(/szoba|háló|gyerek|dolgozó/.test(n))return '#f1eac0';
  if(/konyha|étkez/.test(n))return '#f3d9c6';
  if(/előszoba|közlekedő|folyosó|hall/.test(n))return '#efe4c8';
  if(/lépcső/.test(n))return '#e3e0da';
  if(/kamra|tároló|gardrób|kazán|gépház|mosókonyha/.test(n))return '#e6e1d5';
  if(/terasz|erkély|kert|loggia/.test(n))return '#e4ead9';
  return '#ece8de';}

function viewInBox(x,y,b){return x>b.x0&&x<b.x1&&y>b.y0&&y<b.y1;}
function viewWallHoriz(r){return (r.x1-r.x0)>=(r.y1-r.y0);}

// 'int' | 'near' | 'far' per wall. cx, cy: +1 when the camera is on the + side of that plan axis,
// −1 on the − side, 0 when the camera looks along the other axis (edge-on: never lowered).
// Near = an exterior wall whose open side faces the camera (Sims cutaway); far = open side away.
function viewWallClass(walls,rooms,cx,cy){const out=new Map(),m=60;
  const probe=(w,px,py)=>rooms.some(rm=>pointInPoly(px,py,rm.poly))||walls.some(o=>o!==w&&viewInBox(px,py,o));
  for(const w of walls){const h=viewWallHoriz(w),mx=(w.x0+w.x1)/2,my=(w.y0+w.y1)/2;
    const lo=h?probe(w,mx,w.y0-m):probe(w,w.x0-m,my),hi=h?probe(w,mx,w.y1+m):probe(w,w.x1+m,my);
    if(lo===hi){out.set(w,'int');continue;}                       // closed both sides, or free-standing
    const open=hi?-1:1,c=h?cy:cx;
    out.set(w,c!==0&&open===c?'near':'far');}
  return out;}

// the wall tops for a cutaway: far walls keep their height, interior → cut, near exterior → nearCut
function viewWallTops(walls,cls,full,cut,nearCut){const out=new Map();
  for(const w of walls){const H=w.h||full,c=cls.get(w);out.set(w,c==='far'?H:Math.min(H,c==='near'?nearCut:cut));}
  return out;}

// a true orthographic camera: plan rotated by yaw, squashed by the pitch; near = larger ry
function viewCamera(yaw,pitch,k){const Y=yaw*Math.PI/180,P=pitch*Math.PI/180,sY=Math.sin(Y),cY=Math.cos(Y),sP=Math.sin(P),cP=Math.cos(P);
  const sg=v=>Math.abs(v)<1e-9?0:Math.sign(v);
  return {prj:(x,y,z)=>{const rx=x*cY-y*sY,ry=x*sY+y*cY;return [rx*k,(ry*sP-z*cP)*k];},cx:sg(sY),cy:sg(cY)};}

// ---- the model of one level, read from the Planner's own collections ----
function viewModel(level){
  const walls=(WALLS[level]||[]).filter(r=>layerShows(r,'wall'));
  const rooms=allRooms(level).map(e=>e.rm).filter(rm=>rm.poly&&rm.poly.length>2&&(!rm.layer||layerShows(rm,'build')));
  const openings=data.openings.filter(o=>o.level===level&&o.type!=='stairs'&&layerShows(o,'build'));
  const objects=data.objects.filter(o=>o.level===level&&!o.boardFor&&!o.autoObj&&layerShows(o,'object')&&!(isGenObject(o)&&!genObjectsVisible()));
  const devices=data.devices.filter(d=>d.level===level&&d.type!=='junction'&&layerShows(d));
  const entry=(data.marks||[]).filter(m=>m.level===level&&m.kind==='opening'&&(m.tags||[]).includes('bejarat'))
    .map(m=>data.openings.find(o=>o.id===m.op)).filter(Boolean)[0]||null;
  return {level,walls,rooms,openings,objects,devices,entry,H:wallH(level)};}

// ---- the renderer ----
function viewRender(defIn){const def=Object.assign({},VIEW_DEF,defIn||{}),S=VIEW_STYLES[def.style]||VIEW_STYLES.tiszta;
  const M=def.model||viewModel(def.level),cam=def.camera||viewCamera(def.yaw,def.pitch,def.k),prj=cam.prj,CX=cam.cx,CY=cam.cy;
  const {walls,rooms,H}=M;
  const cls=viewWallClass(walls,rooms,CX,CY),tops=viewWallTops(walls,cls,H,def.cut,def.nearCut);
  const roomAt=(x,y)=>{for(let k=rooms.length-1;k>=0;k--)if(pointInPoly(x,y,rooms[k].poly))return rooms[k];return null;};
  // openings: a plan rectangle across the host wall + the vertical gap
  const opens=[];for(const o of M.openings){const host=walls.find(r=>viewInBox(o.x,o.y,{x0:r.x0-1,y0:r.y0-1,x1:r.x1+1,y1:r.y1+1}));if(!host)continue;
    const win=o.type==='window',w=o.w||(win?WIN_W:DOOR_W),sill=o.sill!=null?o.sill:(win?WIN_SILL:0),top=sill+(o.h||(win?WIN_H:DOOR_H));
    const b=viewWallHoriz(host)?{x0:o.x-w/2,x1:o.x+w/2,y0:host.y0,y1:host.y1}:{x0:host.x0,x1:host.x1,y0:o.y-w/2,y1:o.y+w/2};
    opens.push(Object.assign(b,{a:sill,b:top,host}));}
  // objects: axis-aligned boxes go in the grid, anything else is a sprite drawn after its cell
  const quarter=a=>{const q=((a||0)%(Math.PI/2)+Math.PI/2)%(Math.PI/2);return q<1e-3||Math.PI/2-q<1e-3;};
  const objBox=o=>{const sw=Math.abs(Math.sin(o.ang||0))>0.5,w=sw?o.d:o.w,d=sw?o.w:o.d;return {x0:o.x-w/2,x1:o.x+w/2,y0:o.y-d/2,y1:o.y+d/2};};
  const gridObjs=def.objects?M.objects.filter(o=>quarter(o.ang)):[],sprites=def.objects?M.objects.filter(o=>!quarter(o.ang)):[];
  // the grid
  const xs=new Set(),ys=new Set(),add=b=>{xs.add(Math.round(b.x0));xs.add(Math.round(b.x1));ys.add(Math.round(b.y0));ys.add(Math.round(b.y1));};
  walls.forEach(add);opens.forEach(add);gridObjs.forEach(o=>add(objBox(o)));
  rooms.forEach(r=>r.poly.forEach(([x,y])=>{xs.add(Math.round(x));ys.add(Math.round(y));}));
  // V5 explode: rooms lifted by (rank + 1) × step; a wall between two rooms is split at its centreline (D-V5-1 A)
  const EX=def.explode&&!def.plates?viewExplodeOrder(M):null,   // V6: plates stand on the plain house
   step=EX?(+def.explode.step||900):0,liftOf=new Map();
  if(EX){EX.forEach(e=>liftOf.set(e.room,(e.rank+1)*step));
    for(const w of walls)if(viewWallRooms(w,rooms).length===2){if(viewWallHoriz(w))ys.add(Math.round((w.y0+w.y1)/2));else xs.add(Math.round((w.x0+w.x1)/2));}}
  const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b),NI=Math.max(0,X.length-1),NJ=Math.max(0,Y.length-1);
  const col=[],roomOf=[];
  for(let i=0;i<NI;i++){col.push([]);roomOf.push([]);for(let j=0;j<NJ;j++){
    const cx=(X[i]+X[i+1])/2,cy=(Y[j]+Y[j+1])/2,w=walls.find(r=>viewInBox(cx,cy,r)),rm=roomAt(cx,cy),L=[];
    roomOf[i].push(rm);
    if(w||rm){
      L.push({a:-def.plinth,b:0,top:rm?'floor':'thresh',kind:'plinth'});
      if(w){const top=tops.get(w),op=opens.find(o=>o.host===w&&viewInBox(cx,cy,o))||opens.find(o=>viewInBox(cx,cy,o));
        const tt=top>=(w.h||H)?'wall.top.full':'wall.top.cut';
        if(op){if(op.a>0)L.push({a:0,b:Math.min(op.a,top),top:tt,kind:'wall'});if(op.b<top)L.push({a:op.b,b:top,top:tt,kind:'wall'});}
        else L.push({a:(w.z0||0),b:top,top:tt,kind:'wall'});}
      for(const o of gridObjs)if(viewInBox(cx,cy,objBox(o)))L.push({a:o.z||0,b:(o.z||0)+(o.ht||o.h||600),top:'obj.top',kind:'obj'});}
    col[i].push(viewMergeIv(L));}}
  const own=[],liftAt=[];
  if(EX)for(let i=0;i<NI;i++){own.push([]);liftAt.push([]);for(let j=0;j<NJ;j++){
    let o=roomOf[i][j];const cx=(X[i]+X[i+1])/2,cy=(Y[j]+Y[j+1])/2,w=o?null:walls.find(r=>viewInBox(cx,cy,r));
    if(!o&&w){const h=viewWallHoriz(w),side=h?(cy<(w.y0+w.y1)/2?-1:1):(cx<(w.x0+w.x1)/2?-1:1);
      const walk=(di,dj)=>{for(let k=1;k<=8;k++){const ii=i+di*k,jj=j+dj*k;if(ii<0||jj<0||ii>=NI||jj>=NJ)return null;if(roomOf[ii][jj])return roomOf[ii][jj];}return null;};
      o=h?(walk(0,side)||walk(0,-side)||walk(-1,0)||walk(1,0)):(walk(side,0)||walk(-side,0)||walk(0,-1)||walk(0,1));}
    own[i].push(o||null);}}
  // corners and stubs no walk reached: the owner of the nearest owned solid neighbour (a flood through solid cells)
  if(EX){let q=[];for(let i=0;i<NI;i++)for(let j=0;j<NJ;j++)if(own[i][j])q.push([i,j]);
    while(q.length){const nx=[];for(const [i,j] of q)for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+di,jj=j+dj;
        if(ii<0||jj<0||ii>=NI||jj>=NJ||own[ii][jj]||!col[ii][jj].length)continue;own[ii][jj]=own[i][j];nx.push([ii,jj]);}q=nx;}
    for(let i=0;i<NI;i++)for(let j=0;j<NJ;j++){const L=own[i][j]&&liftOf.get(own[i][j])||0;liftAt[i].push(L);
      if(L)col[i][j]=col[i][j].map(v=>Object.assign({},v,{a:v.a+L,b:v.b+L}));}}
  const cell=(i,j)=>(i<0||j<0||i>=NI||j>=NJ)?[]:col[i][j];
  const hasTop=(i,j,z)=>cell(i,j).some(v=>Math.abs(v.b-z)<0.5);
  // the faces the camera sees: on the camera side of each axis
  const fx=CX<0?{d:-1,at:i=>X[i]}:{d:1,at:i=>X[i+1]},fy=CY<0?{d:-1,at:j=>Y[j]}:{d:1,at:j=>Y[j+1]};
  const expX=(i,j,a,b)=>viewMinus(a,b,cell(i+fx.d,j)),expY=(i,j,a,b)=>viewMinus(a,b,cell(i,j+fy.d));
  const P=[];   // the primitive list, in painter order
  let grp=null;   // V5: the owner room of the cell being drawn, on every primitive (slice 2 animates by it)
  const poly=(t,pts,extra)=>P.push(Object.assign({k:'poly',t,p:pts},EX?{grp}:null,extra||{}));
  const line=(t,a,b,w)=>P.push(EX?{k:'line',t,a,b,w,grp}:{k:'line',t,a,b,w});
  const devAt=new Map();
  function column(i,j){const x0=X[i],x1=X[i+1],y0=Y[j],y1=Y[j+1];if(EX)grp=own[i][j]?viewRoomKey(own[i][j]):null;
    for(const iv of cell(i,j)){const K=iv.kind,ek='edge.'+K,z=iv.b;
      if(CX!==0){const x=fx.at(i);
        for(const [a,b] of expX(i,j,iv.a,iv.b)){
          poly(K+'.a',[prj(x,y0,a),prj(x,y1,a),prj(x,y1,b),prj(x,y0,b)]);
          line(ek,prj(x,y0,a),prj(x,y1,a),K);if(b<iv.b-0.5)line(ek,prj(x,y0,b),prj(x,y1,b),K);
          for(const [jj,yy] of [[j-1,y0],[j+1,y1]])
            for(const [p,q] of viewMinusR(a,b,cell(i,jj).length?expX(i,jj,a,b):[]))line(ek,prj(x,yy,p),prj(x,yy,q),K);}}
      if(CY!==0){const y=fy.at(j);
        for(const [a,b] of expY(i,j,iv.a,iv.b)){
          poly(K+'.b',[prj(x0,y,a),prj(x1,y,a),prj(x1,y,b),prj(x0,y,b)]);
          line(ek,prj(x0,y,a),prj(x1,y,a),K);if(b<iv.b-0.5)line(ek,prj(x0,y,b),prj(x1,y,b),K);
          for(const [ii,xx] of [[i-1,x0],[i+1,x1]])
            for(const [p,q] of viewMinusR(a,b,cell(ii,j).length?expY(ii,j,a,b):[]))line(ek,prj(xx,y,p),prj(xx,y,q),K);}}
      if(cell(i,j).some(o=>Math.abs(o.a-z)<0.5))continue;          // something sits right on this top
      const rm=roomOf[i][j];
      poly(iv.top==='floor'?'floor':iv.top,[prj(x0,y0,z),prj(x1,y0,z),prj(x1,y1,z),prj(x0,y1,z)],iv.top==='floor'?{room:rm&&(rm.num||rm.name||''),fill:(S.room&&rm&&S.room[rm.num])||viewRoomTone(rm&&rm.name)}:null);
      const edge=(ni,nj,a,b)=>{
        if(hasTop(ni,nj,z)){if(K==='plinth'&&rm&&roomOf[ni]&&roomOf[ni][nj]&&roomOf[ni][nj]!==rm)line('edge.room',a,b,'room');return;}
        line(ek,a,b,K==='plinth'&&!cell(ni,nj).length?'plinth':K==='plinth'?'base':K);};
      edge(i-1,j,prj(x0,y0,z),prj(x0,y1,z));edge(i+1,j,prj(x1,y0,z),prj(x1,y1,z));
      edge(i,j-1,prj(x0,y0,z),prj(x1,y0,z));edge(i,j+1,prj(x0,y1,z),prj(x1,y1,z));}
    const d=devAt.get(i+','+j);if(d)d.forEach(f=>f());}
  const findIdx=(arr,v)=>{let lo=0,hi=arr.length-2;while(lo<hi){const m=(lo+hi+1)>>1;if(arr[m]<=v)lo=m;else hi=m-1;}return Math.max(0,lo);};
  const liftXY=(x,y)=>EX?liftAt[findIdx(X,x)][findIdx(Y,y)]||0:0;
  const later=(x,y,fn)=>{const k=findIdx(X,x)+','+findIdx(Y,y);if(!devAt.has(k))devAt.set(k,[]);devAt.get(k).push(fn);};
  // sprites: a rotated box, its visible faces sorted, drawn after the cell under its centre
  for(const o of sprites){const sl=liftXY(o.x,o.y);later(o.x,o.y,()=>{const a=o.ang||0,c=Math.cos(a),s=Math.sin(a),hw=o.w/2,hd=o.d/2,z0=(o.z||0)+sl,z1=z0+(o.ht||o.h||600);
    const C=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([u,v])=>[o.x+u*c-v*s,o.y+u*s+v*c]);
    const fs=[];for(let e=0;e<4;e++){const A=C[e],B=C[(e+1)%4],nx=(B[1]-A[1]),ny=-(B[0]-A[0]);
      if(nx*CX+ny*CY<=0)continue;fs.push({pts:[prj(A[0],A[1],z0),prj(B[0],B[1],z0),prj(B[0],B[1],z1),prj(A[0],A[1],z1)],t:Math.abs(nx)>Math.abs(ny)?'obj.a':'obj.b',
        key:(A[0]+B[0])*CX+(A[1]+B[1])*CY});}
    fs.sort((p,q)=>p.key-q.key).forEach(f=>{poly(f.t,f.pts);for(let e=0;e<4;e++)line('edge.obj',f.pts[e],f.pts[(e+1)%4],'obj');});
    const T=C.map(p=>prj(p[0],p[1],z1));poly('obj.top',T);for(let e=0;e<4;e++)line('edge.obj',T[e],T[(e+1)%4],'obj');});}
  // endpoints: on the room-side face of their wall at their real height; ceiling items float with a drop line
  let nDev=0;const roles=new Set(),hwTags=[],devPos=[];
  if(def.devices)for(const d of M.devices){const L=layerById(d.layer||'L0'),role=(L&&L.role)||'construct';
    const hwk=d.type==='board'||d.type==='base'||d.type==='rbx';let px=d.x,py=d.y,nx=0,ny=0,onWall=false;
    const host=d.type==='light'?null:viewHostWall(walls,d);
    if(host){const k=host.t/2+4;if(host.h){py=host.cy+host.n*k;ny=host.n;}else{px=host.cx+host.n*k;nx=host.n;}onWall=true;}
    const dl=liftXY(px+nx*30,py+ny*30),z=(d.h||0)+dl,back=onWall&&(nx*CX+ny*CY)<0;
    later(px+nx*30,py+ny*30,()=>P.push({k:'ep',t:'ep',s:prj(px,py,z),drop:onWall?null:prj(px,py,dl),role,type:d.type,hw:hwk,back,ref:d.ref||''}));
    if(hwk)hwTags.push({s:prj(px,py,z),txt:d.ref||d.type.toUpperCase()});
    devPos.push({d,role,px,py,s:prj(px,py,z),hw:hwk});
    roles.add(role);nDev++;}
  // far → near along both axes
  const I=[...Array(NI).keys()],J=[...Array(NJ).keys()];if(CX<0)I.reverse();if(CY<0)J.reverse();
  for(const i of I)for(const j of J)column(i,j);
  // labels on top, in screen space
  if(def.labels){for(const r of rooms){const c=viewCentroid(r.poly),a=polyArea(r.poly);
      P.push({k:'text',t:'label.room',s:prj(c[0],c[1],liftOf.get(r)||0),txt:(r.name||'').replace('·','/').toUpperCase(),sub:r.num||'',small:a<2.5e6});}
    hwTags.forEach(h=>P.push({k:'text',t:'label.tag',s:h.s,txt:h.txt,leader:true}));
    if(M.entry){const o=M.entry,host=walls.find(r=>viewInBox(o.x,o.y,{x0:r.x0-1,y0:r.y0-1,x1:r.x1+1,y1:r.y1+1}));
      if(host){const h=viewWallHoriz(host),out=(cls.get(host)==='int')?1:(()=>{const mx=(host.x0+host.x1)/2,my=(host.y0+host.y1)/2;
          return roomAt(h?mx:host.x1+60,h?host.y1+60:my)?-1:1;})();
        const ax=h?o.x:o.x+out*1100,ay=h?o.y+out*1100:o.y,bx=h?o.x:o.x+out*250,by=h?o.y+out*250:o.y;
        const el=EX?(liftOf.get(EX[0].room)||0):0;
        P.push({k:'text',t:'label.entry',s:prj(ax,ay,el),to:prj(bx,by,el),txt:'BEJÁRAT'});}}
    viewPlaceLabels(P);}
  // V6: the stack plates above the plain house (after the house labels: the placer only sees the house)
  const PL=def.plates?viewPlates({def,M,prj,CX,CY,H,devPos,P}):null;
  // bounds over the whole block (plinth to wall top) so every view of the level frames the same
  let b={minX:1e9,minY:1e9,maxX:-1e9,maxY:-1e9};
  if(NI&&NJ)for(const x of [X[0],X[NI]])for(const y of [Y[0],Y[NJ]])for(const z of [-def.plinth,H+(EX?EX.length*step:0)].concat(PL?[PL.top].concat(PL.ghosts.map(g=>g.z)):[])){const q=prj(x,y,z);
    b.minX=Math.min(b.minX,q[0]);b.maxX=Math.max(b.maxX,q[0]);b.minY=Math.min(b.minY,q[1]);b.maxY=Math.max(b.maxY,q[1]);}
  // V6: the plate labels hang left of their plates; the frame takes them in (the label box estimate of viewTextBox)
  for(const p of P)if(p.t==='label.plate')b.minX=Math.min(b.minX,p.at[0]-(p.txt||'').length*(7.4*0.62+0.6)-2);
  const far=[],near=[],int=[];walls.forEach(w=>({far,near,int}[cls.get(w)]).push(w.id||''));
  const out={def,prims:P,bounds:b,roles:[...roles],stats:{cells:NI*NJ,grid:[NI,NJ],devices:nDev,far,near,int,sprites:sprites.length}};
  if(PL){out.stats.plates=PL.plates;out.stats.leaders=PL.leaders;out.stats.ghosts=PL.ghosts;out.stats.step=PL.step;}
  if(EX){out.stats.lifts={};EX.forEach(e=>{out.stats.lifts[viewRoomKey(e.room)]=liftOf.get(e.room);});out.stats.order=EX.map(e=>viewRoomKey(e.room));out.stats.step=step;}
  out.body=viewBodySvg(P,S);out.svg=viewSvg(out,S);
  return out;}

// ---- V5: the exploded view's room order (D-V5-1: entrance first, then by plan distance) ----
function viewRoomKey(r){return r.num||r.name||'';}
// the rooms on the two long faces of a wall (60 mm probes), 0–2 of them
function viewWallRooms(w,rooms){const h=viewWallHoriz(w),mx=(w.x0+w.x1)/2,my=(w.y0+w.y1)/2,m=60;
  const at=(x,y)=>{for(let k=rooms.length-1;k>=0;k--)if(pointInPoly(x,y,rooms[k].poly))return rooms[k];return null;};
  const a=h?at(mx,w.y0-m):at(w.x0-m,my),b=h?at(mx,w.y1+m):at(w.x1+m,my);
  return [a,b].filter((r,i,arr)=>r&&arr.indexOf(r)===i);}
// [{room, rank}]: rank 0 = the room beside the entrance (the bejarat-tagged opening), else the largest
function viewExplodeOrder(M){const rooms=M.rooms;if(!rooms.length)return [];
  let first=null;
  if(M.entry){const o=M.entry,host=M.walls.find(r=>viewInBox(o.x,o.y,{x0:r.x0-1,y0:r.y0-1,x1:r.x1+1,y1:r.y1+1}));
    if(host){const h=viewWallHoriz(host),q=(h?[[o.x,host.y0-60],[o.x,host.y1+60]]:[[host.x0-60,o.y],[host.x1+60,o.y]]);
      for(const [x,y] of q){const r=rooms.slice().reverse().find(rm=>pointInPoly(x,y,rm.poly));if(r){first=r;break;}}}}
  if(!first)first=rooms.reduce((a,b)=>polyArea(b.poly)>polyArea(a.poly)?b:a);
  const c0=viewCentroid(first.poly),d=r=>{const c=viewCentroid(r.poly);return Math.hypot(c[0]-c0[0],c[1]-c0[1]);};
  const rest=rooms.filter(r=>r!==first).map((r,k)=>({r,k,d:d(r)})).sort((a,b)=>a.d-b.d||a.k-b.k).map(e=>e.r);
  return [first].concat(rest).map((room,rank)=>({room,rank}));}
// the step options of the menu (D-V5-1: selectable, 900 default)
const VIEW_EXPLODE_STEPS=[{k:'900',n:'900 mm'},{k:'600',n:'600 mm'},{k:'wall',n:'falmagasság'}];
function viewExplodeStep(level,k){return k==='wall'?wallH(level):k==='600'?600:900;}

// ---- V6: the stack plates (WORKPLAN WP V6, DECISIONS D-V6) ----
// [{role, name, n, items}] in STK_ROLES order: roles with content on the level, minus construct (the house) and arm
// (routing junctions). An item: {kind, x, y, at (its screen point in the house), key (leader by default), …}.
function viewPlateRoles(M,devPos){const by=new Map(),cnt=new Map(),roleOf=x=>{const L=layerById(x.layer||'L0');return (L&&L.role)||'construct';};
  const add=(role,it,count)=>{if(role==='construct'||role==='arm')return;if(!by.has(role)){by.set(role,[]);cnt.set(role,0);}by.get(role).push(it);if(count)cnt.set(role,cnt.get(role)+1);};
  devPos.forEach(q=>add(q.role,{kind:'dev',x:q.px,y:q.py,at:q.s,key:q.role==='hw'||q.role==='base',type:q.d.type,hw:q.hw},true));
  for(const pa of data.paths){const ns=pa.nodes.filter(n=>n.level===M.level);if(ns.length<2||!layerShows(pa,'path'))continue;const r=roleOf(pa);
    add(r,{kind:'path',pts:ns.map(n=>[n.x,n.y])},true);
    for(const n of [ns[0],ns[ns.length-1]])add(r,{kind:'end',x:n.x,y:n.y,h:n.h||0,key:r==='channel'},false);}
  for(const m of (data.marks||[])){if(m.level!==M.level)continue;let pt=null;
    if(m.kind==='opening'){const o=data.openings.find(o=>o.id===m.op);if(o)pt=[o.x,o.y];}
    else{const g=mrkGeom(m);if(g&&g.faces&&g.faces[0]){const f=g.faces[0];pt=mrkFacePt(f.r,f.side,(f.u0+f.u1)/2,f.off||0);}
      else if(g&&g.rect)pt=[(g.rect.x0+g.rect.x1)/2,(g.rect.y0+g.rect.y1)/2];}
    if(pt)add(roleOf(m),{kind:'mark',x:pt[0],y:pt[1],key:false},true);}
  return STK_ROLES.filter(r=>by.has(r.k)).map(r=>({role:r.k,name:r.n,n:cnt.get(r.k),items:by.get(r.k)}));}
// the outline loops of the solid plan (walls ∪ rooms): grid cells, boundary edges with the solid on the left,
// chained, collinear runs merged. [[x,y], …] per loop.
function viewFootprint(walls,rooms){const xs=new Set(),ys=new Set();
  walls.forEach(b=>{xs.add(Math.round(b.x0));xs.add(Math.round(b.x1));ys.add(Math.round(b.y0));ys.add(Math.round(b.y1));});
  rooms.forEach(r=>r.poly.forEach(([x,y])=>{xs.add(Math.round(x));ys.add(Math.round(y));}));
  const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b),NI=X.length-1,NJ=Y.length-1;if(NI<1||NJ<1)return [];
  const sol=[];for(let i=0;i<NI;i++){sol.push([]);for(let j=0;j<NJ;j++){const cx=(X[i]+X[i+1])/2,cy=(Y[j]+Y[j+1])/2;
    sol[i].push(walls.some(r=>viewInBox(cx,cy,r))||rooms.some(r=>pointInPoly(cx,cy,r.poly)));}}
  const S=(i,j)=>i>=0&&j>=0&&i<NI&&j<NJ&&sol[i][j],out=new Map(),E=[];
  const edge=(a,b)=>{const e={a,b,used:false};E.push(e);const k=a.join(',');if(!out.has(k))out.set(k,[]);out.get(k).push(e);};
  for(let i=0;i<NI;i++)for(let j=0;j<NJ;j++){if(!sol[i][j])continue;
    if(!S(i,j-1))edge([i,j],[i+1,j]);if(!S(i+1,j))edge([i+1,j],[i+1,j+1]);if(!S(i,j+1))edge([i+1,j+1],[i,j+1]);if(!S(i-1,j))edge([i,j+1],[i,j]);}
  const loops=[];
  for(const e0 of E){if(e0.used)continue;const L=[];let e=e0;
    while(e&&!e.used){e.used=true;L.push(e.a);const nx=(out.get(e.b.join(','))||[]).filter(q=>!q.used);e=nx[0]||null;}
    const P=L.map(([i,j])=>[X[i],Y[j]]),Q=[];
    for(let k=0;k<P.length;k++){const a=P[(k+P.length-1)%P.length],b=P[k],c=P[(k+1)%P.length];
      if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])!==0)Q.push(b);}
    if(Q.length>2)loops.push(Q);}
  return loops;}
// pushes the ghost outlines and the plates into P (bottom to top); returns {plates, leaders, ghosts, top, step}
function viewPlates(c){const {def,M,prj,CX,CY,H,devPos,P}=c,step=+def.plates.step||900,all=def.plates.leaders==='all',T=60;
  const roles=viewPlateRoles(M,devPos),loops=viewFootprint(M.walls,M.rooms),ghosts=[];
  for(const l of ORD){if(l===M.level||!(WALLS[l]||[]).length)continue;const z=wz(l,0)-wz(M.level,0),G=viewModel(l);   // real heights, not the 3D view's exploded display gap
    const gp=viewFootprint(G.walls,G.rooms).map(lp=>({k:'gline',t:'ghost',p:lp.map(([x,y])=>prj(x,y,z)),grp:'ghost:'+l}));
    if(!gp.length)continue;if(z<0)P.unshift(...gp);else P.push(...gp);ghosts.push({level:l,z});}
  let leaders=0;const plates=[];
  roles.forEach((r,k)=>{const z=H+(k+1)*step,col=STK_COL[r.role]||'#888',g=r.role;
    for(const lp of loops){const n=lp.length;
      for(let e=0;e<n;e++){const A=lp[e],B=lp[(e+1)%n],nx=B[1]-A[1],ny=-(B[0]-A[0]);
        if(nx*CX+ny*CY>0)P.push({k:'poly',t:'plate.side',p:[prj(A[0],A[1],z-T),prj(B[0],B[1],z-T),prj(B[0],B[1],z),prj(A[0],A[1],z)],grp:g});}}
    let lx=null;
    for(const lp of loops){const pts=lp.map(([x,y])=>prj(x,y,z));P.push({k:'poly',t:'plate.top',p:pts,edge:col,grp:g});
      pts.forEach(q=>{if(!lx||q[0]<lx[0])lx=q;});}
    for(const it of r.items){if(it.kind==='path'||!(all||it.key))continue;
      const at=it.kind==='end'?prj(it.x,it.y,it.h):(it.at||prj(it.x,it.y,0));P.push({k:'lead',a:prj(it.x,it.y,z),b:at,c:col,grp:g});leaders++;}
    for(const it of r.items){
      if(it.kind==='path')P.push({k:'pline',p:it.pts.map(([x,y])=>prj(x,y,z)),c:col,grp:g});
      else if(it.kind==='end')P.push({k:'dot',s:prj(it.x,it.y,z),c:col,grp:g});
      else P.push({k:'ep',t:'ep',s:prj(it.x,it.y,z),drop:null,role:r.role,type:it.kind==='mark'?'mark':it.type,hw:!!it.hw,back:false,ref:'',grp:g});}
    if(lx)P.push({k:'text',t:'label.plate',s:lx,at:[lx[0]-8,lx[1]+3],txt:r.name+' · '+r.n,c:col,grp:g});
    plates.push({role:r.role,n:r.n,z});});
  return {plates,leaders,ghosts,top:H+roles.length*step,step};}

// ---- interval helpers ----
function viewMergeIv(list){list.sort((p,q)=>p.a-q.a);const out=[];
  for(const v of list){const L=out[out.length-1];
    if(L&&v.a<=L.b+0.5){if(v.b>=L.b){L.b=v.b;L.top=v.top;if(v.kind!=='plinth')L.kind=v.kind;}}
    else out.push(Object.assign({},v));}
  return out;}
function viewMinus(a,b,list){let segs=[[a,b]];
  for(const v of list){const nx=[];for(const [p,q] of segs){if(v.b<=p||v.a>=q){nx.push([p,q]);continue;}
    if(v.a>p)nx.push([p,v.a]);if(v.b<q)nx.push([v.b,q]);}segs=nx;}
  return segs.filter(([p,q])=>q-p>0.5);}
function viewMinusR(a,b,ranges){return viewMinus(a,b,ranges.map(([p,q])=>({a:p,b:q})));}
function viewCentroid(p){let sx=0,sy=0,a=0;for(let i=0,j=p.length-1;i<p.length;j=i++){const f=p[j][0]*p[i][1]-p[i][0]*p[j][1];a+=f;sx+=(p[j][0]+p[i][0])*f;sy+=(p[j][1]+p[i][1])*f;}
  if(Math.abs(a)<1e-6)return p[0];let c=[sx/(3*a),sy/(3*a)];if(!pointInPoly(c[0],c[1],p))c=[p[0][0]+300,p[0][1]+300];return c;}
// the wall a device is mounted on and the face it looks out of (= deviceHostWall's tie rule, on raw rects)
function viewHostWall(walls,d){let best=null;
  for(const r of walls){const h=viewWallHoriz(r),t=h?r.y1-r.y0:r.x1-r.x0,cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
    const along=h?d.x>=r.x0-5&&d.x<=r.x1+5:d.y>=r.y0-5&&d.y<=r.y1+5,off=h?d.y-cy:d.x-cx;
    if(!along||Math.abs(off)>t/2+40||(best&&Math.abs(off)>=best.dist))continue;
    best={h,t,cx,cy,dist:Math.abs(off),n:Math.abs(off)>1?Math.sign(off):(d.side?1:-1)};}
  return best;}

// ---- labels: nothing on top of anything (the user's rule for every sheet) ----
// Greedy: the entrance first, then hardware tags, then rooms; each tries candidate spots nearest
// first and takes the first that overlaps no marker and no label already placed (else the least
// overlap). A room label pushed off its centre gets a short leader. Boxes are screen units.
function viewTextBox(p,x,y){const len=(p.txt||'').length;
  if(p.t==='label.room'){const fs=p.small?6.8:8.6,w=len*(fs*0.62+1.3),sw=(p.sub||'').length*4.6,W=Math.max(w,sw);
    return [x-W/2-2,y-fs-1,x+W/2+2,y+(p.sub?(p.small?8:10)+2:2)];}
  const w=len*(7.4*0.62+0.6);
  if(p.t==='label.tag')return p.end?[x-w-1,y-8.4,x+1,y+2]:[x-1,y-8.4,x+w+1,y+2];
  return [x-w/2-1,y-8.4,x+w/2+1,y+2];}
function viewOverlap(a,b){const w=Math.min(a[2],b[2])-Math.max(a[0],b[0]),h=Math.min(a[3],b[3])-Math.max(a[1],b[1]);return w>0&&h>0?w*h:0;}
function viewPlaceLabels(P){const obs=[];
  for(const p of P)if(p.k==='ep'){const r=(p.hw?4.2:p.type==='light'?3.2:3.4)+1;obs.push([p.s[0]-r,p.s[1]-r,p.s[0]+r,p.s[1]+r]);}
  const cost=bx=>obs.reduce((k,o)=>k+viewOverlap(bx,o),0);
  const take=(p,cands)=>{let best=null;
    for(const c of cands){const bx=viewTextBox(Object.assign({},p,c),c.x,c.y),k=cost(bx);if(!best||k<best.k)best={c,bx,k};if(k===0)break;}
    Object.assign(p,best.c.extra||{});p.at=[best.c.x,best.c.y];if(best.c.end!=null)p.end=best.c.end;obs.push(best.bx);};
  const texts=P.filter(p=>p.k==='text');
  for(const p of texts.filter(p=>p.t==='label.entry')){const [x,y]=p.s;
    take(p,[[0,12],[0,-5],[-28,4],[28,4],[0,22],[0,-15],[-40,12],[40,12]].map(([dx,dy])=>({x:x+dx,y:y+dy})));}
  for(const p of texts.filter(p=>p.t==='label.tag')){const [x,y]=p.s,c=[];
    for(const k of [1,1.6,2.3])for(const [dx,dy] of [[-22,-26],[22,-26],[-30,-6],[30,-6],[-22,22],[22,22],[0,-36],[0,30]]){
      const qx=x+dx*k,qy=y+dy*k,end=dx<=0;c.push({x:end?qx-2:qx+2,y:qy-3,end,extra:{q:[qx,qy]}});}
    take(p,c);}
  for(const p of texts.filter(p=>p.t==='label.room')){const [x,y]=p.s,c=[];
    for(const dy of [0,-11,11,-22,22,-33,33,-44,44])for(const dx of [0,-28,28,-56,56])c.push({x:x+dx,y:y+dy});
    c.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));take(p,c);
    if(Math.hypot(p.at[0]-x,p.at[1]-y)>14)p.lead=true;}}

// ---- primitives → SVG through a style sheet ----
function viewBodySvg(P,S){const f=v=>v.toFixed(1),pt=q=>f(q[0])+','+f(q[1]);let s='';
  for(const p of P){
    if(p.k==='poly'){const c=p.fill||S.face[p.t]||'#eee';
      if(p.edge)s+=`<polygon points="${p.p.map(pt).join(' ')}" fill="${c}" fill-opacity="${S.plateOp}" stroke="${p.edge}" stroke-width="${S.width.plate}"/>`;
      else s+=`<polygon points="${p.p.map(pt).join(' ')}" fill="${c}" stroke="${c}" stroke-width="0.6"${p.t==='plate.side'?` fill-opacity="${S.plateOp}" stroke-opacity="${S.plateOp}"`:''}/>`;}
    else if(p.k==='gline')s+=`<polygon points="${p.p.map(pt).join(' ')}" fill="none" stroke="${S.inkSoft}" stroke-width="${S.width.ghost}" stroke-dasharray="4 3" opacity="${S.ghostOp}"/>`;
    else if(p.k==='lead')s+=`<line x1="${f(p.a[0])}" y1="${f(p.a[1])}" x2="${f(p.b[0])}" y2="${f(p.b[1])}" stroke="${p.c}" stroke-width="${S.width.drop}" stroke-dasharray="1.5 2.5"/>`;
    else if(p.k==='pline')s+=`<polyline points="${p.p.map(pt).join(' ')}" fill="none" stroke="${p.c}" stroke-width="${S.width.route}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if(p.k==='dot')s+=`<circle cx="${f(p.s[0])}" cy="${f(p.s[1])}" r="1.8" fill="${p.c}"/>`;
    else if(p.k==='line'){const obj=p.t==='edge.obj',room=p.w==='room';
      s+=`<line x1="${f(p.a[0])}" y1="${f(p.a[1])}" x2="${f(p.b[0])}" y2="${f(p.b[1])}" stroke="${room?S.inkSoft:obj?S.objInk:S.ink}" stroke-width="${S.width[p.w]||1}" stroke-linecap="round"/>`;}
    else if(p.k==='ep')s+=viewEpSvg(p,S);
    else if(p.k==='text')s+=viewTextSvg(p,S);}
  return s;}
function viewEpSvg(p,S){const f=v=>v.toFixed(1),c=STK_COL[p.role]||S.inkSoft,[x,y]=p.s,r=p.hw?4.2:2.6;let g='';
  if(p.drop)g+=`<line x1="${f(x)}" y1="${f(y)}" x2="${f(p.drop[0])}" y2="${f(p.drop[1])}" stroke="${c}" stroke-width="${S.width.drop}" stroke-dasharray="1.5 2.5"/><circle cx="${f(p.drop[0])}" cy="${f(p.drop[1])}" r="0.9" fill="${c}"/>`;
  if(p.type==='light')g+=`<circle cx="${f(x)}" cy="${f(y)}" r="${r+0.6}" fill="#fff" stroke="${c}" stroke-width="1.3"/>`;
  else if(p.type==='switch'||p.hw)g+=`<rect x="${f(x-r)}" y="${f(y-r)}" width="${2*r}" height="${2*r}" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
  else if(p.type==='socket')g+=`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
  else{const e=r+0.6;g+=`<path d="M${f(x)} ${f(y-e)}l${e} ${e}l-${e} ${e}l-${e} -${e}z" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;}
  return p.back?`<g opacity="0.55">${g}</g>`:g;}
function viewTextSvg(p,S){const f=v=>v.toFixed(1),[x,y]=p.s,[ax,ay]=p.at||[x,y];
  if(p.t==='label.room')return (p.lead?`<line x1="${f(x)}" y1="${f(y)}" x2="${f(ax)}" y2="${f(ay+2)}" stroke="${S.inkSoft}" stroke-width="0.5"/><circle cx="${f(x)}" cy="${f(y)}" r="1" fill="${S.inkSoft}"/>`:'')
    +`<text x="${f(ax)}" y="${f(ay)}" text-anchor="middle" class="vw-rm${p.small?' sm':''}">${esc(p.txt)}</text>`
    +(p.sub?`<text x="${f(ax)}" y="${f(ay+(p.small?8:10))}" text-anchor="middle" class="vw-rn">${esc(p.sub)}</text>`:'');
  if(p.t==='label.tag'){const q=p.q||[x-22,y-26];return `<line x1="${f(x)}" y1="${f(y)}" x2="${f(q[0])}" y2="${f(q[1])}" stroke="${S.ink}" stroke-width="${S.width.leader}"/>`
    +`<text x="${f(ax)}" y="${f(ay)}" text-anchor="${p.end===false?'start':'end'}" class="vw-tag">${esc(p.txt)}</text>`;}
  if(p.t==='label.plate')return `<text x="${f(ax)}" y="${f(ay)}" text-anchor="end" class="vw-tag" style="fill:${p.c}">${esc(p.txt)}</text>`;
  if(p.t==='label.entry')return `<line x1="${f(x)}" y1="${f(y)}" x2="${f(p.to[0])}" y2="${f(p.to[1])}" stroke="${S.ink}" stroke-width="1.2" marker-end="url(#vw-arr)"/>`
    +`<text x="${f(ax)}" y="${f(ay)}" text-anchor="middle" class="vw-tag">${esc(p.txt)}</text>`;
  return '';}
function viewDefs(S){return `<defs><marker id="vw-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="${S.ink}"/></marker>`
  +`<style>.vw text{font-family:${S.font};fill:${S.ink}}.vw-rm{font-size:8.6px;letter-spacing:1.3px;font-weight:600;stroke:#ffffffcc;stroke-width:2.6px;paint-order:stroke}`
  +`.vw-rm.sm{font-size:6.8px}.vw-rn{font-family:${S.mono};font-size:6.6px;fill:${S.inkSoft};stroke:#ffffffcc;stroke-width:2.2px;paint-order:stroke}`
  +`.vw-tag{font-family:${S.mono};font-size:7.4px;letter-spacing:.6px;stroke:${S.paper};stroke-width:2.4px;paint-order:stroke}</style></defs>`;}
// a standalone SVG: paper, padding, the body. The framed sheet (title + legend) is viewSheetSvg below.
function viewSvg(R,S){const b=R.bounds,pad=R.def.pad,W=Math.ceil(b.maxX-b.minX+2*pad),H=Math.ceil(b.maxY-b.minY+2*pad);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="vw" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${viewDefs(S)}`
    +`<rect width="100%" height="100%" fill="${S.paper}"/><g transform="translate(${(pad-b.minX).toFixed(1)},${(pad-b.minY).toFixed(1)})" stroke-linejoin="round">${R.body}</g></svg>`;}

// ---- the sheet: title, the drawing, the legend (V4; the frame tools/p33-axo.js used to draw) ----
// The legend lists only the roles actually present (R.roles order); the wall rows quote the view's own heights.
const VIEW_ROLE_HU={'sys:MAINS':'Erősáram','sys:DED':'Dedikált körök','sys:SOC':'Dugaljak','sys:LIGHT':'Világítás','sys:LV':'Törpefeszültség (A)','sys:BUSB':'Biztosított 24 V (B)',
  'sys:CONTROL':'Vezérlés','sys:DATA':'Adat / PoE','sys:SENSOR':'Érzékelők','sys:HMI':'Kezelőfelületek',
  'sys:MEDIA':'Média és hang','sys:USB':'USB','sys:SECURITY':'Biztonságtechnika',hw:'Hardver',base:'BASE'};
const VIEW_LEVEL_HU={basement:'PINCE',ground:'FÖLDSZINT',upper:'EMELET'};
const VIEW_SHEET={margin:70,legend:270,top:40,row:17};
// opts.scale draws the body at that factor (the export keeps the on-screen zoom); the frame stays in px.
function viewSheetSvg(R,opts){const o=opts||{},def=R.def,S=VIEW_STYLES[def.style]||VIEW_STYLES.tiszta,k=o.scale||1,b0=R.bounds,
  b={minX:b0.minX*k,minY:b0.minY*k,maxX:b0.maxX*k,maxY:b0.maxY*k};
  const M=VIEW_SHEET.margin,LEG=VIEW_SHEET.legend,top=VIEW_SHEET.top,RW=VIEW_SHEET.row,H=o.H!=null?o.H:wallH(def.level);
  const W=Math.ceil(b.maxX-b.minX+2*M+LEG),HH=Math.ceil(b.maxY-b.minY+2*M+top);
  const roles=R.roles.filter(r=>VIEW_ROLE_HU[r]);
  // no role rows (a plan without stack layers, NV4): no heading either, JELEK moves to the top (D-V4-3)
  let leg=`<g transform="translate(${W-LEG+10},${M+top})">`+(roles.length?`<text class="lh" x="0" y="0">VÉGPONTOK RENDSZERENKÉNT</text>`:'');
  roles.forEach((r,k)=>{const y=20+k*RW;leg+=`<rect x="0" y="${y-7}" width="9" height="9" fill="${STK_COL[r]}"/><text class="lt" x="16" y="${y+1}">${VIEW_ROLE_HU[r]}</text>`;});
  const y2=roles.length?20+roles.length*RW+18:0;leg+=`<text class="lh" x="0" y="${y2}">JELEK</text>`;
  const sym=[['circle','Lámpa (mennyezet, ejtővonallal)'],['dot','Dugalj'],['sq','Kapcsoló / doboz'],['dia','Egyéb végpont'],['fade','Fal túloldalán']];
  sym.forEach(([k,t],n)=>{const y=y2+20+n*RW,cx=4.5,cy=y-3,c='#555';
    leg+=k==='circle'?`<circle cx="${cx}" cy="${cy}" r="3.6" fill="#fff" stroke="${c}" stroke-width="1.3"/>`
      :k==='dot'?`<circle cx="${cx}" cy="${cy}" r="3" fill="${c}"/>`:k==='sq'?`<rect x="${cx-3}" y="${cy-3}" width="6" height="6" fill="${c}"/>`
      :k==='dia'?`<path d="M${cx} ${cy-4}l4 4l-4 4l-4 -4z" fill="${c}"/>`:`<circle cx="${cx}" cy="${cy}" r="3" fill="${c}" opacity="0.45"/>`;
    leg+=`<text class="lt" x="16" y="${y+1}">${t}</text>`;});
  const y3=y2+20+sym.length*RW+14;
  leg+=`<text class="lh" x="0" y="${y3}">FALAK</text>`
    +`<rect x="0" y="${y3+9}" width="9" height="9" fill="#fff" stroke="${S.ink}" stroke-width="0.8"/><text class="lt" x="16" y="${y3+17}">Távoli külső fal — teljes ${H} mm</text>`
    +`<rect x="0" y="${y3+26}" width="9" height="9" fill="${S.face['wall.top.cut']}" stroke="${S.ink}" stroke-width="0.8"/><text class="lt" x="16" y="${y3+34}">Vágott fal — belső ${def.cut} · kamera felőli külső ${def.nearCut} mm</text></g>`;
  const lv=VIEW_LEVEL_HU[def.level]||def.level,t1=esc((o.title?o.title+' · '+lv:lv).toUpperCase());
  const t2=esc(o.sub!=null?o.sub:`Axonometria · nézet ${def.yaw}° / ${def.pitch}° · vágás ${def.cut} / ${def.nearCut} mm · ${R.stats.devices} végpont`);
  const title=`<g transform="translate(${M},${M-18})"><text class="t1" x="0" y="0">${t1}</text><text class="t2" x="0" y="18">${t2}</text></g>`;
  const defs=viewDefs(S).replace('</style>',`.t1{font-family:Marcellus,Georgia,serif;font-size:22px;letter-spacing:3px}.t2{font-size:10.5px;fill:${S.inkSoft};letter-spacing:.4px}`
    +`.lh{font-size:8.4px;letter-spacing:1.6px;font-weight:600}.lt{font-size:8.6px;fill:#3b3a36}</style>`);
  return {W,H:HH,roles,svg:`<svg xmlns="http://www.w3.org/2000/svg" class="vw" width="${W}" height="${HH}" viewBox="0 0 ${W} ${HH}">${defs}`
    +`<rect width="100%" height="100%" fill="${S.paper}"/>${title}`
    +`<g transform="translate(${(M-b.minX).toFixed(1)},${(M+top-b.minY).toFixed(1)})${k!==1?' scale('+(+k.toFixed(4))+')':''}" stroke-linejoin="round">${R.body}</g>${leg}</svg>`};}

window.viewSheetSvg=viewSheetSvg;window.viewPlateRoles=viewPlateRoles;window.viewFootprint=viewFootprint;window.viewExplodeOrder=viewExplodeOrder;window.viewExplodeStep=viewExplodeStep;window.VIEW_EXPLODE_STEPS=VIEW_EXPLODE_STEPS;window.VIEW_ROLE_HU=VIEW_ROLE_HU;window.VIEW_LEVEL_HU=VIEW_LEVEL_HU;
window.viewRender=viewRender;window.viewWallClass=viewWallClass;window.viewWallTops=viewWallTops;window.viewModel=viewModel;
window.viewCamera=viewCamera;window.viewRoomTone=viewRoomTone;window.VIEW_STYLES=VIEW_STYLES;window.VIEW_DEF=VIEW_DEF;
