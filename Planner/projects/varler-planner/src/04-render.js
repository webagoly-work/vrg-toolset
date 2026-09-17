// ==========================================================================
// 03-render.js — the whole draw pipeline: normal, blueprint, whiteout, symbols, ghosts
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// render ////////////////////
function p2b(pts){return pts.map(p=>{const b=planToBase(p[0],p[1],p[2]);return b[0].toFixed(1)+','+b[1].toFixed(1);}).join(' ');}
function roomDims(poly){let xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
  return [Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)];}
function floorLabel(room,level){ // isometric text painted on the floor
  if(!state.showLabels)return '';
  let cx=0,cy=0;room.poly.forEach(p=>{cx+=p[0];cy+=p[1];});cx/=room.poly.length;cy/=room.poly.length;
  const z=dz(level,0),O=planToBase(cx,cy,z);
  const Ex=planToBase(cx+1000,cy,z),Ey=planToBase(cx,cy+1000,z);
  let ax=(Ex[0]-O[0])/1000, ay=(Ex[1]-O[1])/1000, bx=(Ey[0]-O[0])/1000, by=(Ey[1]-O[1])/1000;
  if(ax*by-ay*bx<0){bx=-bx;by=-by;}          // keep glyphs readable (no mirror)
  const th=state.labelRot*Math.PI/180, cs=Math.cos(th), sn=Math.sin(th); // rotate text within the plane
  const rax=ax*cs+bx*sn, ray=ay*cs+by*sn, rbx=-ax*sn+bx*cs, rby=-ay*sn+by*cs;
  const [w,h]=roomDims(room.poly),area=(w*h/1e6).toFixed(area_dec(w*h));
  const col=state.style==='whiteout'?'#000':'#3a352c', sz=520*state.labelSize;
  const m=`matrix(${rax},${ray},${rbx},${rby},${O[0]},${O[1]})`;
  const ttl=(room.num?room.num+'  ':'')+(room.name||'');
  let body=`<tspan x="0" dy="${-0.54*sz}">${esc(ttl)}</tspan>`
   +`<tspan x="0" dy="${1.08*sz}" font-size="${0.73*sz}" font-weight="400">${area} m² · ${w}×${h}</tspan>`;
  if(room.mat)body+=`<tspan x="0" dy="${0.95*sz}" font-size="${0.66*sz}" font-weight="400">${esc(room.mat)}</tspan>`;
  return `<g transform="${m}"><text text-anchor="middle" font-size="${sz}" fill="${col}" font-weight="600" font-family="Segoe UI,Arial">`
   +body+`</text></g>`;}
function area_dec(a){return a<2e6?1:0;}

function drawNormalGeom(){const faces=[];const wm=state.wallMode;const raised=[];
  const op=wm==='solid'?1:wm==='translucent'?0.5:0;
  for(const l of ORD){if(!state.levels[l])continue;const fz=dz(l,0);
    if(SLAB[l])pushFloor(faces,SLAB[l],fz,'#dedcd3','#8f8a80',null,1);
    else (ROOMSB[l]||[]).forEach((rm,i)=>{if(state.soloRoom&&!soloRoomIs({src:'B',i,level:l}))return;pushFloor(faces,rm.poly,fz,rm.fill,'#8f8a80',null,1);});
    data.floors.forEach((fl,i)=>{if(fl.level!==l||!layerShows(fl,'build'))return;if(state.soloRoom&&!soloRoomIs({src:'F',i,level:l}))return;pushFloor(faces,fl.poly,fz+(fl.z||0),fl.fill||'#e2ddd0','#8f8a80',null,1);});
    if(GHOST[l])pushFloor(faces,GHOST[l],fz,'#000000','#8a857b','7 6',0.07);
    // álmennyezet: a translucent plane at its own height, per room where it applies
    if(state.showDropCeil!==false){
      const dl=DROPC[l]||0;
      const dcC=state.dropCol||'#cfd8dc',dcO=(state.dropOp!=null?state.dropOp:50)/100;
      (ROOMSB[l]||[]).forEach((rm,i)=>{const mm=dropCeilMm(l,rm);if(!mm)return;
        if(state.soloRoom&&!soloRoomIs({src:'B',i,level:l}))return;
        pushFloor(faces,rm.poly,fz+mm,dcC,'#8fa0a8','4 3',dcO);});
      data.floors.forEach((fl,i)=>{const mm=dropCeilMm(l,fl);if(!mm)return;
        if(fl.level!==l||!layerShows(fl,'build'))return;
        if(state.soloRoom&&!soloRoomIs({src:'F',i,level:l}))return;
        pushFloor(faces,fl.poly,fz+mm,dcC,'#8fa0a8','4 3',dcO);});}
    if(wm!=='hidden')for(const r of WALLS[l])if(layerShows(r,'wall')&&soloWallOk(r,l))pushBox(faces,r,fz+(r.z0||0),fz+(r.z0||0)+(r.h||wallH(l)),op);
    // from straight above you cannot see height, so mark anything raised off the floor
    if(state.flat||state.pitch>=88){
      for(const r of WALLS[l])if((r.z0||0)>0&&layerShows(r,'wall')&&soloWallOk(r,l))raised.push({r,mm:r.z0,kind:'w',l});
      data.floors.forEach((fl,i)=>{if(fl.level===l&&(fl.z||0)>0&&layerShows(fl,'build'))raised.push({fl,mm:fl.z,kind:'f',l});});}
    for(const rf of (ROOFS[l]||[]))pushRoof(faces,rf,l);}
  if(state.style!=='whiteout')for(const o of data.openings)if(state.levels[o.level]&&layerShows(o,'build')&&soloOk(o.x,o.y,o.level))pushOpening(faces,o);
  for(const rf of (data.roofs||[]))if(state.levels[rf.level]&&layerShows(rf,'build'))
    pushUserRoof(faces,rf,selected&&selected.t==='roofs'&&data.roofs[selected.i]===rf);
  for(const o of data.objects)if(state.levels[o.level]&&layerShows(o,'object')&&soloOk(o.x,o.y,o.level)&&!(isGenObject(o)&&!genObjectsVisible()))
    pushObj(faces,o,selected&&selected.t==='objects'&&data.objects[selected.i]===o);
  pushRefBuildings(faces);
  // Floors are the flat ground plane at z=0 — they never occlude raised solids that rest on them.
  // Painter's algorithm on centroid depth fails when a big floor's centroid is nearer than an object's,
  // so we draw all horizontal ground faces FIRST (as a background), then depth-sort only the raised solids.
  const floorFaces=faces.filter(f=>f.ground),solidFaces=faces.filter(f=>!f.ground);
  solidFaces.sort((a,b)=>a.key-b.key);
  const ordered=floorFaces.concat(solidFaces);
  let s='';for(const f of ordered){if(f.op===0)continue;const fo=f.op<1?` fill-opacity="${f.op}"`:'';
    const d=f.dash?` stroke-dasharray="${f.dash}"`:'';
    s+=`<polygon points="${p2b(f.pts)}" fill="${f.fill}"${fo} stroke="${f.stroke}" stroke-width="${f.sw||1}"${d}/>`;}
  s+=raisedMarks(raised);
  return s+isoGridSvg();}
// 2D badge for anything that starts above the floor (lebegő fal / dobogó) — otherwise invisible from above
function raisedMarks(list){if(!list||!list.length)return '';let s='';
  list.forEach(it=>{const fz=dz(it.l,0);
    if(it.kind==='w'){const r=it.r,foot=[[r.x0,r.y0],[r.x1,r.y0],[r.x1,r.y1],[r.x0,r.y1]];
      s+=`<polygon points="${p2b(foot.map(q=>[q[0],q[1],fz]))}" fill="none" stroke="#c0530f" stroke-width="1.2" stroke-dasharray="7 4"/>`;
      const c=planToBase((r.x0+r.x1)/2,(r.y0+r.y1)/2,fz);
      s+=`<text x="${c[0]}" y="${c[1]+3}" font-size="9.5" text-anchor="middle" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">↑${Math.round(it.mm)}</text>`
        +`<text x="${c[0]}" y="${c[1]+3}" font-size="9.5" text-anchor="middle" fill="#c0530f">↑${Math.round(it.mm)}</text>`;}
    else{const pl=it.fl.poly,b=polyBBox(pl),c=planToBase((b.x0+b.x1)/2,(b.y0+b.y1)/2,fz);
      s+=`<polygon points="${p2b(pl.map(q=>[q[0],q[1],fz]))}" fill="none" stroke="#c0530f" stroke-width="1.2" stroke-dasharray="7 4"/>`
        +`<text x="${c[0]}" y="${c[1]-14}" font-size="9.5" text-anchor="middle" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">↑${Math.round(it.mm)} dobogó</text>`
        +`<text x="${c[0]}" y="${c[1]-14}" font-size="9.5" text-anchor="middle" fill="#c0530f">↑${Math.round(it.mm)} dobogó</text>`;}});
  return s;}
let refB=[];
function pushRefBuildings(faces){refB.forEach(rb=>{if(!rb.visible)return;const o=rb.b,dx=rb.dx||0,dy=rb.dy||0;
  const lh=o.heights||{basement:2500,ground:2700,upper:2700};
  ORD.forEach(l=>{if(!state.levels[l])return;
    let fz=0;for(const k of ORD){if(k===l)break;fz+=(lh[k]||0)+(state.exploded?GAP:0);}
    const shift=p=>[p[0]+dx,p[1]+dy];
    const slab=o.slabs&&o.slabs[l];
    if(slab)pushFloor(faces,slab.map(shift),fz,'#e9e7e0','#b3ada0',null,0.45);
    ((o.rooms&&o.rooms[l])||[]).forEach(rm=>pushFloor(faces,rm.poly.map(shift),fz,'#e9e7e0','#b3ada0',null,0.45));
    ((o.walls&&o.walls[l])||[]).forEach(a=>{const r=wr(a);
      pushBox(faces,{x0:r.x0+dx,y0:r.y0+dy,x1:r.x1+dx,y1:r.y1+dy},fz,fz+(r.h||lh[l]||2700),0.45,true);});});});}
function renderRefList(){const el=$('refList');if(!el)return;
  el.innerHTML=refB.map((rb,i)=>`<div class="lrow"><button data-rv="${i}">${rb.visible?'👁':'🚫'}</button>`
    +`<span style="font-size:11.5px;flex:1">${esc(rb.b.name||('Terv '+(i+1)))}</span>`
    +`<input type="number" data-rx="${i}" value="${rb.dx||0}" title="eltolás X" style="width:56px">`
    +`<input type="number" data-ry="${i}" value="${rb.dy||0}" title="eltolás Y" style="width:56px">`
    +`<button data-rd="${i}">✕</button></div>`).join('');
  el.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>{refB[+b.dataset.rv].visible=!refB[+b.dataset.rv].visible;renderRefList();draw();});
  el.querySelectorAll('[data-rx]').forEach(i=>i.onchange=()=>{refB[+i.dataset.rx].dx=+i.value||0;draw();});
  el.querySelectorAll('[data-ry]').forEach(i=>i.onchange=()=>{refB[+i.dataset.ry].dy=+i.value||0;draw();});
  el.querySelectorAll('[data-rd]').forEach(b=>b.onclick=()=>{refB.splice(+b.dataset.rd,1);renderRefList();draw();});}
function addRefBuilding(o){refB.push({b:o,visible:true,dx:0,dy:0});renderRefList();draw();}
function objCorners(o){const c=Math.cos(o.ang||0),sn=Math.sin(o.ang||0),hw=(o.w||600)/2,hd=(o.d||600)/2;
  const P=(u,v)=>[o.x+c*u-sn*v, o.y+sn*u+c*v];
  const a=P(-hw,-hd),b=P(hw,-hd),cc=P(hw,hd),dd=P(-hw,hd);
  const z0=dz(o.level,o.z||0), z1=z0+(o.ht||600);
  return [[a[0],a[1],z0],[b[0],b[1],z0],[cc[0],cc[1],z0],[dd[0],dd[1],z0],
          [a[0],a[1],z1],[b[0],b[1],z1],[cc[0],cc[1],z1],[dd[0],dd[1],z1]];}
function objFootprint(o){const v=objCorners(o);return [v[0],v[1],v[2],v[3]];}
function pushObj(faces,o,sel){const v=objCorners(o);
  const zbias=18+(o.zord||0)*1000; // per-object draw-order override (above/below coplanar features)
  for(const fi of FACES){const pts=fi.map(i=>v[i]);const n0=newell(pts);if(!faceVisible(n0))continue;
    const n=rotN(n0,state.rot);
    // bias by the object's own centre depth (not each face's) so the whole box sorts as a unit vs the floor → no per-face flicker
    faces.push({pts,fill:shade(hexToRgb(o.color||'#b6a894'),n),stroke:sel?'#e30613':'#6f6455',sw:sel?2:0.9,op:0.96,key:depthOf(o.x,o.y,dz(o.level,(o.z||0)+(o.ht||600)/2))+zbias});}}
// ================= BLUEPRINT (hivatalos alaprajz) RENDER =================
function polyArea(poly){let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=(poly[j][0]*poly[i][1]-poly[i][0]*poly[j][1]);return Math.abs(a/2);}
// Hungarian blueprint door symbols. variant bit1 = hinge at the far jamb, bit0 = which side it opens to.
function bpDoorSymbol(q,W,o,wdt,z,corners){
  const [a,b2,c2,d2]=corners;const kind=doorKind(o);
  let s=`<polyline points="${p2b([[a[0],a[1],z],[d2[0],d2[1],z]])}" fill="none" stroke="#111" stroke-width="1"/>`
       +`<polyline points="${p2b([[b2[0],b2[1],z],[c2[0],c2[1],z]])}" fill="none" stroke="#111" stroke-width="1"/>`;
  const hingeAtStart=!((o.variant||0)&2), side=((o.variant||0)&1)?1:-1;
  const ux=W.horiz?1:0, uy=W.horiz?0:1, px=W.horiz?0:1, py=W.horiz?1:0;
  const cxm=(q.x0+q.x1)/2, cym=(q.y0+q.y1)/2, th=W.horiz?(q.y1-q.y0):(q.x1-q.x0);
  const u0=[W.horiz?q.x0:cxm, W.horiz?cym:q.y0], u1=[W.horiz?q.x1:cxm, W.horiz?cym:q.y1];
  const leafArc=(hinge,dirSign,wid)=>{ // leaf line + quarter-circle swing
    const end=[hinge[0]+px*wid*side, hinge[1]+py*wid*side];
    let t=`<polyline points="${p2b([[hinge[0],hinge[1],z],[end[0],end[1],z]])}" fill="none" stroke="#111" stroke-width="1"/>`;
    const arc=[];for(let i=0;i<=10;i++){const k=i/10*Math.PI/2;
      arc.push([hinge[0]+ux*dirSign*wid*Math.sin(k)+px*wid*side*Math.cos(k),
                hinge[1]+uy*dirSign*wid*Math.sin(k)+py*wid*side*Math.cos(k), z]);}
    return t+`<polyline points="${p2b(arc)}" fill="none" stroke="#111" stroke-width="0.7"/>`;};
  const slab=(off,frac,dash)=>{ // a leaf drawn as a thin slab parallel to the wall
    const t0=off,t1=off+wdt*frac,d=th*0.32;
    const A=[W.horiz?(q.x0+t0):(cxm-d/2+px*0), W.horiz?(cym-d/2):(q.y0+t0)];
    const w0=W.horiz?(t1-t0):d, h0=W.horiz?d:(t1-t0);
    const pts=W.horiz?[[A[0],cym-d/2+side*th*0.9],[A[0]+w0,cym-d/2+side*th*0.9],[A[0]+w0,cym+d/2+side*th*0.9],[A[0],cym+d/2+side*th*0.9]]
                     :[[cxm-d/2+side*th*0.9,q.y0+t0],[cxm+d/2+side*th*0.9,q.y0+t0],[cxm+d/2+side*th*0.9,q.y0+t1],[cxm-d/2+side*th*0.9,q.y0+t1]];
    return `<polygon points="${p2b(pts.map(pp=>[pp[0],pp[1],z]))}" fill="#fff" stroke="#111" stroke-width="0.9"${dash?' stroke-dasharray="5 3"':''}/>`;};
  const arrow=(frac)=>{ // sliding direction arrow along the wall
    const t0=wdt*0.2,t1=wdt*0.8,off=side*th*1.5;
    const A=W.horiz?[q.x0+t0,cym+off]:[cxm+off,q.y0+t0], B=W.horiz?[q.x0+t1,cym+off]:[cxm+off,q.y0+t1];
    const hx=(B[0]-A[0])*0.12,hy=(B[1]-A[1])*0.12,nx=px*wdt*0.05,ny=py*wdt*0.05;
    return `<polyline points="${p2b([[A[0],A[1],z],[B[0],B[1],z]])}" fill="none" stroke="#111" stroke-width="0.7"/>`
      +`<polyline points="${p2b([[B[0]-hx+nx,B[1]-hy+ny,z],[B[0],B[1],z],[B[0]-hx-nx,B[1]-hy-ny,z]])}" fill="none" stroke="#111" stroke-width="0.7"/>`;};
  const label=(txt)=>{const b=planToBase(cxm+px*side*th*2.4,cym+py*side*th*2.4,z);
    return `<text x="${b[0]}" y="${b[1]}" font-size="8" text-anchor="middle" fill="#111">${esc(txt)}</text>`;};
  if(kind==='opening')return s;                                   // bare structural opening: reveals only
  if(kind==='hinged'||kind==='fire'){
    s+=leafArc(hingeAtStart?u0:u1,hingeAtStart?1:-1,wdt);
    if(kind==='fire')s+=label('EI');
    return s;}
  if(kind==='double'){                                            // two leaves, one from each jamb
    s+=leafArc(u0,1,wdt/2)+leafArc(u1,-1,wdt/2);return s;}
  if(kind==='folding'){                                           // concertina: zigzag across the opening
    const n=4,zz=[];for(let i=0;i<=n;i++){const t=i/n*wdt,dpt=(i%2?1:0)*th*0.9*side;
      zz.push([W.horiz?(q.x0+t):(cxm+dpt), W.horiz?(cym+dpt):(q.y0+t), z]);}
    s+=`<polyline points="${p2b(zz)}" fill="none" stroke="#111" stroke-width="1"/>`;return s;}
  if(kind==='sliding'){s+=slab(0,1,false)+arrow();return s;}       // leaf parked in front of the wall
  if(kind==='pocket'){                                             // leaf disappears into the wall: dashed
    s+=slab(0,1,true)+arrow();
    const t0=(hingeAtStart?-wdt:wdt);
    return s;}
  if(kind==='garage'){                                             // sectional door: dashed leaf + travel arrow
    s+=slab(0,1,true)+arrow()+label('GK');return s;}
  if(kind==='rollup'){                                             // roll-up: the drum sits INSIDE the room
    const th2=th*0.55,inSide=side;                                 // shown on the room side of the wall
    const c0=[W.horiz?q.x0:(cxm+inSide*th2),W.horiz?(cym+inSide*th2):q.y0];
    const c1=[W.horiz?q.x1:(cxm+inSide*th2),W.horiz?(cym+inSide*th2):q.y1];
    s+=`<polyline points="${p2b([[c0[0],c0[1],z],[c1[0],c1[1],z]])}" fill="none" stroke="#111" stroke-width="1.2"/>`;
    // the coiled drum, drawn as two arcs at the opening's ends
    [[c0,1],[c1,-1]].forEach(pair=>{const P=pair[0],dir=pair[1],rr=th*0.42,arc=[];
      for(let i=0;i<=12;i++){const k=i/12*Math.PI*1.6;
        arc.push([P[0]+ux*dir*rr*Math.sin(k)*0.5+px*inSide*rr*(1-Math.cos(k))*0.5,
                  P[1]+uy*dir*rr*Math.sin(k)*0.5+py*inSide*rr*(1-Math.cos(k))*0.5,z]);}
      s+=`<polyline points="${p2b(arc)}" fill="none" stroke="#111" stroke-width="0.8"/>`;});
    // the slat pack, hatched, partially projecting into the room
    const n2=6,zz=[];for(let i=0;i<=n2;i++){const t=i/n2;
      const A=[c0[0]+(c1[0]-c0[0])*t,c0[1]+(c1[1]-c0[1])*t];
      zz.push(`<line x1="${planToBase(A[0],A[1],z)[0]}" y1="${planToBase(A[0],A[1],z)[1]}" x2="${planToBase(A[0]+px*inSide*th*0.3,A[1]+py*inSide*th*0.3,z)[0]}" y2="${planToBase(A[0]+px*inSide*th*0.3,A[1]+py*inSide*th*0.3,z)[1]}" stroke="#111" stroke-width="0.5"/>`);}
    s+=zz.join('')+label('RK ↑');return s;}
  return s;}
function bpWallSpans(r,level){const horiz=(r.x1-r.x0)>=(r.y1-r.y0);
  const len=horiz?(r.x1-r.x0):(r.y1-r.y0),thick=horiz?(r.y1-r.y0):(r.x1-r.x0);
  const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,spans=[];
  data.openings.forEach(o=>{if(o.level!==level||o.type==='stairs'||!layerShows(o,'build'))return;
    const u=horiz?(o.x-r.x0):(o.y-r.y0), off=horiz?Math.abs(o.y-cy):Math.abs(o.x-cx);
    if(off>thick/2+220)return;const w=o.w||(o.type==='window'?WIN_W:DOOR_W);
    const u0=u-w/2,u1=u+w/2;if(u1<40||u0>len-40)return;
    spans.push({u0:Math.max(0,u0),u1:Math.min(len,u1),o});});
  spans.sort((a,b)=>a.u0-b.u0);return {horiz,len,thick,spans};}
function bpSeg(r,horiz,u0,u1){return horiz?{x0:r.x0+u0,y0:r.y0,x1:r.x0+u1,y1:r.y1}:{x0:r.x0,y0:r.y0+u0,x1:r.x1,y1:r.y0+u1};}
function bpRect(q,z){return p2b([[q.x0,q.y0,z],[q.x1,q.y0,z],[q.x1,q.y1,z],[q.x0,q.y1,z]]);}
function bpTick(x,y,z,ang){const L=95;const a=[x-Math.cos(ang)*L,y-Math.sin(ang)*L,z],b=[x+Math.cos(ang)*L,y+Math.sin(ang)*L,z];
  return `<polyline points="${p2b([a,b])}" fill="none" stroke="#111" stroke-width="0.9"/>`;}
function bpTxt(x,y,z,txt,size,weight,anchor,dy){const b=planToBase(x,y,z);
  return `<text x="${b[0].toFixed(1)}" y="${(b[1]+(dy||0)).toFixed(1)}" font-size="${size}" font-weight="${weight||400}" text-anchor="${anchor||'middle'}" fill="#111" font-family="Arial,Segoe UI">${esc(txt)}</text>`;}
function bpDimChain(vals,fixed,axis,z,flip){ // axis 'x': stations along x at y=fixed
  if(vals.length<2)return '';let s='';const a=axis==='x'?[vals[0],fixed]:[fixed,vals[0]],b=axis==='x'?[vals[vals.length-1],fixed]:[fixed,vals[vals.length-1]];
  s+=`<polyline points="${p2b([[a[0],a[1],z],[b[0],b[1],z]])}" fill="none" stroke="#111" stroke-width="0.8"/>`;
  const tickAng=axis==='x'?Math.PI/4:-Math.PI/4;
  vals.forEach(v=>{const px=axis==='x'?v:fixed,py=axis==='x'?fixed:v;s+=bpTick(px,py,z,tickAng);});
  for(let i=1;i<vals.length;i++){const d=Math.round(vals[i]-vals[i-1]);if(d<60)continue;
    const m=(vals[i]+vals[i-1])/2,px=axis==='x'?m:fixed,py=axis==='x'?fixed:m;
    s+=bpTxt(px,py,z,(d/1000).toFixed(2).replace('.',','),9.5,400,'middle',flip?11:-5);}
  return s;}
function bpBBox(level){let b={x0:1e9,y0:1e9,x1:-1e9,y1:-1e9},any=false;
  const add=p=>{b.x0=Math.min(b.x0,p[0]);b.x1=Math.max(b.x1,p[0]);b.y0=Math.min(b.y0,p[1]);b.y1=Math.max(b.y1,p[1]);any=true;};
  (WALLS[level]||[]).forEach(r=>{add([r.x0,r.y0]);add([r.x1,r.y1]);});
  (ROOMSB[level]||[]).forEach(rm=>rm.poly.forEach(add));
  data.floors.forEach(fl=>{if(fl.level===level)fl.poly.forEach(add);});
  return any?b:null;}
function drawBlueprintGeom(){return state.pitch>=88?drawBlueprintPlan():drawBlueprintIso();}
function drawBlueprintPlan(){const level=state.active;const z=dz(level,0);
  let s=`<defs><pattern id="bph" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    +`<rect width="7" height="7" fill="#fff"/><line x1="0" y1="0" x2="0" y2="7" stroke="#111" stroke-width="1.5"/></pattern></defs>`;
  // ---- floors (white) ----
  const rooms=[];
  (ROOMSB[level]||[]).forEach((rm,i)=>{if(state.soloRoom&&!soloRoomIs({src:'B',i,level}))return;rooms.push(rm);});
  data.floors.forEach((fl,i)=>{if(fl.level!==level)return;if(state.soloRoom&&!soloRoomIs({src:'F',i,level}))return;rooms.push(fl);});
  rooms.forEach(rm=>{s+=`<polygon points="${p2b(rm.poly.map(p=>[p[0],p[1],z]))}" fill="#fff" stroke="#111" stroke-width="0.5"/>`;});
  // ---- objects as thin plan outlines ----
  data.objects.forEach(o=>{if(o.level!==level||!layerShows(o,'object'))return;if(isGenObject(o)&&!genObjectsVisible())return;
    s+=`<polygon points="${p2b(objFootprint(o))}" fill="#fff" stroke="#111" stroke-width="0.9"/>`;});
  // ---- walls: hatched, openings cut out ----
  (WALLS[level]||[]).forEach(r=>{if(!layerShows(r,'wall')||!soloWallOk(r,level))return;
    const W=bpWallSpans(r,level);let u=0;
    W.spans.forEach(sp=>{if(sp.u0-u>1)s+=`<polygon points="${bpRect(bpSeg(r,W.horiz,u,sp.u0),z)}" fill="url(#bph)" stroke="#111" stroke-width="1.2"/>`;u=Math.max(u,sp.u1);});
    if(W.len-u>1)s+=`<polygon points="${bpRect(bpSeg(r,W.horiz,u,W.len),z)}" fill="url(#bph)" stroke="#111" stroke-width="1.2"/>`;
    // opening symbols in the gaps
    W.spans.forEach(sp=>{const q=bpSeg(r,W.horiz,sp.u0,sp.u1),o=sp.o,wdt=sp.u1-sp.u0;
      s+=`<polygon points="${bpRect(q,z)}" fill="#fff" stroke="none"/>`;
      const a=W.horiz?[q.x0,q.y0]:[q.x0,q.y0],b2=W.horiz?[q.x1,q.y0]:[q.x0,q.y1],
            c2=W.horiz?[q.x1,q.y1]:[q.x1,q.y1],d2=W.horiz?[q.x0,q.y1]:[q.x1,q.y0];
      if(o.type==='window'){const m0=W.horiz?[q.x0,(q.y0+q.y1)/2]:[(q.x0+q.x1)/2,q.y0],m1=W.horiz?[q.x1,(q.y0+q.y1)/2]:[(q.x0+q.x1)/2,q.y1];
        s+=`<polyline points="${p2b([[a[0],a[1],z],[b2[0],b2[1],z]])}" fill="none" stroke="#111" stroke-width="0.9"/>`
          +`<polyline points="${p2b([[d2[0],d2[1],z],[c2[0],c2[1],z]])}" fill="none" stroke="#111" stroke-width="0.9"/>`
          +`<polyline points="${p2b([[m0[0],m0[1],z],[m1[0],m1[1],z]])}" fill="none" stroke="#111" stroke-width="0.7"/>`;}
      else s+=bpDoorSymbol(q,W,o,wdt,z,[a,b2,c2,d2]);});});
  // ---- stairs in plan: treads + direction arrow ----
  data.openings.forEach(o=>{if(o.level!==level||o.type!=='stairs'||!layerShows(o,'build'))return;
    const Wd=o.w||STAIR_W,going=o.going||GOING,n=Math.max(3,Math.round((o.h||wallH(level))/(o.riser||RISER)));
    const d=[Math.cos(o.ang),Math.sin(o.ang)],p=[-Math.sin(o.ang),Math.cos(o.ang)],rev=(o.variant&1)?-1:1;
    const P=(u,v)=>[o.x+d[0]*u*rev+p[0]*v, o.y+d[1]*u*rev+p[1]*v, z];
    s+=`<polygon points="${p2b([P(0,0),P(n*going,0),P(n*going,Wd),P(0,Wd)])}" fill="#fff" stroke="#111" stroke-width="1"/>`;
    for(let i=1;i<n;i++)s+=`<polyline points="${p2b([P(i*going,0),P(i*going,Wd)])}" fill="none" stroke="#111" stroke-width="0.6"/>`;
    s+=`<polyline points="${p2b([P(going*0.6,Wd/2),P(n*going-going*0.6,Wd/2)])}" fill="none" stroke="#111" stroke-width="0.8"/>`;});
  // ---- room labels: NAME / burkolat / area ----
  if(state.showRoomText)rooms.forEach(rm=>{if(rm.noText)return;
    let cx=0,cy=0;rm.poly.forEach(p=>{cx+=p[0];cy+=p[1];});cx/=rm.poly.length;cy/=rm.poly.length;
    const ar=(polyArea(rm.poly)/1e6).toFixed(2).replace('.',',');
    s+=bpTxt(cx,cy,z,(rm.name||'HELYISÉG').toUpperCase(),11.5,700,'middle',-6);
    if(rm.mat!==undefined?rm.mat:true)s+=bpTxt(cx,cy,z,rm.mat||'hidegburkolat',9.5,400,'middle',5);
    s+=bpTxt(cx,cy,z,ar+' m²',9.5,400,'middle',16);});
  // ---- dimension chains ----
  const bb=bpBBox(level);
  if(bb&&state.bp.dims){const xs=new Set(),ys=new Set();
    (WALLS[level]||[]).forEach(r=>{xs.add(Math.round(r.x0));xs.add(Math.round(r.x1));ys.add(Math.round(r.y0));ys.add(Math.round(r.y1));});
    data.openings.forEach(o=>{if(o.level!==level||o.type==='stairs')return;const w=o.w||DOOR_W;
      if(Math.abs(o.ang)<0.1||Math.abs(Math.abs(o.ang)-Math.PI)<0.1){xs.add(Math.round(o.x-w/2));xs.add(Math.round(o.x+w/2));}
      else{ys.add(Math.round(o.y-w/2));ys.add(Math.round(o.y+w/2));}});
    const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b);
    s+=bpDimChain(X,bb.y0-900,'x',z,false);
    s+=bpDimChain([bb.x0,bb.x1],bb.y0-1900,'x',z,false);
    s+=bpDimChain(Y,bb.x0-900,'y',z,false);
    s+=bpDimChain([bb.y0,bb.y1],bb.x0-1900,'y',z,false);}
  // ---- north arrow ----
  if(bb){const nx=bb.x1+2200,ny=bb.y0+300;
    s+=`<polyline points="${p2b([[nx,ny+900,z],[nx,ny-900,z]])}" fill="none" stroke="#111" stroke-width="1"/>`
      +`<polygon points="${p2b([[nx,ny-1150,z],[nx-260,ny-500,z],[nx+260,ny-500,z]])}" fill="#111"/>`
      +bpTxt(nx,ny-1500,z,'É',13,700,'middle',0);}
  // ---- title block ----
  if(bb&&state.bp.title){const tx=bb.x0,ty=bb.y0-3400;
    const L=[[state.bp.proj||(B&&B.name)||'LAKÓÉPÜLET',13,700],
             ['Földszinti alaprajz — '+level,11,400],
             [state.bp.addr||'',10.5,400],[state.bp.by||'Varler Group',10.5,400]];
    let dy=0;L.forEach(l=>{if(!l[0])return;s+=bpTxt(tx,ty,z,l[0],l[1],l[2],'start',dy);dy+=l[1]+5;});}
  return s;}
const BPDEFS=`<defs><pattern id="bph" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fff"/><line x1="0" y1="0" x2="0" y2="7" stroke="#111" stroke-width="1.5"/></pattern></defs>`;
function pushBpBox(faces,r,z0,z1,hatchTop){const v=boxCorners(r,z0,z1);
  FACES.forEach((fi,idx)=>{const pts=fi.map(i=>v[i]);if(!faceVisible(newell(pts)))return;
    let cx=0,cy=0,cz=0;pts.forEach(p=>{cx+=p[0];cy+=p[1];cz+=p[2];});cx/=4;cy/=4;cz/=4;
    faces.push({pts,fill:(idx===0&&hatchTop)?'url(#bph)':'#fff',op:1,stroke:'#111',sw:idx===0?1.2:0.9,key:depthOf(cx,cy,cz)});});}
function bpFloorLabel(rm,level){let cx=0,cy=0;rm.poly.forEach(p=>{cx+=p[0];cy+=p[1];});cx/=rm.poly.length;cy/=rm.poly.length;
  const z=dz(level,0),O=planToBase(cx,cy,z),Ex=planToBase(cx+1000,cy,z),Ey=planToBase(cx,cy+1000,z);
  let ax=(Ex[0]-O[0])/1000,ay=(Ex[1]-O[1])/1000,bx=(Ey[0]-O[0])/1000,by=(Ey[1]-O[1])/1000;
  if(ax*by-ay*bx<0){bx=-bx;by=-by;}
  const th=state.labelRot*Math.PI/180,cs=Math.cos(th),sn=Math.sin(th);
  const rax=ax*cs+bx*sn,ray=ay*cs+by*sn,rbx=-ax*sn+bx*cs,rby=-ay*sn+by*cs;
  const sz=430*state.labelSize,ar=(polyArea(rm.poly)/1e6).toFixed(2).replace('.',',');
  return `<g transform="matrix(${rax},${ray},${rbx},${rby},${O[0]},${O[1]})"><text text-anchor="middle" fill="#111" font-family="Arial,Segoe UI">`
   +`<tspan x="0" dy="${-0.5*sz}" font-size="${sz}" font-weight="700">${esc(((rm.num?rm.num+'  ':'')+(rm.name||'HELYISÉG')).toUpperCase())}</tspan>`
   +`<tspan x="0" dy="${1.05*sz}" font-size="${0.78*sz}">${esc(rm.mat||'hidegburkolat')}</tspan>`
   +`<tspan x="0" dy="${0.95*sz}" font-size="${0.78*sz}">${ar} m²</tspan></text></g>`;}
function drawBlueprintIso(){const faces=[];let s=BPDEFS;
  for(const l of ORD){if(!state.levels[l])continue;const fz=dz(l,0),H=wallH(l);
    if(SLAB[l])pushFloor(faces,SLAB[l],fz,'#fff','#111',null,1);
    (ROOMSB[l]||[]).forEach((rm,i)=>{if(state.soloRoom&&!soloRoomIs({src:'B',i,level:l}))return;pushFloor(faces,rm.poly,fz,'#fff','#111',null,1);});
    data.floors.forEach((fl,i)=>{if(fl.level!==l)return;if(state.soloRoom&&!soloRoomIs({src:'F',i,level:l}))return;pushFloor(faces,fl.poly,fz+(fl.z||0),'#fff','#111',null,1);});
    // walls split by openings -> real 3D voids
    (WALLS[l]||[]).forEach(r=>{if(!layerShows(r,'wall')||!soloWallOk(r,l))return;
      const wh=r.h||H,wz=fz+(r.z0||0),W=bpWallSpans(r,l);let u=0;
      W.spans.forEach(sp=>{if(sp.u0-u>1)pushBpBox(faces,bpSeg(r,W.horiz,u,sp.u0),wz,wz+wh,true);
        const o=sp.o;
        if(o.type==='window'){const sill=o.sill!=null?o.sill:WIN_SILL,hh=o.h||WIN_H;
          const q=bpSeg(r,W.horiz,sp.u0,sp.u1);
          if(sill>20)pushBpBox(faces,q,wz,wz+sill,false);
          if(wz+sill+hh<wz+wh-20)pushBpBox(faces,q,wz+sill+hh,wz+wh,true);}
        else{const dh=o.h||DOOR_H;const q=bpSeg(r,W.horiz,sp.u0,sp.u1);
          if(wz+dh<wz+wh-20)pushBpBox(faces,q,wz+dh,wz+wh,true);}
        u=Math.max(u,sp.u1);});
      if(W.len-u>1)pushBpBox(faces,bpSeg(r,W.horiz,u,W.len),wz,wz+wh,true);});
    data.objects.forEach(o=>{if(o.level!==l||!layerShows(o,'object'))return;if(isGenObject(o)&&!genObjectsVisible())return;
      const v=objCorners(o);FACES.forEach(fi=>{const pts=fi.map(i=>v[i]);if(!faceVisible(newell(pts)))return;
        let cx=0,cy=0,cz=0;pts.forEach(p=>{cx+=p[0];cy+=p[1];cz+=p[2];});cx/=4;cy/=4;cz/=4;
        faces.push({pts,fill:'#fff',op:1,stroke:'#111',sw:0.8,key:depthOf(cx,cy,cz)+18});});});
    (data.roofs||[]).forEach(rf=>{if(rf.level!==l)return;roofFaceList(rf).forEach(fc=>{
      if(!faceVisible(newell(fc)))return;let cx=0,cy=0,cz=0;fc.forEach(p=>{cx+=p[0];cy+=p[1];cz+=p[2];});cx/=fc.length;cy/=fc.length;cz/=fc.length;
      faces.push({pts:fc,fill:'#fff',op:1,stroke:'#111',sw:1,key:depthOf(cx,cy,cz)+30});});});
    (ROOFS[l]||[]).forEach(rf=>{const base=floorDispZ(l);const pts=rf.p.map(q=>[q[0],q[1],base+q[2]]);
      let cx=0,cy=0,cz=0;pts.forEach(p=>{cx+=p[0];cy+=p[1];cz+=p[2];});cx/=pts.length;cy/=pts.length;cz/=pts.length;
      faces.push({pts,fill:'#fff',op:1,stroke:'#111',sw:1,key:depthOf(cx,cy,cz)+30});});}
  faces.sort((a,b)=>a.key-b.key);
  faces.forEach(f=>{s+=`<polygon points="${p2b(f.pts)}" fill="${f.fill}" stroke="${f.stroke}" stroke-width="${f.sw||1}"/>`;});
  // labels on the floor plane
  if(state.showRoomText)for(const l of ORD){if(!state.levels[l])continue;
    (ROOMSB[l]||[]).forEach((rm,i)=>{if(rm.noText||(state.soloRoom&&!soloRoomIs({src:'B',i,level:l})))return;s+=bpFloorLabel(rm,l);});
    data.floors.forEach((fl,i)=>{if(fl.level!==l||!fl.name||fl.noText)return;if(state.soloRoom&&!soloRoomIs({src:'F',i,level:l}))return;s+=bpFloorLabel(fl,l);});}
  // dimension chains lie in the plan (p2b) so they follow the camera
  const level=state.active,z=dz(level,0),bb=bpBBox(level);
  if(bb&&state.bp.dims){const xs=new Set(),ys=new Set();
    (WALLS[level]||[]).forEach(r=>{xs.add(Math.round(r.x0));xs.add(Math.round(r.x1));ys.add(Math.round(r.y0));ys.add(Math.round(r.y1));});
    const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b);
    s+=bpDimChain(X,bb.y0-900,'x',z,false)+bpDimChain([bb.x0,bb.x1],bb.y0-1900,'x',z,false)
      +bpDimChain(Y,bb.x0-900,'y',z,false)+bpDimChain([bb.y0,bb.y1],bb.x0-1900,'y',z,false);}
  if(bb){const nx=bb.x1+2200,ny=bb.y0+300;
    s+=`<polyline points="${p2b([[nx,ny+900,z],[nx,ny-900,z]])}" fill="none" stroke="#111" stroke-width="1"/>`
      +`<polygon points="${p2b([[nx,ny-1150,z],[nx-260,ny-500,z],[nx+260,ny-500,z]])}" fill="#111"/>`+bpTxt(nx,ny-1500,z,'É',13,700,'middle',0);}
  if(bb&&state.bp.title){const tx=bb.x0,ty=bb.y0-3400;
    const L=[[state.bp.proj||(B&&B.name)||'LAKÓÉPÜLET',13,700],['Alaprajz — '+level,11,400],[state.bp.addr||'',10.5,400],[state.bp.by||'Varler Group',10.5,400]];
    let dy=0;L.forEach(l=>{if(!l[0])return;s+=bpTxt(tx,ty,z,l[0],l[1],l[2],'start',dy);dy+=l[1]+5;});}
  return s;}
const ROOFTYPES={flat:'Lapostető',mono:'Félnyeregtető',gable:'Nyeregtető',hip:'Kontytető'};
function roofFaceList(rf){const base=dz(rf.level,0),ov=rf.ovh||0;
  let X0=rf.x0-ov,X1=rf.x1+ov,Y0=rf.y0-ov,Y1=rf.y1+ov;
  const E=base+(rf.eave||2700),R=base+(rf.ridge||4200),sw=(rf.ang||0)===90;
  const P=(x,y,z)=>sw?[ (X0+X1)/2+(y-(Y0+Y1)/2), (Y0+Y1)/2+(x-(X0+X1)/2), z ]:[x,y,z];
  const ym=(Y0+Y1)/2, d=Math.min((Y1-Y0)/2,(X1-X0)/2);
  if(rf.type==='flat')return [[P(X0,Y0,E),P(X1,Y0,E),P(X1,Y1,E),P(X0,Y1,E)]];
  if(rf.type==='mono')return [[P(X0,Y0,R),P(X1,Y0,R),P(X1,Y1,E),P(X0,Y1,E)]];
  if(rf.type==='gable')return [
    [P(X0,Y0,E),P(X1,Y0,E),P(X1,ym,R),P(X0,ym,R)],
    [P(X0,Y1,E),P(X1,Y1,E),P(X1,ym,R),P(X0,ym,R)]];
  return [ // hip
    [P(X0,Y0,E),P(X1,Y0,E),P(X1-d,ym,R),P(X0+d,ym,R)],
    [P(X0,Y1,E),P(X1,Y1,E),P(X1-d,ym,R),P(X0+d,ym,R)],
    [P(X0,Y0,E),P(X0,Y1,E),P(X0+d,ym,R)],
    [P(X1,Y0,E),P(X1,Y1,E),P(X1-d,ym,R)]];}
function pushUserRoof(faces,rf,sel){roofFaceList(rf).forEach(fc=>{
  let n=rotN(newell(fc),state.rot);if(n[2]<0)n=n.map(k=>-k);
  let cx=0,cy=0,cz=0;fc.forEach(p=>{cx+=p[0];cy+=p[1];cz+=p[2];});cx/=fc.length;cy/=fc.length;cz/=fc.length;
  faces.push({pts:fc,fill:shade(hexToRgb(rf.color||'#9a6b52'),n),op:0.95,stroke:sel?'#e30613':'#5d4235',sw:sel?2:1,key:depthOf(cx,cy,cz)+30});});}
function addRoof(a,b){const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
  if(x1-x0<300||y1-y0<300)return;
  const lv=state.active,H=wallH(lv);
  roofDlg('Tető',{type:state.roofType||'gable',eave:H,ridge:H+1500,ovh:400,ang:0},v=>{pushUndo();
    data.roofs.push({level:lv,x0,y0,x1,y1,type:v.type,eave:v.eave,ridge:v.ridge,ovh:v.ovh,ang:v.ang,layer:curLayer()});draw();});}
function roofDlg(title,cur,ok){openModal(title,
   `<div class="mrow">Típus <select id="rfT" style="width:170px">`+Object.keys(ROOFTYPES).map(k=>`<option value="${k}" ${k===cur.type?'selected':''}>${ROOFTYPES[k]}</option>`).join('')+`</select></div>`
  +`<div class="mrow">Eresz magasság <input id="rfE" type="number" value="${cur.eave}" style="width:85px"> mm</div>`
  +`<div class="mrow">Gerinc magasság <input id="rfR" type="number" value="${cur.ridge}" style="width:85px"> mm</div>`
  +`<div class="mrow">Ereszkinyúlás <input id="rfO" type="number" value="${cur.ovh}" style="width:85px"> mm</div>`
  +`<div class="mrow">Gerinc iránya <select id="rfA"><option value="0" ${cur.ang==0?'selected':''}>X mentén</option><option value="90" ${cur.ang==90?'selected':''}>Y mentén</option></select></div>`,
  ()=>{state.roofType=$('rfT').value;ok({type:$('rfT').value,eave:+$('rfE').value||2700,ridge:+$('rfR').value||4200,ovh:+$('rfO').value||0,ang:+$('rfA').value||0});});}
function isoGridSvg(){if(!state.isoGrid||!state.levels.ground)return '';
  const gs=Math.max(100,state.gridSize),z=dz('ground',0);
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  const scan=poly=>poly.forEach(p=>{minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);miny=Math.min(miny,p[1]);maxy=Math.max(maxy,p[1]);});
  if(SLAB.ground)scan(SLAB.ground);(ROOMSB.ground||[]).forEach(r=>scan(r.poly));data.floors.forEach(f=>{if(f.level==='ground')scan(f.poly);});
  if(minx>maxx)return '';let s='';
  for(let x=Math.ceil(minx/gs)*gs;x<=maxx;x+=gs){const a=planToBase(x,miny,z),b=planToBase(x,maxy,z);
    s+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#9aa0a6" stroke-width="0.5" opacity="0.6"/>`;}
  for(let y=Math.ceil(miny/gs)*gs;y<=maxy;y+=gs){const a=planToBase(minx,y,z),b=planToBase(maxx,y,z);
    s+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#9aa0a6" stroke-width="0.5" opacity="0.6"/>`;}
  return s;}
function pushFloor(faces,poly,z,fill,stroke,dash,op){let cx=0,cy=0;poly.forEach(p=>{cx+=p[0];cy+=p[1];});
  cx/=poly.length;cy/=poly.length;
  faces.push({pts:poly.map(p=>[p[0],p[1],z]),fill,stroke,dash,op,key:depthOf(cx,cy,z)-1,ground:true});}
function pushBox(faces,r,z0,z1,op,ghost){const v=boxCorners(r,z0,z1);
  for(const f of FACES){const pts=f.map(i=>v[i]);const n0=newell(pts);if(!faceVisible(n0))continue;
    const n=rotN(n0,state.rot);const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,cz=(z0+z1)/2;
    faces.push({pts,fill:shade(ghost?[198,195,188]:[150,146,136],n),stroke:ghost?'#a49e93':'#514c43',op:ghost?Math.min(op,0.45):op,dash:null,key:depthOf(cx,cy,cz)});}}
function hexToRgb(h){h=(h||'#8a8f96').replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function pushRoof(faces,rf,l){const base=floorDispZ(l);const pts=rf.p.map(q=>[q[0],q[1],base+q[2]]);
  let n=rotN(newell(pts),state.rot);if(n[2]<0)n=n.map(k=>-k);
  let cx=0,cy=0,cz=0;pts.forEach(p=>{cx+=p[0];cy+=p[1];cz+=p[2];});cx/=pts.length;cy/=pts.length;cz/=pts.length;
  faces.push({pts,fill:shade(hexToRgb(rf.fill),n),stroke:'#5b5f63',op:1,dash:null,key:depthOf(cx,cy,cz)});}

function drawWhiteout(){ // edge-only sketch, black 100/80, hidden dashed, minimal ink
  const solid=new Set(),all=new Map();
  function edgeKey(a,b){const A=a.map(v=>Math.round(v)).join(','),B=b.map(v=>Math.round(v)).join(',');return A<B?A+'|'+B:B+'|'+A;}
  function addBox(r,z0,z1){const v=boxCorners(r,z0,z1);const ctr=[(r.x0+r.x1)/2,(r.y0+r.y1)/2,(z0+z1)/2];
    for(const f of FACES){const pts=f.map(i=>v[i]);let n=newell(pts);
      const fc=[0,0,0];pts.forEach(p=>{fc[0]+=p[0];fc[1]+=p[1];fc[2]+=p[2];});fc.forEach((_,i)=>fc[i]/=4);
      if((fc[0]-ctr[0])*n[0]+(fc[1]-ctr[1])*n[1]+(fc[2]-ctr[2])*n[2]<0)n=n.map(k=>-k);
      const vis=faceVisible(n);
      for(let i=0;i<4;i++){const a=pts[i],b=pts[(i+1)%4],k=edgeKey(a,b);
        if(!all.has(k))all.set(k,{a,b,horiz:Math.abs(a[2]-b[2])<1});if(vis)solid.add(k);}}}
  for(const l of ORD){if(!state.levels[l])continue;const fz=dz(l,0);for(const r of WALLS[l])if(layerShows(r,'wall')&&soloWallOk(r,l))addBox(r,fz+(r.z0||0),fz+(r.z0||0)+(r.h||wallH(l)));}
  let s='';
  // floor + roof outlines (layout-driven)
  for(const l of ORD){if(!state.levels[l])continue;const fz=dz(l,0);
    if(SLAB[l])s+=`<polygon points="${p2b(SLAB[l].map(p=>[p[0],p[1],fz]))}" fill="none" stroke="#000" stroke-width="1.1"/>`;
    for(const rm of (ROOMSB[l]||[]))s+=`<polygon points="${p2b(rm.poly.map(p=>[p[0],p[1],fz]))}" fill="none" stroke="#000" stroke-opacity="0.8" stroke-width="0.7"/>`;
    if(GHOST[l])s+=`<polygon points="${p2b(GHOST[l].map(p=>[p[0],p[1],fz]))}" fill="none" stroke="#000" stroke-opacity="0.8" stroke-width="0.7" stroke-dasharray="6 5"/>`;
    for(const rf of (ROOFS[l]||[])){const base=floorDispZ(l);
      s+=`<polygon points="${p2b(rf.p.map(q=>[q[0],q[1],base+q[2]]))}" fill="none" stroke="#000" stroke-width="1"/>`;}}
  // wall edges
  for(const [k,e] of all){const isSolid=solid.has(k);const pts=p2b([e.a,e.b]);
    if(isSolid){const o=e.horiz?1:0.8,wd=e.horiz?1.1:0.85;
      s+=`<polyline points="${pts}" fill="none" stroke="#000" stroke-opacity="${o}" stroke-width="${wd}"/>`;}
    else{const o=0.8,dsh=e.horiz?'4 3':'3 3';
      s+=`<polyline points="${pts}" fill="none" stroke="#000" stroke-opacity="${o}" stroke-width="0.6" stroke-dasharray="${dsh}"/>`;}}
  return s;}

function drawGuides(){let s='';const line=state.style==='whiteout';
  for(const l of ORD){if(!state.levels[l])continue;
    const on=GUIDES.filter(gd=>guideOn[gd.k]).map(gd=>({mm:resolveMm(gd,l),c:gd.c}))
      .concat(customG.map(mm=>({mm,c:'#555'})));
    for(const gd of on){for(const seg of SNAP[l]){
      const A=[seg[0][0],seg[0][1],dz(l,gd.mm)],B=[seg[1][0],seg[1][1],dz(l,gd.mm)];
      const col=line?'#000':gd.c,op=line?0.8:0.6,dsh=line?'2 4':'';
      s+=`<line x1="${planToBase(A[0],A[1],A[2])[0].toFixed(1)}" y1="${planToBase(A[0],A[1],A[2])[1].toFixed(1)}" x2="${planToBase(B[0],B[1],B[2])[0].toFixed(1)}" y2="${planToBase(B[0],B[1],B[2])[1].toFixed(1)}" stroke="${col}" stroke-opacity="${op}" stroke-width="0.7" stroke-dasharray="${dsh}"/>`;}}}
  return s;}

function devSym(d){const b=planToBase(d.x,d.y,dz(d.level,d.h||0)),x=b[0],y=b[1];
  const k=state.devScale||0.72;               // global device symbol scale (smaller = less crowded)
  // are we seeing this device from behind, through the wall? (computed in draw() via depth comparison)
  const back=(d.faceBack===true);
  const col=back?'#9299a0':'#222',fillA=back?0.55:1;
  const dash=back?'stroke-dasharray="2.5 2"':'';
  const R=v=>+(v*k).toFixed(2);let sym='';
  const wrap=inner=>`<g opacity="${fillA}">${inner}</g>`;
  if(d.type==='socket')sym=`<circle cx="${x}" cy="${y}" r="${R(6.5)}" fill="#fff" stroke="${col}" stroke-width="${R(1.5)}" ${dash}/><line x1="${x-R(3)}" y1="${y}" x2="${x+R(3)}" y2="${y}" stroke="${col}" stroke-width="${R(1.5)}"/>`;
  else if(d.type==='switch')sym=`<rect x="${x-R(6)}" y="${y-R(6)}" width="${R(12)}" height="${R(12)}" rx="${R(2)}" fill="#fff" stroke="${col}" stroke-width="${R(1.5)}" ${dash}/><line x1="${x-R(2)}" y1="${y+R(3)}" x2="${x+R(3)}" y2="${y-R(3)}" stroke="${col}" stroke-width="${R(1.5)}"/>`;
  else if(d.type==='light')sym=`<circle cx="${x}" cy="${y}" r="${R(6.5)}" fill="#fff8dc" stroke="${col}" stroke-width="${R(1.5)}" ${dash}/><line x1="${x-R(4.5)}" y1="${y-R(4.5)}" x2="${x+R(4.5)}" y2="${y+R(4.5)}" stroke="${col}"/><line x1="${x+R(4.5)}" y1="${y-R(4.5)}" x2="${x-R(4.5)}" y2="${y+R(4.5)}" stroke="${col}"/>`;
  else if(d.type==='board')sym=`<rect x="${x-R(8)}" y="${y-R(8)}" width="${R(16)}" height="${R(16)}" rx="${R(2)}" fill="#ffe9b0" stroke="${col}" stroke-width="${R(1.7)}"/><text x="${x}" y="${y+R(4)}" font-size="${R(10)}" text-anchor="middle" font-weight="700">T</text>`;
  else if(d.type==='box')sym=`<circle cx="${x}" cy="${y}" r="${R(6)}" fill="${d.lv?'#e6f2ff':'#fff'}" stroke="${col}" stroke-width="${R(1.4)}" stroke-dasharray="${R(2.4)} ${R(1.8)}"/><circle cx="${x}" cy="${y}" r="${R(1.6)}" fill="${col}"/>`;
  else sym=`<rect x="${x-R(5.5)}" y="${y-R(5.5)}" width="${R(11)}" height="${R(11)}" fill="#fff" stroke="${col}" stroke-width="${R(1.5)}" ${dash}/><circle cx="${x}" cy="${y}" r="${R(2)}" fill="${col}"/>`;
  sym=wrap(sym);
  if(d.kind||d.lv){const code=(d.kind&&DEVKIND[d.kind]?DEVKIND[d.kind].s:'LV');
    sym+=`<text x="${x}" y="${y+R(15)}" font-size="${R(8)}" text-anchor="middle" fill="#5a5348" paint-order="stroke" stroke="#fff" stroke-width="2.4" opacity="${fillA}">${esc(code)}</text>`;}
  if(state.showRefs&&d.ref)sym+=`<text x="${x+R(9)}" y="${y-R(8)}" font-size="${R(9.5)}" fill="#0a2b6b" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="2.6" opacity="${fillA}">${esc(d.ref)}</text>`;
  return sym;}

const DOOR_W=900,DOOR_H=2100,WIN_W=1200,WIN_H=1500,WIN_SILL=900;
// ---- door kinds, drawn to Hungarian blueprint convention in the 2D plan ----
const DOORTYPE={
  hinged:  {n:'Nyíló ajtó (egyszárnyú)', w:900,  h:2100},
  double:  {n:'Kétszárnyú nyíló ajtó',   w:1400, h:2100},
  sliding: {n:'Tolóajtó (fal előtt)',    w:900,  h:2100},
  pocket:  {n:'Falba futó tolóajtó',     w:900,  h:2100},
  folding: {n:'Harmonikaajtó',           w:800,  h:2100},
  garage:  {n:'Garázskapu (szekcionált)',w:2500, h:2200},
  rollup:  {n:'Garázskapu (felhúzható redőny)',w:2500, h:2200},
  fire:    {n:'Tűzgátló ajtó (EI)',      w:1000, h:2100},
  opening: {n:'Falnyílás (tok nélkül)',  w:1000, h:2100}};
function doorKind(o){return (o&&o.dtype&&DOORTYPE[o.dtype])?o.dtype:'hinged';}
function doorName(o){return DOORTYPE[doorKind(o)].n;}
const STAIR_W=1000,RISER=180,GOING=250,STAIR_TH=300;
function bgCol(){return state.style==='whiteout'?'#ffffff':'#fbfaf7';}
function openingSym(o){
  if(o.type==='stairs')return stairsSym(o);
  const d=[Math.cos(o.ang),Math.sin(o.ang)],win=o.type==='window';
  const ww=o.w||(win?WIN_W:DOOR_W),wh=o.h||(win?WIN_H:DOOR_H),sill=(o.sill!=null?o.sill:(win?WIN_SILL:0)),hw=ww/2;
  const z0=dz(o.level,sill),z1=dz(o.level,sill+wh);
  const P=(u,zz)=>[o.x+d[0]*u,o.y+d[1]*u,zz];
  const q=[P(-hw,z0),P(hw,z0),P(hw,z1),P(-hw,z1)];
  let s=`<polygon points="${q.map(c=>bx(c)+','+by(c)).join(' ')}" fill="${bgCol()}" fill-opacity="0.95" stroke="#3a3a3a" stroke-width="1.6" stroke-linejoin="round"/>`;
  if(win){const s0=dz(o.level,sill),sa=P(-hw,s0),sb=P(hw,s0),m0=P(0,z0),m1=P(0,z1);
    s+=`<line x1="${bx(sa)}" y1="${by(sa)}" x2="${bx(sb)}" y2="${by(sb)}" stroke="#2f6fb0" stroke-width="1.4"/>`;
    s+=`<line x1="${bx(m0)}" y1="${by(m0)}" x2="${bx(m1)}" y2="${by(m1)}" stroke="#2f6fb0" stroke-width="1"/>`;}
  else{const th=P(-hw,dz(o.level,0)),th2=P(hw,dz(o.level,0));
    s+=`<line x1="${bx(th)}" y1="${by(th)}" x2="${bx(th2)}" y2="${by(th2)}" stroke="#3a3a3a" stroke-width="1"/>`;}
  return s;}
function stairsFaceList(o){const L=o.level,base=dz(L,0),Hlev=wallH(L);
  const d=[Math.cos(o.ang),Math.sin(o.ang)],p=[-Math.sin(o.ang),Math.cos(o.ang)],rev=(o.variant&1)?-1:1;
  const Wd=o.w||STAIR_W,riser=o.riser||RISER,going=o.going||GOING,th=o.th||STAIR_TH;
  const n=Math.max(3,Math.round(Hlev/riser)),run=n*going;
  const Pt=(u,v,z)=>[o.x+d[0]*u*rev+p[0]*v, o.y+d[1]*u*rev+p[1]*v, base+z];
  const prof=[[0,0]];for(let i=0;i<n;i++){prof.push([i*going,(i+1)*riser]);prof.push([(i+1)*going,(i+1)*riser]);}
  prof.push([run,n*riser-th]);
  const fl=[];
  function face(pt3,fill){let cx=0,cy=0,cz=0;pt3.forEach(q=>{cx+=q[0];cy+=q[1];cz+=q[2];});cx/=pt3.length;cy/=pt3.length;cz/=pt3.length;
    let nn=rotN(newell(pt3),state.rot);if(nn[2]<0&&pt3.length>4)nn=nn.map(k=>-k);
    fl.push({pts:pt3,fill:shade(hexToRgb(fill),nn),key:depthOf(cx,cy,cz)});}
  face(prof.map(q=>Pt(q[0],0,q[1])),'#9aa0a6');
  face(prof.map(q=>Pt(q[0],Wd,q[1])),'#9aa0a6');
  for(let i=0;i<n;i++){const z=(i+1)*riser,u0=i*going,u1=(i+1)*going;
    face([Pt(u0,0,z),Pt(u1,0,z),Pt(u1,Wd,z),Pt(u0,Wd,z)],'#c8ccd0');
    face([Pt(u0,0,z-riser),Pt(u0,0,z),Pt(u0,Wd,z),Pt(u0,Wd,z-riser)],'#aeb3b8');}
  face([Pt(0,0,0),Pt(run,0,n*riser-th),Pt(run,Wd,n*riser-th),Pt(0,Wd,0)],'#7f8489');
  const up=ORD[ORD.indexOf(L)+1];let hole=null;
  if(up&&state.levels[up]){const uz=dz(up,0);hole=[Pt(0,0,0),Pt(run,0,0),Pt(run,Wd,0),Pt(0,Wd,0)].map(q=>[q[0],q[1],uz]);}
  return {faces:fl,hole};}
function stairsSym(o){const {faces,hole}=stairsFaceList(o);faces.sort((a,b)=>a.key-b.key);
  let s=faces.map(f=>`<polygon points="${p2b(f.pts)}" fill="${f.fill}" fill-opacity="0.92" stroke="#5b5f63" stroke-width="0.8"/>`).join('');
  if(hole)s+=`<polygon points="${p2b(hole)}" fill="${bgCol()}" stroke="#5b5f63" stroke-width="0.9" stroke-dasharray="5 4"/>`;
  return s;}
function pushOpening(faces,o){
  if(o.type==='stairs'){const {faces:sf,hole}=stairsFaceList(o);
    sf.forEach(f=>faces.push({pts:f.pts,fill:f.fill,op:0.92,stroke:'#5b5f63',sw:0.8,key:f.key}));
    if(hole){let cx=0,cy=0,cz=0;hole.forEach(q=>{cx+=q[0];cy+=q[1];cz+=q[2];});cx/=4;cy/=4;cz/=4;
      faces.push({pts:hole,fill:bgCol(),op:1,stroke:'#5b5f63',sw:0.9,dash:'5 4',key:depthOf(cx,cy,cz)});}return;}
  const d=[Math.cos(o.ang),Math.sin(o.ang)],win=o.type==='window';
  const ww=o.w||(win?WIN_W:DOOR_W),wh=o.h||(win?WIN_H:DOOR_H),sill=(o.sill!=null?o.sill:(win?WIN_SILL:0)),hw=ww/2;
  const z0=dz(o.level,sill),z1=dz(o.level,sill+wh);
  const q=[[o.x-d[0]*hw,o.y-d[1]*hw,z0],[o.x+d[0]*hw,o.y+d[1]*hw,z0],[o.x+d[0]*hw,o.y+d[1]*hw,z1],[o.x-d[0]*hw,o.y-d[1]*hw,z1]];
  let cx=0,cy=0,cz=0;q.forEach(pp=>{cx+=pp[0];cy+=pp[1];cz+=pp[2];});cx/=4;cy/=4;cz/=4;
  faces.push({pts:q,fill:bgCol(),op:0.96,stroke:'#3a3a3a',sw:1.6,key:depthOf(cx,cy,cz)+40});}
function stairsSym_OLD(o){const L=o.level,base=dz(L,0),Hlev=wallH(L);
  const d=[Math.cos(o.ang),Math.sin(o.ang)],p=[-Math.sin(o.ang),Math.cos(o.ang)],rev=(o.variant&1)?-1:1;
  const Wd=o.w||STAIR_W,riser=o.riser||RISER,going=o.going||GOING,th=o.th||STAIR_TH;
  const n=Math.max(3,Math.round(Hlev/riser)),run=n*going;
  const Pt=(u,v,z)=>[o.x+d[0]*u*rev+p[0]*v, o.y+d[1]*u*rev+p[1]*v, base+z];
  const prof=[[0,0]];for(let i=0;i<n;i++){prof.push([i*going,(i+1)*riser]);prof.push([(i+1)*going,(i+1)*riser]);}
  prof.push([run,n*riser-th]);
  const faces=[];
  function face(pt3,fill){let cx=0,cy=0,cz=0;pt3.forEach(q=>{cx+=q[0];cy+=q[1];cz+=q[2];});cx/=pt3.length;cy/=pt3.length;cz/=pt3.length;
    let nn=rotN(newell(pt3),state.rot);if(nn[2]<0&&pt3.length>4)nn=nn.map(k=>-k);const [rx,ry]=rot(cx,cy,state.rot);
    faces.push({pts:pt3,fill:shade(hexToRgb(fill),nn),key:rx+ry+cz});}
  face(prof.map(q=>Pt(q[0],0,q[1])),'#9aa0a6');
  face(prof.map(q=>Pt(q[0],Wd,q[1])),'#9aa0a6');
  for(let i=0;i<n;i++){const z=(i+1)*riser,u0=i*going,u1=(i+1)*going;
    face([Pt(u0,0,z),Pt(u1,0,z),Pt(u1,Wd,z),Pt(u0,Wd,z)],'#c8ccd0');
    face([Pt(u0,0,z-riser),Pt(u0,0,z),Pt(u0,Wd,z),Pt(u0,Wd,z-riser)],'#aeb3b8');}
  face([Pt(0,0,0),Pt(run,0,n*riser-th),Pt(run,Wd,n*riser-th),Pt(0,Wd,0)],'#7f8489');
  faces.sort((a,b)=>a.key-b.key);
  let s='';for(const f of faces)s+=`<polygon points="${p2b(f.pts)}" fill="${f.fill}" fill-opacity="0.92" stroke="#5b5f63" stroke-width="0.8"/>`;
  const up=ORD[ORD.indexOf(L)+1];
  if(up&&state.levels[up]){const uz=dz(up,0);
    const hole=[Pt(0,0,0),Pt(run,0,0),Pt(run,Wd,0),Pt(0,Wd,0)].map(q=>[q[0],q[1],uz]);
    s+=`<polygon points="${p2b(hole)}" fill="${bgCol()}" stroke="#5b5f63" stroke-width="0.9" stroke-dasharray="5 4"/>`;}
  return s;}
function bx(P){return planToBase(P[0],P[1],P[2])[0].toFixed(1);}
function by(P){return planToBase(P[0],P[1],P[2])[1].toFixed(1);}

function cableLen(cb){let L=0;for(let i=1;i<cb.nodes.length;i++){const a=cb.nodes[i-1],b=cb.nodes[i];
  L+=Math.hypot(b.x-a.x,b.y-a.y)+Math.abs(wz(b.level,b.h)-wz(a.level,a.h));}return L/1000;}

// ---------------------------------------------------------------------------
// RENDER SCHEDULING
// The scene is written into two layers. Assigning innerHTML makes the browser
// parse the SVG, and that parse — not building the string — is what costs time
// (measured: ~107 ms of a 117 ms frame at 120 devices). So each layer is only
// re-assigned when its string actually changed, and transient chrome lives in
// its own layer that can be swapped without touching the drawing.
let _lyScene=null,_lyOverlay=null,_lastScene=null,_lastOverlay=null,_paints=0,_skips=0;
function paintLayers(scene,overlay){
  if(!_lyScene||_lyScene.parentNode!==vp){
    vp.innerHTML='<g id="lyScene"></g><g id="lyOverlay"></g>';
    _lyScene=vp.firstChild;_lyOverlay=vp.lastChild;_lastScene=_lastOverlay=null;}
  const cs=(scene!==_lastScene),co=(overlay!==_lastOverlay);
  if(cs){_lyScene.innerHTML=scene;_lastScene=scene;_paints++;}else _skips++;
  if(co){_lyOverlay.innerHTML=overlay;_lastOverlay=overlay;_paints++;}else _skips++;
  return {scene:cs,overlay:co};}
function paintStats(){return {paints:_paints,skips:_skips};}
function invalidateLayers(){_lastScene=_lastOverlay=null;}   // force a repaint (theme/DOM changes)
// rAF-coalesced draw for high-frequency callers (pointermove). draw() itself stays
// synchronous so the other 200-odd call sites — and the tests — behave as before.
let _drawPending=false;
function drawSoon(){if(_drawPending)return;_drawPending=true;
  const run=()=>{_drawPending=false;draw();};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else run();}
function draw(){
  let s = bgSvg() + (state.style==='whiteout'?drawWhiteout():state.style==='blueprint'?drawBlueprintGeom():drawNormalGeom());
  s+=drawGuides();
  // hovered / locked wall highlight
  if(state.hoverR){const r=state.hoverR,l=state.hoverL,fz=dz(l,0);
    const foot=[[r.x0,r.y0],[r.x1,r.y0],[r.x1,r.y1],[r.x0,r.y1]];
    s+=`<polygon points="${p2b(foot.map(p=>[p[0],p[1],fz]))}" fill="#ffcf3d" fill-opacity="0.20" stroke="#e0a200" stroke-width="1.4"/>`;
    if(state.mode==='cable'){const wi=wallInfo(r),off=(state.side?1:-1)*wi.thick/2;
      const fa=[wi.seg[0][0]+wi.perp[0]*off,wi.seg[0][1]+wi.perp[1]*off,fz],fb=[wi.seg[1][0]+wi.perp[0]*off,wi.seg[1][1]+wi.perp[1]*off,fz];
      s+=`<polyline points="${p2b([fa,fb])}" fill="none" stroke="#e30613" stroke-width="3.2" stroke-linecap="round"/>`;}}
  // wall-draw rubber band
  if(state.mode==='wall'&&wallStart&&cursor){const fz=dz(state.active,0);
    const a=planToBase(wallStart[0],wallStart[1],fz),b=planToBase(cursor.x,cursor.y,fz);
    const len=Math.hypot(cursor.x-wallStart[0],cursor.y-wallStart[1]);
    s+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2c2c2c" stroke-width="3" stroke-dasharray="7 4"/>`
      +`<circle cx="${a[0]}" cy="${a[1]}" r="4" fill="#fff" stroke="#2c2c2c" stroke-width="2"/>`
      +`<circle cx="${b[0]}" cy="${b[1]}" r="4" fill="#e8641c" stroke="#fff" stroke-width="1.5"/>`
      +`<text x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2-6}" font-size="11" text-anchor="middle" fill="#2c2c2c" paint-order="stroke" stroke="#fff" stroke-width="3">${(len/1000).toFixed(2)} m</text>`;}
  // also show a marker where the FIRST click will land (before wallStart is set) when hovering in wall mode
  if(state.mode==='wall'&&!wallStart&&cursor&&!state.wallErase){const fz=dz(state.active,0),c=planToBase(cursor.x,cursor.y,fz);
    s+=`<circle cx="${c[0]}" cy="${c[1]}" r="4" fill="#fff" stroke="#e8641c" stroke-width="2"/>`;}
  if(state.mode==='object'&&objGhost&&objPick&&!objPick.custom){
    const gang=(objGhost.gang!=null?objGhost.gang:0)+(state.objAng||0);
    const g={level:objGhost.level,x:objGhost.x,y:objGhost.y,z:objGhost.z||0,w:objPick.w,d:objPick.d,ht:objPick.h,ang:gang};
    const v=objCorners(g);const gf=[];
    FACES.forEach(fi=>{const pts=fi.map(i=>v[i]);if(!faceVisible(newell(pts)))return;
      let cx=0,cy=0,cz=0;pts.forEach(pp=>{cx+=pp[0];cy+=pp[1];cz+=pp[2];});cx/=4;cy/=4;cz/=4;gf.push({pts,key:depthOf(cx,cy,cz)});});
    gf.sort((a,b)=>a.key-b.key);
    const gc=objGhost.wall?'#3fae55':'#2f6fb0';
    gf.forEach(fc=>{s+=`<polygon points="${p2b(fc.pts)}" fill="${gc}" fill-opacity="0.18" stroke="${gc}" stroke-width="1.2" stroke-dasharray="5 3"/>`;});
    const b=planToBase(objGhost.x,objGhost.y,dz(objGhost.level,(objGhost.z||0)+(objPick.h||0)));
    s+=`<text x="${b[0]}" y="${b[1]-6}" font-size="10" text-anchor="middle" fill="#2f6fb0" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="2.6">${esc(objPick.n)}${objGhost.wall?' · '+((objGhost.z||0)/1000).toFixed(2)+' m (fal)':''}</text>`;}
  // ghost of whatever Space would drop right now (path/cable drawing)
  if((state.mode==='path'||state.mode==='cable')&&cursor&&state.showPlaceGhost!==false){
    const it=placeItem(),probe=Object.assign({level:cursor.level,x:cursor.x,y:cursor.y,h:cursor.h||0},
      (it.id==='kdx'?{type:'junction',jbShape:'rect',jbSize:(state.lastJb||120)}:(it.id==='board'?{type:'board'}:it.mk()||{type:'box'})));
    const gb=planToBase(cursor.x,cursor.y,dz(cursor.level,cursor.h||0));
    s+=`<g opacity="0.45">${devSym(Object.assign({},probe,{ref:''}))}</g>`
      +`<text x="${gb[0]}" y="${gb[1]-16}" font-size="9.5" text-anchor="middle" fill="#2f6fb0" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="2.6">␣ ${esc(it.n)}</text>`;}
  // ghost of the build piece under the cursor (same idea as the object ghost)
  if(state.mode==='build'&&buildGhost){
    const g=Object.assign({},buildGhost);
    s+=`<g opacity="0.42">${openingSym(g)}</g>`;
    const gb=planToBase(g.x,g.y,dz(g.level,0));
    s+=`<text x="${gb[0]}" y="${gb[1]-10}" font-size="9.5" text-anchor="middle" fill="#3fae55" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="2.6">${esc(BUILDNAME[g.type]||g.type)}</text>`;}
  if(state.mode==='roof'&&roofStart&&cursor){const fz=dz(state.active,0),x0=Math.min(roofStart[0],cursor.x),x1=Math.max(roofStart[0],cursor.x),y0=Math.min(roofStart[1],cursor.y),y1=Math.max(roofStart[1],cursor.y);
    s+=`<polygon points="${p2b([[x0,y0,fz],[x1,y0,fz],[x1,y1,fz],[x0,y1,fz]])}" fill="#9a6b52" fill-opacity="0.25" stroke="#5d4235" stroke-width="1.5" stroke-dasharray="6 4"/>`;}
  // floor-draw rubber band
  if(state.mode==='floor'&&floorStart&&cursor){const fz=dz(state.active,0),x0=Math.min(floorStart[0],cursor.x),x1=Math.max(floorStart[0],cursor.x),y0=Math.min(floorStart[1],cursor.y),y1=Math.max(floorStart[1],cursor.y);
    s+=`<polygon points="${p2b([[x0,y0,fz],[x1,y0,fz],[x1,y1,fz],[x0,y1,fz]])}" fill="#e2ddd0" fill-opacity="0.4" stroke="#2c2c2c" stroke-width="1.5" stroke-dasharray="6 4"/>`;
    const W_=(x1-x0),D_=(y1-y0);
    const midT=planToBase((x0+x1)/2,y0,fz),midR=planToBase(x1,(y0+y1)/2,fz),ctr=planToBase((x0+x1)/2,(y0+y1)/2,fz);
    s+=`<text x="${midT[0]}" y="${midT[1]-6}" font-size="11" text-anchor="middle" fill="#2c2c2c" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="3">${(W_/1000).toFixed(2)} m</text>`
      +`<text x="${midR[0]+8}" y="${midR[1]}" font-size="11" fill="#2c2c2c" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="3">${(D_/1000).toFixed(2)} m</text>`
      +`<text x="${ctr[0]}" y="${ctr[1]}" font-size="10.5" text-anchor="middle" fill="#555" paint-order="stroke" stroke="#fff" stroke-width="3">${((W_*D_)/1e6).toFixed(2)} m²</text>`;
    $('hud').textContent=`padló: ${(W_/1000).toFixed(2)} × ${(D_/1000).toFixed(2)} m = ${((W_*D_)/1e6).toFixed(2)} m²`;}
  // floor labels (isometric, painted)
  if(state.style!=='blueprint')for(const l of ORD){if(!state.levels[l])continue;
    (ROOMSB[l]||[]).forEach((rm,i)=>{if(rm.noText||(state.soloRoom&&!soloRoomIs({src:'B',i,level:l})))return;s+=floorLabel(rm,l);});
    data.floors.forEach((fl,i)=>{if(fl.level!==l||!fl.name||fl.noText)return;if(state.soloRoom&&!soloRoomIs({src:'F',i,level:l}))return;s+=floorLabel(fl,l);});}
  // openings
  if(state.style==='whiteout')for(const o of data.openings){if(state.levels[o.level]&&layerShows(o,'build')&&soloOk(o.x,o.y,o.level))s+=openingSym(o);}
  // paths (primary conduits) — layered under cables
  for(const pa of data.paths){if(!layerShows(pa,'path'))continue;if(pa.nodes.filter(n=>state.levels[n.level]).length<2)continue;const lane=pa.lane||0;
    for(let i=1;i<pa.nodes.length;i++){const a=pa.nodes[i-1],b=pa.nodes[i];
      if(!state.levels[a.level]||!state.levels[b.level])continue;
      const sec=(pa.sections&&pa.sections[i-1])||{build:'sull_gege'};
      const dx=b.x-a.x,dy=b.y-a.y,ln=Math.hypot(dx,dy)||1,px=-dy/ln*lane*PATHW,py=dx/ln*lane*PATHW;
      const A=[a.x+px,a.y+py,dz(a.level,a.h)],B=[b.x+px,b.y+py,dz(b.level,b.h)];
      const surf=buildSurface(sec.build),col=(pa.color||state.pathColor||(surf?'#c0761d':'#6f757d')),dash=surf?'':'7 4',
        wdt=(sec.build.indexOf('szeles')>=0?4.0:2.4)*(state.pathScale||1);
      s+=`<polyline points="${p2b([A,B])}" fill="none" stroke="${col}" stroke-width="${wdt}" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>`;
      const carried=(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]);
      if(carried.length){const c0=sec.circuit||carried[0];const passing=c0.passing;
        const ckey=circuitKey(c0);
        if(state.circHidden&&state.circHidden[ckey]){/* hidden circuit — skip overlay */}
        else{
        const dim=(state.circHi&&state.circHi!==ckey);
        // circuit colour runs continuously along the whole path (straight AND diagonal) for consistent colour codes
        const ccol=circuitColor(c0);
        const op=dim?0.18:(passing?0.5:0.95);
        s+=`<polyline points="${p2b([A,B])}" fill="none" stroke="${ccol}" stroke-width="${state.circHi===ckey?3:2}" opacity="${op}" ${passing?'stroke-dasharray="2 4"':''}/>`;
        const mb=planToBase((A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2);const nwires=carried.reduce((t,c)=>t+(c.count||1),0);
        const lbl=(sec.circuit?(sec.circuit.name||'')+(sec.circuit.num?' '+sec.circuit.num:''):carried.length+' kör')+' · '+nwires+'ér';
        if(!dim&&state.circHoverInfo!==false)s+=`<text x="${mb[0]}" y="${mb[1]-4}" font-size="8.5" text-anchor="middle" fill="${ccol}" paint-order="stroke" stroke="#fff" stroke-width="2.6">${esc(lbl)}</text>`;}}}
    for(const n of pa.nodes){if(!state.levels[n.level])continue;const b=planToBase(n.x,n.y,dz(n.level,n.h));s+=`<circle cx="${b[0]}" cy="${b[1]}" r="1.8" fill="#555"/>`;}}
  if((state.mode==='path'||state.mode==='cable'||state.mode==='device')){const dr=state.mode==='path'?pathDraft:(state.mode==='cable'?draft:null);
    if(dr&&dr.nodes.length){const placed=dr.nodes.map(n=>[n.x,n.y,dz(n.level,n.h)]);
      // placed (committed) segments — solid
      s+=`<polyline points="${p2b(placed)}" fill="none" stroke="#6f757d" stroke-width="3.6"/>`;
      // pending segment to cursor — dashed + amber
      if(cursor){const a=dr.nodes[dr.nodes.length-1],A=[a.x,a.y,dz(a.level,a.h)],C=[cursor.x,cursor.y,dz(cursor.level,cursor.h)];
        s+=`<polyline points="${p2b([A,C])}" fill="none" stroke="#e8641c" stroke-width="3" stroke-dasharray="8 5"/>`
          +`<circle cx="${planToBase(...C)[0]}" cy="${planToBase(...C)[1]}" r="3.4" fill="#fff" stroke="#e8641c" stroke-width="2"/>`;}
      for(const n of dr.nodes){const b=planToBase(n.x,n.y,dz(n.level,n.h));s+=`<circle cx="${b[0]}" cy="${b[1]}" r="3" fill="#fff" stroke="#6f757d" stroke-width="2"/>`;}}
    if(state.mode==='device'&&cursor){const gt=($('devType')||{}).value||'socket';
      s+=`<g opacity="0.7">`+devSym({type:gt,level:cursor.level,x:cursor.x,y:cursor.y,h:cursor.h,ref:''})+`</g>`;}
    // hovering height mini-display (toggle: state.hDisp 'hover'|'side'|'off')
    if(state.hDisp==='hover'&&cursor){const c=planToBase(cursor.x,cursor.y,dz(cursor.level,cursor.h));
      const lastH=(dr&&dr.nodes.length)?dr.nodes[dr.nodes.length-1].h:null;
      const gd=GUIDES.find(x=>x.k===state.drawHKey),gc=gd?gd.c:'#111';
      const showSide=(state.mode==='device'&&cursor.wall);
      const pal=(state.mode==='path'||state.mode==='cable')?placeItem():null;   // what Space would drop
      const boxH=(showSide?56:40)+(pal?20:0);
      const bx0=c[0]+14,by0=c[1]-46;
      s+=`<line x1="${c[0]}" y1="${c[1]}" x2="${bx0}" y2="${by0+30}" stroke="#e8641c" stroke-width="1"/>`
        +`<g font-family="Arial" style="pointer-events:none">`
        +`<rect x="${bx0}" y="${by0}" width="150" height="${boxH}" rx="5" fill="#fffef8" stroke="#d8d2c4"/>`
        +`<rect x="${bx0}" y="${by0}" width="6" height="${boxH}" fill="${gc}"/>`
        +`<text x="${bx0+13}" y="${by0+16}" font-size="12" font-weight="700" fill="#111">↧ ${(cursor.h/1000).toFixed(2)} m</text>`
        +`<text x="${bx0+13}" y="${by0+31}" font-size="10" fill="#666">${esc(gd?gd.l:'')}</text>`
        +(lastH!=null&&Math.abs(lastH-cursor.h)>1?`<text x="${bx0+146}" y="${by0+16}" font-size="10" text-anchor="end" fill="#999">előző ${(lastH/1000).toFixed(2)}</text>`:'')
        +(showSide?`<text x="${bx0+13}" y="${by0+48}" font-size="9.5" fill="#2f6fb0">▣ ${state.side?'túloldal':'közeli oldal'} · Ctrl vált</text>`:'')
        +(pal?paletteBadge(bx0,by0+(showSide?56:40),pal):'')
        +`</g>`;}}
  // cables
  for(const cb of data.cables){if(!circOn[cb.type]||!layerShows(cb,'cable'))continue;const vis=cb.nodes.filter(n=>state.levels[n.level]);
    if(vis.length<2)continue;const cc=CIRC[cb.type];
    s+=`<polyline points="${p2b(cb.nodes.map(n=>[n.x,n.y,dz(n.level,n.h)]))}" fill="none" stroke="${cc.c}" stroke-width="2.3" stroke-dasharray="${cc.dash}" stroke-linejoin="round" stroke-linecap="round"/>`;
    for(const n of cb.nodes){if(!state.levels[n.level])continue;const b=planToBase(n.x,n.y,dz(n.level,n.h));s+=`<circle cx="${b[0]}" cy="${b[1]}" r="2" fill="${cc.c}"/>`;}}
  if(draft&&draft.nodes.length){const cc=CIRC[draft.type];const pts=draft.nodes.map(n=>[n.x,n.y,dz(n.level,n.h)]);
    if(cursor)pts.push([cursor.x,cursor.y,dz(cursor.level,cursor.h)]);
    s+=`<polyline points="${p2b(pts)}" fill="none" stroke="${cc.c}" stroke-width="2.3" stroke-dasharray="4 3"/>`;
    for(const n of draft.nodes){const b=planToBase(n.x,n.y,dz(n.level,n.h));s+=`<circle cx="${b[0]}" cy="${b[1]}" r="3" fill="#fff" stroke="${cc.c}" stroke-width="2"/>`;}}
  // devices
  // switch→device links (show what each switch controls)
  if(state.showSwitchLinks!==false)for(const sw of data.devices){if(sw.type!=='switch'||!sw.swMap||!state.levels[sw.level]||!layerShows(sw,'device'))continue;
    const a=planToBase(sw.x,sw.y,dz(sw.level,sw.h||0));
    Object.keys(sw.swMap).forEach(term=>{const tgt=devByRef(sw.swMap[term]);if(!tgt||!state.levels[tgt.level])return;
      const b=planToBase(tgt.x,tgt.y,dz(tgt.level,tgt.h||0));
      s+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#c43d8f" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.75"/>`
        +`<text x="${(a[0]*0.6+b[0]*0.4)}" y="${(a[1]*0.6+b[1]*0.4)-2}" font-size="7.5" fill="#c43d8f" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="2">${esc(term)}</text>`;});}
  // determine which devices are seen from BEHIND (through the wall) so devSym can dim them.
  // Robust method: a device is "behind" if, in the CURRENT projection, its host wall plane sits
  // between the camera and the device — i.e. the device's projected depth is GREATER (farther)
  // than the wall-face point in front of it. depthOf() is the same depth metric the face sorter uses.
  if(state.pitch<85){
    // Direction from a point TOWARD the camera, in plan mm (depth decreases toward the viewer).
    const towardCam=(x,y,z)=>{const e=50,gx=depthOf(x+e,y,z)-depthOf(x-e,y,z),gy=depthOf(x,y+e,z)-depthOf(x,y-e,z);
      const m=Math.hypot(gx,gy)||1;return [-gx/m,-gy/m];};
    // does the segment p→p+dir*len cross this axis-aligned wall rectangle? (slab test)
    const segHitsRect=(px,py,dx,dy,len,r)=>{let t0=0,t1=len;
      for(const [p0,d0,lo,hi] of [[px,dx,r.x0,r.x1],[py,dy,r.y0,r.y1]]){
        if(Math.abs(d0)<1e-9){if(p0<lo||p0>hi)return false;continue;}
        let a=(lo-p0)/d0,b=(hi-p0)/d0;if(a>b){const t=a;a=b;b=t;}
        t0=Math.max(t0,a);t1=Math.min(t1,b);if(t0>t1)return false;}
      return t1>1;};                                   // >1mm of travel inside the rect
    for(const d of data.devices){d.faceBack=false;
      const zc=dz(d.level,d.h||0);
      const walls=(WALLS[d.level]||[]).filter(r=>layerShows(r,'wall'));
      // host wall = the one whose centreline this device is closest to
      let wr=null,bd=1e9;walls.forEach(r=>{const wi=wallInfo(r);
        const nr=nearestOnSegPlain(d.x,d.y,wi.seg[0][0],wi.seg[0][1],wi.seg[1][0],wi.seg[1][1]);
        if(nr.d<bd){bd=nr.d;wr=r;}});
      if(bd>600)wr=null;                               // not mounted on anything → no host to exempt
      const v=towardCam(d.x,d.y,zc);
      // 1) the wall it is mounted ON: if its mounting face points away from the camera, we see its back.
      //    Uses the face NORMAL, not a depth comparison, so it can't flicker when the wall is edge-on.
      if(wr&&d.side!=null){const wi=wallInfo(wr);
        const nrm=[wi.perp[0]*(d.side?1:-1),wi.perp[1]*(d.side?1:-1)];
        if(nrm[0]*v[0]+nrm[1]*v[1] < -0.02)d.faceBack=true;}
      // 2) ANY other wall standing between the device and the camera also hides it — one wall is enough,
      //    and crossing several must not cancel out (the old parity-like depth test flipped it back).
      if(!d.faceBack){for(const r of walls){
        if(r===wr)continue;
        const z0=dz(d.level,0)+(r.z0||0),z1=z0+(r.h||wallH(d.level));
        if(zc<z0-1||zc>z1+1)continue;                  // the wall doesn't reach this height
        if(segHitsRect(d.x,d.y,v[0],v[1],20000,r)){d.faceBack=true;break;}}}
    }
  } else for(const d of data.devices)d.faceBack=false;
  // board connection rectangles (the whole rectangle is one connection point along the expected underside)
  for(const b of data.devices){if(b.type!=='board'||!state.levels[b.level]||!layerShows(b,'device'))continue;
    const poly=boardRectPoly(b).map(p=>planToBase(p[0],p[1],dz(b.level,b.z||BOARD_DEFAULT_Z)));
    s+=`<polygon points="${poly.map(p=>p[0]+','+p[1]).join(' ')}" fill="#ffe9b0" fill-opacity="0.5" stroke="#b8901f" stroke-width="1.3" stroke-dasharray="4 2"/>`;
    const c=planToBase(b.x,b.y,dz(b.level,b.z||BOARD_DEFAULT_Z));
    s+=`<text x="${c[0]}" y="${c[1]+3}" font-size="8.5" text-anchor="middle" fill="#7a5c0a" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="2.4">${esc(b.ref||'EL')}</text>`;}
  for(const d of data.devices){if(state.levels[d.level]&&layerShows(d,'device')&&soloOk(d.x,d.y,d.level))s+=devSym(d);}
  // notes
  for(const [ni,n] of data.notes.entries()){if(!state.levels[n.level])continue;
    if(typeof ntVisible==='function'&&!ntVisible(n))continue;
    const b=planToBase(n.x,n.y,dz(n.level,0));
    s+=(typeof ntSym==='function')?ntSym(n,ni,b)
      :`<g><path d="M${b[0]} ${b[1]} l-6 -12 a6 6 0 1 1 12 0 z" fill="#d1493f" stroke="#7a2a24"/><text x="${b[0]+9}" y="${b[1]-9}" font-size="10.5" fill="#333" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(n.text)}</text></g>`;}  // measures
  const ms=data.measures.concat(measureDraft&&measureDraft.length===2?[measureDraft]:[]);
  for(const mz of ms){const a=planToBase(mz[0].x,mz[0].y,dz(mz[0].level,0)),b=planToBase(mz[1].x,mz[1].y,dz(mz[1].level,0));
    const L=(Math.hypot(mz[1].x-mz[0].x,mz[1].y-mz[0].y)/1000).toFixed(2);
    s+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#7a2a24" stroke-width="1.6" stroke-dasharray="5 3"/><text x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2-4}" font-size="11" text-anchor="middle" fill="#7a2a24" paint-order="stroke" stroke="#fff" stroke-width="3">${L} m</text>`;}
  // ---- everything below is TRANSIENT chrome: rubber bands, ghosts, gizmo, selection.
  // It lives in its own layer so hovering or dragging a marquee never re-parses the drawing. ----
  let ov='';
  // live measure rubber-band (first point → cursor) before the 2nd click
  if(state.mode==='measure'&&measureDraft&&measureDraft.length===1&&cursor){
    const a=planToBase(measureDraft[0].x,measureDraft[0].y,dz(measureDraft[0].level,0)),b=planToBase(cursor.x,cursor.y,dz(cursor.level,0));
    const L=(Math.hypot(cursor.x-measureDraft[0].x,cursor.y-measureDraft[0].y)/1000).toFixed(3);
    ov+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#7a2a24" stroke-width="1.6" stroke-dasharray="5 3"/>`
      +`<circle cx="${a[0]}" cy="${a[1]}" r="3.5" fill="#fff" stroke="#7a2a24" stroke-width="2"/>`
      +`<circle cx="${b[0]}" cy="${b[1]}" r="3.5" fill="#e8641c" stroke="#fff" stroke-width="1.5"/>`
      +`<text x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2-5}" font-size="12" text-anchor="middle" fill="#7a2a24" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="3.5">${L} m</text>`;}
  if(selBox){const x0=Math.min(selBox.x0,selBox.x1),x1=Math.max(selBox.x0,selBox.x1),y0=Math.min(selBox.y0,selBox.y1),y1=Math.max(selBox.y0,selBox.y1);
    // client px → base coords (inverse of base*zoom+pan)
    const bx0=(x0-state.panX)/state.zoom,by0=(y0-state.panY)/state.zoom,bx1=(x1-state.panX)/state.zoom,by1=(y1-state.panY)/state.zoom;
    ov+=`<rect x="${bx0}" y="${by0}" width="${bx1-bx0}" height="${by1-by0}" fill="#2f6fb0" fill-opacity="0.08" stroke="#2f6fb0" stroke-width="${1.2/state.zoom}" stroke-dasharray="${6/state.zoom} ${4/state.zoom}"/>`;}
  const _sl=selList();
  if(state.mode==='grab'&&_sl.length>1){
    // highlight each selected piece + one group gizmo at the centroid
    _sl.forEach(h=>{const c=pGetC(h);if(!c)return;const b=planToBase(c[0],c[1],dz(pieceLevel(h),pGetZ(h)));
      ov+=`<circle cx="${b[0]}" cy="${b[1]}" r="9" fill="#2f6fb0" fill-opacity="0.18" stroke="#2f6fb0" stroke-width="2"/>`;});
    const gc=groupCentroid(_sl),gb=planToBase(gc[0],gc[1],dz(state.active,0));
    ov+=gizmoSvgAt(gb,_sl.length);
  } else if(state.mode==='grab'&&selected)ov+=gizmoSvg(selected);
  if(state.mode==='select'&&_sl.length>1){_sl.forEach(h=>{const c=pGetC(h);if(!c)return;const b=planToBase(c[0],c[1],dz(pieceLevel(h),pGetZ(h)));
      ov+=`<circle cx="${b[0]}" cy="${b[1]}" r="9" fill="#2f6fb0" fill-opacity="0.18" stroke="#2f6fb0" stroke-width="2"/>`;});}
  if(state.mode==='format'&&fmtSource&&selected){const c=pGetC(selected),b=planToBase(c[0],c[1],dz(pieceLevel(selected),pGetZ(selected)));
    ov+=`<circle cx="${b[0]}" cy="${b[1]}" r="13" fill="none" stroke="#e8641c" stroke-width="2.5" stroke-dasharray="4 3"/>`
      +`<text x="${b[0]}" y="${b[1]-18}" font-size="10" text-anchor="middle" fill="#e8641c" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="3">🖌 forrás</text>`;}
  const changed=paintLayers(s,ov);
  setTransform();
  if(typeof statusBar==='function')statusBar();
  if(typeof renderShell==='function')renderShell();
  // totals derive from the model, and the model can't have changed if the scene string
  // is identical — so a camera move or a hover no longer recomputes the BOM.
  if(changed.scene)updateTotals();
  const hb=$('hBox');if(hb){if(state.hDisp==='side'&&(state.mode==='path'||state.mode==='cable'||state.mode==='device')){
    const dr=state.mode==='path'?pathDraft:(state.mode==='cable'?draft:null),gd=GUIDES.find(x=>x.k===state.drawHKey),gc=gd?gd.c:'#111';
    const nh=cursor?cursor.h:drawHmm(state.active),lastH=(dr&&dr.nodes.length)?dr.nodes[dr.nodes.length-1].h:null;
    hb.style.display='block';
    hb.innerHTML=`<div style="display:flex;align-items:center;gap:8px"><span style="width:12px;height:26px;border-radius:3px;background:${gc};display:inline-block"></span>`
      +`<div><div style="font-size:16px;font-weight:700">${(nh/1000).toFixed(2)} m</div><div style="font-size:11px;color:#666">${esc(gd?gd.l:'')}</div></div></div>`
      +(lastH!=null?`<div style="font-size:11px;color:#888;margin-top:4px">előző pont: ${(lastH/1000).toFixed(2)} m${Math.abs(lastH-nh)>1?' → '+(nh>lastH?'emelkedik ↑':'süllyed ↓'):''}</div>`:'');
  }else hb.style.display='none';}
  scheduleSave();}
function setTransform(){vp.setAttribute('transform',`translate(${state.panX},${state.panY}) scale(${state.zoom})`);}
function esc(t){return (t||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}


// test hooks
window.paintStats=paintStats;window.invalidateLayers=invalidateLayers;window.drawSoon=drawSoon;
