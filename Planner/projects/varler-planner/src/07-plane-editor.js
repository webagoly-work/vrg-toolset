// ==========================================================================
// 06-plane-editor.js — floor / álmennyezet / ceiling plane editor
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// FLOOR / CEILING PLANE EDITOR (top-down) ////////////////////
// Same editing model as the wall elevation editor, but projected top-down onto a height BAND:
//   Padló   → everything from just under the slab up to +tol
//   Mennyezet → everything within tol of the ceiling, drawn FROM ABOVE (through the slab), so
//               left/right stay identical to the floor view and the eye can move between the two.
const PLANE_TOL=300;                                    // default half-band (mm)
function planeBand(level,kind,tol,rm){const H=wallH(level);tol=tol||PLANE_TOL;
  if(kind==='drop'){const D=dropCeilOrDefault(level,rm);      // álmennyezet: the band sits at the suspended plane
    // capped just under the slab, so anything fixed to the structural ceiling stays in the Mennyezet plane
    return {lo:D-tol,hi:Math.min(D+tol,H-1),ref:D,H,plenum:Math.max(0,H-D)};}
  return kind==='ceiling'?{lo:H-tol,hi:H+600,ref:H,H}:{lo:-600,hi:tol,ref:0,H};}
function planeKey(level,kind,poly){const b=polyBBox(poly);
  return 'PL|'+level+'|'+kind+'|'+Math.round(b.x0)+','+Math.round(b.y0)+','+Math.round(b.x1)+','+Math.round(b.y1);}
// devices/sections whose height falls in the band land in the editable set; the rest come along as
// pale context (a wall switch is worth seeing while you lay out the ceiling).
function planeViewData(room,level,kind,tol){
  const poly=room.poly,pb=polyBBox(poly),PAD=400;
  const bb={x0:pb.x0-PAD,y0:pb.y0-PAD,x1:pb.x1+PAD,y1:pb.y1+PAD};
  const band=planeBand(level,kind,tol,room),key=planeKey(level,kind,poly);
  const inb=h=>((h||0)>=band.lo&&(h||0)<=band.hi);
  const ins=(x,y)=>x>=bb.x0&&x<=bb.x1&&y>=bb.y0&&y<=bb.y1;
  const devs=[],ghosts=[],secs=[],risers=[],ops=[];
  data.devices.forEach((dv,di)=>{if(dv.level!==level||!ins(dv.x,dv.y))return;
    const rec={di,type:dv.type,ref:dv.ref,u:dv.x,h:dv.y,z:dv.h||0,back:false,devDef:dv.devDef,boxColor:dv.boxColor,
      jbShape:dv.jbShape,jbSize:dv.jbSize,clip:dv.clip,link:dv.link};
    (inb(dv.h||0)?devs:ghosts).push(rec);});
  data.paths.forEach((pa,pi)=>{for(let i=0;i<pa.nodes.length-1;i++){
    const a=pa.nodes[i],c=pa.nodes[i+1];if(a.level!==level&&c.level!==level)continue;
    const sec=pa.sections[i]||{};
    const ia=inb(a.h||0)&&ins(a.x,a.y),ic=inb(c.h||0)&&ins(c.x,c.y);
    if(ia&&ic)secs.push({pi,na:i,nb:i+1,ua:a.x,ha:a.y,ub:c.x,hb:c.y,build:sec.build||'sull_gege',
      dia:sec.dia,cd:sec.cd,carried:(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]),back:false,
      za:a.h||0,zb:c.h||0});
    else if(ia)risers.push({pi,ni:i,u:a.x,h:a.y,z:a.h||0,to:c.h||0});
    else if(ic)risers.push({pi,ni:i+1,u:c.x,h:c.y,z:c.h||0,to:a.h||0});}});
  (data.openings||[]).forEach((o,oi)=>{if(o.level!==level||!ins(o.x,o.y))return;
    if(o.type!=='door'&&o.type!=='window')return;
    ops.push({oi,type:o.type,x:o.x,y:o.y,ang:o.ang||0,w:o.w||(o.type==='window'?WIN_W:DOOR_W)});});
  const notes=noteSurfaceHidden(key)?[]:(data.wallNotes||[]).map((n,i)=>({...n,i})).filter(n=>n.wallKey===key)
    .map(n=>({i:n.i,u:n.u,h:n.h,text:n.text,kind:n.kind,tag:n.tag}));
  return {room,level,kind,band,key,poly,bb,pb,walls:roomWalls(poly,level),devs,ghosts,secs,risers,ops,notes,
    W:bb.x1-bb.x0,D:bb.y1-bb.y0,RW:pb.x1-pb.x0,RD:pb.y1-pb.y0};}

function pvText(x,y,txt,size,fill,anchor,rot){const tr=rot?` transform="rotate(${rot} ${x} ${y})"`:'';
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor||'middle'}"${tr} fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">${txt}</text>`
       + `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor||'middle'}"${tr} fill="${fill}">${txt}</text>`;}
function planeViewSVG(d,dims){const M=56;
  const full=!!(PV&&PV.full),vw=(typeof window!=='undefined'&&window.innerWidth)||1200,vh=(typeof window!=='undefined'&&window.innerHeight)||800;
  const AVW=full?Math.max(980,vw-120):980,AVH=full?Math.max(460,vh-260):500;
  const sc=Math.min((AVW-2*M)/Math.max(d.W,1),(AVH-2*M)/Math.max(d.D,1));
  const mir=(PV&&PV.mirror)?1:0;
  const X=x=>+(M+(mir?(d.bb.x1-x):(x-d.bb.x0))*sc).toFixed(1);
  const Y=y=>+(M+(y-d.bb.y0)*sc).toFixed(1);
  const L=(PV&&PV.layers)||{installed:true,cuts:true,notes:true,cutLabels:true,context:true,walls:true};
  const ceil=(d.kind==='ceiling'||d.kind==='drop'),drop=(d.kind==='drop');
  const chS=L.cuts?wvChaseShapes(d,X,Y,sc):[];
  const cutLines=chS.length?chaseSummaryLines(chS,d.W*sc+2*M):[];
  const extra=dims?26:0,cutExtra=cutLines.length?(cutLines.length*12+4):0;
  const Wpx=Math.round(d.W*sc+2*M),Hpx=Math.round(d.D*sc+2*M+extra+cutExtra);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${Wpx}" height="${Hpx}" viewBox="0 0 ${Wpx} ${Hpx}" font-family="Segoe UI,Arial">`
    +`<defs><pattern id="chaseh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#f7e2ce"/><line x1="0" y1="0" x2="0" y2="5" stroke="#c0794f" stroke-width="1"/><line x1="2.5" y1="0" x2="2.5" y2="5" stroke="#dfae8e" stroke-width="0.6"/></pattern></defs>`
    +`<rect width="${Wpx}" height="${Hpx}" fill="#fff"/>`;
  // room slab
  const pts=d.poly.map(p=>X(p[0])+','+Y(p[1])).join(' ');
  s+=`<polygon points="${pts}" fill="${ceil?'#f7f5ef':(d.room.fill||'#eceadf')}" stroke="#a9a294" stroke-width="1"${ceil?' stroke-dasharray="6 3"':''}/>`;
  // bounding walls — in ceiling mode we are looking down THROUGH them, so they are ghosted
  if(L.walls!==false)d.walls.forEach(w=>{const r=w.r;
    const x0=Math.min(X(r.x0),X(r.x1)),x1=Math.max(X(r.x0),X(r.x1)),y0=Y(r.y0),y1=Y(r.y1);
    s+=`<rect x="${x0}" y="${y0}" width="${(x1-x0).toFixed(1)}" height="${(y1-y0).toFixed(1)}" `
      +(ceil?`fill="#eeebe3" fill-opacity="0.5" stroke="#b6afa2" stroke-width="0.8" stroke-dasharray="4 3"`
            :`fill="#ded9cc" stroke="#8f887a" stroke-width="0.9"`)+`/>`;
    s+=`<text x="${((x0+x1)/2).toFixed(1)}" y="${((y0+y1)/2+3).toFixed(1)}" font-size="8" text-anchor="middle" fill="#9a9184">${w.side}</text>`;});
  // door/window footprints, for orientation
  d.ops.forEach(o=>{const dx=Math.cos(o.ang),dy=Math.sin(o.ang),hw=o.w/2;
    const ax=X(o.x-dx*hw),ay=Y(o.y-dy*hw),bx=X(o.x+dx*hw),by=Y(o.y+dy*hw);
    s+=`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${o.type==='window'?'#2f6fb0':'#fff'}" stroke-width="4" stroke-linecap="butt"/>`
      +`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#7d7466" stroke-width="0.7" stroke-dasharray="3 2"/>`;});
  // ---- CHASE LAYER (shared with the wall editor) ----
  if(L.cuts&&chS.length){
    s+=`<clipPath id="cutclip">`+chS.map(S=>`<polygon points="${S.poly.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')}"/>`).join('')+`</clipPath>`;
    s+=`<rect class="cutfill" width="${Wpx}" height="${Hpx}" fill="url(#chaseh)" clip-path="url(#cutclip)" opacity="0.92"/>`;
    chaseOutline(chS).forEach(g=>{s+=`<line class="cutedge" x1="${g[0].toFixed(1)}" y1="${g[1].toFixed(1)}" x2="${g[2].toFixed(1)}" y2="${g[3].toFixed(1)}" stroke="#b07a5a" stroke-width="0.9" stroke-linecap="round"/>`;});
    if(L.cutLabels!==false)chS.forEach(S=>{if(S.kind!=='path')return;
      const len=Math.hypot(S.poly[1].x-S.poly[0].x,S.poly[1].y-S.poly[0].y);if(len<74)return;
      let a=S.ang*180/Math.PI;if(a>90)a-=180;if(a<-90)a+=180;
      const off=S.hw+9,sgn=(S.ny>0?-1:1),lx=S.mx+S.nx*off*sgn,ly=S.my+S.ny*off*sgn+2.5;
      const lt=`⌀${S.dia} · ${S.w}×${S.dep}`,tr=`rotate(${a.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})`;
      s+=`<text class="cutlbl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="${tr}" font-size="8.5" text-anchor="middle" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">${lt}</text>`
        +`<text class="cutlbl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="${tr}" font-size="8.5" text-anchor="middle" fill="#8a5a3a">${lt}</text>`;});
  }
  // ---- CONTEXT: whatever sits outside the height band ----
  if(L.context!==false)d.ghosts.forEach(g=>{const x=X(g.u),y=Y(g.h);
    s+=`<circle class="pvghost" cx="${x}" cy="${y}" r="4" fill="#fff" stroke="#b9b3a6" stroke-width="1"/>`
      +pvText((x+7).toFixed(1),(y+12).toFixed(1),esc(g.ref||'')+' '+Math.round(g.z),7.5,'#b0a99c','start');});
  // ---- INSTALLED ----
  const warpPi=(PV&&PV.warp)?PV.warp.pi:null;
  if(L.installed!==false){
    d.secs.forEach(t=>{const col=((t.build||'').indexOf('kv_')===0?'#c0761d':'#6f757d');
      const sw=((t.build||'').indexOf('sull')>=0?Math.max(1.5,+(chaseDia(t.build,t)*sc).toFixed(2)):2.4);
      s+=`<line x1="${X(t.ua)}" y1="${Y(t.ha)}" x2="${X(t.ub)}" y2="${Y(t.hb)}" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${(t.build||'').indexOf('kv_')===0?'':'6 3'}" stroke-linecap="round"/>`
        +`<line class="wvseg" data-pi="${t.pi}" data-na="${t.na}" data-nb="${t.nb}" x1="${X(t.ua)}" y1="${Y(t.ha)}" x2="${X(t.ub)}" y2="${Y(t.hb)}" stroke="transparent" stroke-width="14" stroke-linecap="round" pointer-events="stroke" style="cursor:grab"/>`;
      if(t.carried&&t.carried.length){const mx=(X(t.ua)+X(t.ub))/2,my=(Y(t.ha)+Y(t.hb))/2,c=t.carried[0],n=t.carried.reduce((a,x)=>a+(x.count||1),0);
        s+=pvText(mx.toFixed(1),(my-5).toFixed(1),esc((c.name||'')+(c.num?' '+c.num:''))+' '+n+'ér',9,'#0a5c33');}});
    d.secs.forEach(t=>{const col=((t.build||'').indexOf('kv_')===0?'#c0761d':'#6f757d'),hi=(t.pi===warpPi);
      s+=`<circle class="wvnode" data-pi="${t.pi}" data-ni="${t.na}" cx="${X(t.ua)}" cy="${Y(t.ha)}" r="4.5" fill="${hi?'#fff3d6':'#fff'}" stroke="${hi?'#e8641c':col}" stroke-width="1.6" style="cursor:move"/>`
        +`<circle class="wvnode" data-pi="${t.pi}" data-ni="${t.nb}" cx="${X(t.ub)}" cy="${Y(t.hb)}" r="4.5" fill="${hi?'#fff3d6':'#fff'}" stroke="${hi?'#e8641c':col}" stroke-width="1.6" style="cursor:move"/>`;});
    // risers: where a run leaves this plane (a vertical drop is a single point from above)
    d.risers.forEach(r=>{const x=X(r.u),y=Y(r.h),up=(r.to>r.z);
      s+=`<circle class="pvriser" cx="${x}" cy="${y}" r="10" fill="#fff" stroke="#2f6fb0" stroke-width="1.8"/>`
        +`<text x="${x}" y="${y+4.6}" font-size="13" font-weight="700" text-anchor="middle" fill="#2f6fb0">${up?'↑':'↓'}</text>`
        +pvText((x+13).toFixed(1),(y-11).toFixed(1),Math.round(r.to)+' mm',9,'#2f6fb0','start');});
    d.devs.forEach(dv=>{const x=X(dv.u),y=Y(dv.h);
      s+=`<g class="wvdev" data-di="${dv.di}" style="cursor:move">`+wvDevBox(dv,x,y,sc,'#0a2b6b',false)+`</g>`;
      s+=pvText(x,(y-(DEV_BOX_W/2)*sc-5).toFixed(1),esc(dv.ref||''),9,'#0a2b6b');
      if(dv.link)s+=`<circle cx="${x}" cy="${y}" r="${(DEV_BOX_W/2)*sc+3}" fill="none" stroke="#c0530f" stroke-width="0.9" stroke-dasharray="2 2"/>`;});
    // warp box
    if(warpPi!=null){const bx=wvWarpBox(d,warpPi);
      if(bx){const x0=Math.min(X(bx.u0),X(bx.u1)),x1=Math.max(X(bx.u0),X(bx.u1)),y0=Math.min(Y(bx.h0),Y(bx.h1)),y1=Math.max(Y(bx.h0),Y(bx.h1));
        s+=`<rect x="${x0-6}" y="${y0-6}" width="${(x1-x0+12).toFixed(1)}" height="${(y1-y0+12).toFixed(1)}" fill="none" stroke="#e8641c" stroke-width="1" stroke-dasharray="5 3"/>`;
        [[0,0],[0.5,0],[1,0],[1,0.5],[1,1],[0.5,1],[0,1],[0,0.5]].forEach(hd=>{
          const hx=hd[0],hy=hd[1],px=X(bx.u0+hx*(bx.u1-bx.u0)),py=Y(bx.h0+hy*(bx.h1-bx.h0));
          const cur=(hx===0.5?'ns-resize':hy===0.5?'ew-resize':'nwse-resize');
          s+=`<rect class="wvwarp" data-pi="${warpPi}" data-hx="${hx}" data-hy="${hy}" x="${(px-4).toFixed(1)}" y="${(py-4).toFixed(1)}" width="8" height="8" fill="#fff" stroke="#e8641c" stroke-width="1.4" style="cursor:${cur}"/>`;});}}
  }
  // ---- NOTES ----
  if(L.notes!==false)d.notes.forEach(n=>{s+=noteBox(n,X(n.u),Y(n.h));});
  // ---- dims + caption ----
  if(dims){const y=Y(d.bb.y1)+16,x0=Math.min(X(d.pb.x0),X(d.pb.x1)),x1=Math.max(X(d.pb.x0),X(d.pb.x1));
    s+=`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#666" stroke-width="0.8"/>`
      +`<line x1="${x0}" y1="${y-4}" x2="${x0}" y2="${y+4}" stroke="#666" stroke-width="0.8"/><line x1="${x1}" y1="${y-4}" x2="${x1}" y2="${y+4}" stroke="#666" stroke-width="0.8"/>`
      +pvText(((x0+x1)/2).toFixed(1),(y-3).toFixed(1),Math.round(d.RW)+' mm',9,'#555');
    const xL=Math.min(X(d.bb.x0),X(d.bb.x1))-14,ya=Y(d.pb.y0),yb=Y(d.pb.y1);
    s+=`<line x1="${xL}" y1="${ya}" x2="${xL}" y2="${yb}" stroke="#666" stroke-width="0.8"/>`
      +`<line x1="${xL-4}" y1="${ya}" x2="${xL+4}" y2="${ya}" stroke="#666" stroke-width="0.8"/><line x1="${xL-4}" y1="${yb}" x2="${xL+4}" y2="${yb}" stroke="#666" stroke-width="0.8"/>`
      +pvText((xL-4).toFixed(1),((ya+yb)/2).toFixed(1),Math.round(d.RD)+' mm',9,'#555','middle','-90');}
  const cap=drop?('Álmennyezet — felülnézet, a falakon átnézve · sík '+Math.round(d.band.ref)+' mm · plénum '+Math.round(d.band.plenum||0)+' mm a födém alatt')
    :(ceil?'Mennyezet — felülnézet, a falakon átnézve (a padlóval azonos állás)':'Padló — felülnézet');
  const band=`sáv: ${Math.round(d.band.lo)}–${Math.round(d.band.hi)} mm${mir?' · tükrözve':''}`;
  if((cap+band).length>78){   // keep the caption inside the sheet on the narrower planes
    s+=`<text x="${M}" y="14" font-size="10" fill="#6b6357">${cap}</text>`
      +`<text x="${M}" y="26" font-size="10" fill="#8b8377">${band}</text>`;}
  else s+=`<text x="${M}" y="16" font-size="10" fill="#6b6357">${cap} · ${band}</text>`;
  cutLines.forEach((ln,i)=>{s+=`<text class="cutsum" x="${M}" y="${Y(d.bb.y1)+(dims?34:18)+i*12}" font-size="9.5" fill="#8a5a3a">${esc(ln)}</text>`;});
  s+=`</svg>`;
  return {svg:s,w:Wpx,h:Hpx,sc,M,mir,bb:d.bb};}

// ---- plane setters (mm in plan space) ----
function pvSetDevice(di,x,y,raw){const dv=data.devices[di];if(!dv)return;
  const q=v=>raw?Math.round(v):Math.round(v/fineStep(10))*fineStep(10);
  const nx=(x!=null?q(x):dv.x),ny=(y!=null?q(y):dv.y),ddx=nx-dv.x,ddy=ny-dv.y;
  const grp=clipGroupOf(di);
  grp.forEach(i=>{const g=data.devices[i];g.x+=ddx;g.y+=ddy;});
  wvPushLinkedNodes(grp);}
function pvSetDeviceZ(di,z){const grp=clipGroupOf(di);
  grp.forEach(i=>{data.devices[i].h=Math.max(0,Math.round(z));});wvPushLinkedNodes(grp);}
function pvSetNode(pi,ni,x,y,raw){const pa=data.paths[pi];if(!pa||!pa.nodes[ni])return;const n=pa.nodes[ni];
  const q=v=>raw?Math.round(v):Math.round(v/fineStep(10))*fineStep(10);
  if(x!=null)n.x=q(x);if(y!=null)n.y=q(y);
  wvPullLinkedDev(pi,ni);}
function pvSetNote(i,x,y){const n=(data.wallNotes||[])[i];if(!n)return;n.u=Math.round(x);n.h=Math.round(y);}

// ---- create anything, top-down ----
function pvCreateDevice(type,x,y){const band=PV.data.band;wvPush();
  const dev={type,level:PV.level,x:Math.round(x/10)*10,y:Math.round(y/10)*10,h:band.ref,layer:curLayer(),ref:nextRef(type)};
  if(type==='board'){dev.h=boardZ();dev.z=boardZ();dev.rw=BOARD_RW;dev.rd=BOARD_RD;}
  data.devices.push(dev);
  if(type==='board'&&typeof ensureBoardObject==='function')ensureBoardObject(dev);
  renderPlaneView();draw();return data.devices.length-1;}
function pvStartPath(x,y){wvPush();
  data.paths.push({ptype:state.pathType,nodes:[{level:PV.level,x:Math.round(x/10)*10,y:Math.round(y/10)*10,h:PV.data.band.ref}],
    sections:[],layer:curLayer()});
  PV.drawPi=data.paths.length-1;renderPlaneView();}
function pvAddPathNode(x,y){if(PV.drawPi==null)return;const pa=data.paths[PV.drawPi];if(!pa)return;
  pa.sections.push({build:'sull_gege',circuit:null});
  pa.nodes.push({level:PV.level,x:Math.round(x/10)*10,y:Math.round(y/10)*10,h:PV.data.band.ref});
  renderPlaneView();draw();}
function pvFinishPath(){if(PV.drawPi==null)return;const pa=data.paths[PV.drawPi];
  if(pa&&pa.nodes.length<2){data.paths.splice(PV.drawPi,1);wvRelinkAfterPathRemoval(PV.drawPi);}
  PV.drawPi=null;PV.sel=null;renderPlaneView();draw();}
function pvCreateMenu(ev,x,y){ctxMenu(ev,pvCreateItems(x,y));}
function pvCreateItems(x,y){const ref=Math.round(PV.data.band.ref);
  const items=[
    {label:`＋ Lámpa ide (${ref} mm)`,act:()=>pvCreateDevice('light',x,y)},
    {label:`＋ Kötődoboz ide (${ref} mm)`,act:()=>pvCreateDevice('junction',x,y)},
    {label:`＋ Aljzat ide (${ref} mm)`,act:()=>pvCreateDevice('socket',x,y)},
    {label:`＋ Kapcsoló ide (${ref} mm)`,act:()=>pvCreateDevice('switch',x,y)},
    {label:'✏ Pálya rajzolása innen',act:()=>pvStartPath(x,y)},
    {label:'📝 Jegyzet ide…',act:()=>{wvPush();data.wallNotes=data.wallNotes||[];
      data.wallNotes.push({wallKey:PV.data.key,u:Math.round(x),h:Math.round(y),text:'',kind:'info'});
      const i=data.wallNotes.length-1;renderPlaneView();noteDialog(i,renderPlaneView);}}];
  if(PV.drawPi!=null)items.unshift({label:'✔ Pálya lezárása (Enter)',act:()=>pvFinishPath()});
  return items;}

// ---- coordinate list (X from the left edge, Y from the top edge, plus the height) ----
function pvListRows(d){const rows=[];
  d.devs.forEach(dv=>rows.push({kind:'dev',key:'d'+dv.di,i:dv.di,type:(DEV[dv.type]||dv.type),ref:dv.ref||('#'+dv.di),
    x:dv.u,y:dv.h,z:dv.z,extra:'',link:linkLabel(data.devices[dv.di]||{})}));
  const rz={};d.risers.forEach(r=>{rz[r.pi+':'+r.ni]=(r.to>r.z?'↑ ':'↓ ')+Math.round(r.to)+' mm';});
  const seen={};d.secs.forEach(t=>[[t.na,t.ua,t.ha,t.za],[t.nb,t.ub,t.hb,t.zb]].forEach(nd=>{
    const k=t.pi+':'+nd[0];if(seen[k])return;seen[k]=1;
    rows.push({kind:'node',key:'n'+k,pi:t.pi,ni:nd[0],type:(rz[k]?'Pálya-csomópont ⊙':'Pálya-csomópont'),ref:'P'+t.pi+'/'+nd[0],
      x:nd[1],y:nd[2],z:nd[3],extra:'⌀'+chaseDia(t.build,t)+' mm'+(rz[k]?' · '+rz[k]:''),link:''});}));
  d.risers.forEach(r=>{const k=r.pi+':'+r.ni;if(seen[k])return;seen[k]=1;
    rows.push({kind:'node',key:'n'+k,pi:r.pi,ni:r.ni,type:'Síkból kilépő pont ⊙',ref:'P'+r.pi+'/'+r.ni,
      x:r.u,y:r.h,z:r.z,extra:rz[k],link:''});});
  d.ghosts.forEach(g=>rows.push({kind:'dev',key:'d'+g.di,i:g.di,type:(DEV[g.type]||g.type),ref:g.ref||('#'+g.di),
    x:g.u,y:g.h,z:g.z,extra:'sávon kívül',link:'',ghost:true}));
  d.notes.forEach(n=>rows.push({kind:'note',key:'t'+n.i,i:n.i,type:'Jegyzet',ref:n.text||'',x:n.u,y:n.h,z:null,extra:'',link:''}));
  return rows.sort((a,b)=>a.x-b.x||a.y-b.y);}
function pvListHTML(d){const rows=pvListRows(d);
  if(!rows.length)return `<div style="font-size:11px;color:#999;padding:4px">Ebben a síkban még nincs elem — jobb klikk: lámpa / kötődoboz / aljzat / pálya / jegyzet.</div>`;
  const cell=(r,f,v)=>`<input class="pvcell" data-k="${r.key}" data-f="${f}" type="number" step="1" value="${Math.round(v)}" style="width:64px;font-size:10.5px;padding:1px 2px">`;
  return `<table style="width:100%;border-collapse:collapse;font-size:10.5px">`
    +`<tr style="color:#666;text-align:left"><th style="padding:2px 4px">Elem</th><th>Azonosító</th>`
    +`<th title="a helyiség bal szélétől">X balról</th><th title="a helyiség felső szélétől">Y fentről</th><th title="magasság a padlótól">magasság</th><th></th><th></th></tr>`
    +rows.map(r=>`<tr data-k="${r.key}" style="border-top:1px solid #f0f0f0;${r.ghost?'opacity:.55':''}">`
      +`<td style="padding:2px 4px;white-space:nowrap">${esc(r.type)}</td>`
      +`<td style="color:#0a2b6b;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis">${esc(String(r.ref))}</td>`
      +`<td>${cell(r,'x',r.x-d.pb.x0)}</td><td>${cell(r,'y',r.y-d.pb.y0)}</td>`
      +`<td>${r.z==null?'<span style="color:#bbb">—</span>':cell(r,'z',r.z)}</td>`
      +`<td style="color:#999;white-space:nowrap">${esc(r.extra||'')}${r.link?` <span style="color:#c0530f" title="pályához kötve">🔗${esc(r.link)}</span>`:''}</td>`
      +`<td><button class="pvdel" data-k="${r.key}" title="törlés" style="font-size:10px;padding:0 4px;color:#b33">✕</button></td></tr>`).join('')
    +`</table>`;}
function pvListApply(d,rows,key,field,val){const r=rows.find(z=>z.key===key);if(!r)return;wvPush();
  if(field==='z'){if(r.kind==='dev')pvSetDeviceZ(r.i,val);
    else if(r.kind==='node'){const pa=data.paths[r.pi],n=pa&&pa.nodes[r.ni];if(n){n.h=Math.max(0,Math.round(val));wvPullLinkedDev(r.pi,r.ni);}}
    return;}
  const abs=(field==='x'?d.pb.x0:d.pb.y0)+val;
  if(r.kind==='dev')pvSetDevice(r.i,field==='x'?abs:null,field==='y'?abs:null,true);
  else if(r.kind==='node')pvSetNode(r.pi,r.ni,field==='x'?abs:null,field==='y'?abs:null,true);
  else if(r.kind==='note')pvSetNote(r.i,field==='x'?abs:r.x,field==='y'?abs:r.y);}
function pvListDelete(rows,key){const r=rows.find(z=>z.key===key);if(!r)return;wvPush();
  if(r.kind==='dev')data.devices.splice(r.i,1);
  else if(r.kind==='note')(data.wallNotes||[]).splice(r.i,1);
  else if(r.kind==='node'){const pa=data.paths[r.pi];if(!pa)return;
    if(pa.nodes.length<=2){data.paths.splice(r.pi,1);wvRelinkAfterPathRemoval(r.pi);}
    else{pa.nodes.splice(r.ni,1);pa.sections.splice(Math.min(r.ni,pa.sections.length-1),1);}}}

function openPlaneView(room,level,kind){
  PV={room,level,kind,tol:PLANE_TOL,dims:true,mirror:false,list:true,
    layers:{installed:true,cuts:true,notes:true,cutLabels:true,context:true,walls:true},
    base:snap_(),undo:[],redo:[],dirty:false,full:false,warp:null,drawPi:null,drag:null,data:null,
    render:renderPlaneView,finishPath:()=>pvFinishPath()};
  PV.keyFn=edKeyFn(PV);document.addEventListener('keydown',PV.keyFn,true);
  renderPlaneView();}

function renderPlaneView(){const d=planeViewData(PV.room,PV.level,PV.kind,PV.tol);PV.data=d;
  const out=planeViewSVG(d,PV.dims);
  modalEl.classList.toggle('full',!!PV.full);modalEl.style.maxWidth=PV.full?'100vw':'96vw';modalEl.style.width=PV.full?'99vw':'';
  const ceil=(PV.kind==='ceiling');
  modalEl.innerHTML=`<h4 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Sík-szerkesztő — ${esc(PV.room.name||'Helyiség')} · ${PV.level} · ${Math.round(d.W)}×${Math.round(d.D)} mm`
    +`${PV.dirty?'<span style="font-size:11px;color:#c0530f;font-weight:600">● módosítva</span>':''}`
    +`<span style="flex:1"></span>`
    +`<button id="pvUndoB" title="Visszavonás (Ctrl+Z)" style="font-size:12px" ${PV.undo.length?'':'disabled'}>↶</button>`
    +`<button id="pvRedoB" title="Újra (Ctrl+Shift+Z)" style="font-size:12px" ${PV.redo.length?'':'disabled'}>↷</button>`
    +`<button id="pvFull" title="Teljes képernyő (Esc kilép)" style="font-size:12px">${PV.full?'🗗':'⛶'}</button></h4>`
    +`<div class="mrow" style="gap:8px;flex-wrap:wrap">`
    +`<span style="display:inline-flex;border:1px solid #bbb;border-radius:6px;overflow:hidden">`
    +`<button id="pvFloor" style="font-size:11.5px;border:0;padding:3px 10px;${PV.kind==='floor'?'background:#0a2b6b;color:#fff':'background:#fff'}">⬓ Padló</button>`
    +`<button id="pvDrop" style="font-size:11.5px;border:0;padding:3px 10px;border-left:1px solid #ddd;${PV.kind==='drop'?'background:#0a2b6b;color:#fff':'background:#fff'}" title="${hasDropCeil(PV.level,PV.room)?'':'Ezen a helyiségen nincs beállítva álmennyezet — a szint alapértelmezése szerint rajzolok.'}">⬓⬒ Álmennyezet${hasDropCeil(PV.level,PV.room)?'':' *'}</button>`
    +`<button id="pvCeil" style="font-size:11.5px;border:0;padding:3px 10px;border-left:1px solid #ddd;${PV.kind==='ceiling'?'background:#0a2b6b;color:#fff':'background:#fff'}">⬒ Mennyezet</button></span>`
    +`<label>sáv ±<input id="pvTol" type="number" step="50" min="10" value="${PV.tol}" style="width:56px">mm</label>`
    +`<label><input type="checkbox" id="pvDims" ${PV.dims?'checked':''}> Méret</label>`
    +`<button id="pvMirror" style="font-size:11px">🪞 Tükrözés${PV.mirror?' ✓':''}</button>`
    +`</div>`
    +`<div class="mrow" style="gap:10px;flex-wrap:wrap;font-size:11px;border-top:1px solid #eee;padding-top:5px"><b style="color:#555">Rétegek:</b>`
    +`<label><input type="checkbox" id="pvLInst" ${PV.layers.installed?'checked':''}> Beépített</label>`
    +`<label><input type="checkbox" id="pvLCuts" ${PV.layers.cuts?'checked':''}> Horony/véset</label>`
    +`<label><input type="checkbox" id="pvLLbl" ${PV.layers.cutLabels?'checked':''}> Feliratok</label>`
    +`<label><input type="checkbox" id="pvLCtx" ${PV.layers.context?'checked':''}> Sávon kívüli (halvány)</label>`
    +`<label><input type="checkbox" id="pvLWall" ${PV.layers.walls?'checked':''}> Falak</label>`
    +`<label><input type="checkbox" id="pvLNotes" ${PV.layers.notes?'checked':''}> Jegyzetek</label>`
    +`<label title="Csak ezen a síkon rejti el a jegyzeteket"><input type="checkbox" id="pvNoteSurf" ${noteSurfaceHidden(d.key)?'':'checked'}> ezen a síkon</label></div>`
    +(PV.drawPi!=null?`<div class="mrow" style="gap:8px;font-size:11px;background:#eef6ff;border:1px solid #2f6fb0;border-radius:5px;padding:3px 6px"><b style="color:#1c4f86">✏ Pálya rajzolása</b><span style="color:#40628a">kattints a következő pontra — a csomópontok ${Math.round(d.band.ref)} mm magasságba kerülnek</span><button id="pvDrawEnd" style="font-size:11px">✔ Kész (Enter)</button></div>`:'')
    +(PV.warp?`<div class="mrow" style="gap:8px;font-size:11px;background:#fff4ec;border:1px solid #e8641c;border-radius:5px;padding:3px 6px"><b style="color:#c0530f">✥ Warp mód</b><span style="color:#a05a3a">a pálya csomópontjai együtt nyúlnak</span><button id="pvWarpOff" style="font-size:11px">Kilépés</button></div>`:'')
    +`<div class="mrow" style="font-size:11px;color:#888">Húzd a készüléket / csomópontot / jegyzetet; a pálya vonala = egész szakasz; Alt+klikk = warp. Jobb klikk: készüléken = doboz+magasság, pályán = ⌀/mélység/másolás, üres helyen = létrehozás. A ⊙ jelek ott vannak, ahol a pálya kilép ebből a síkból.</div>`
    +`<div style="display:flex;gap:8px;align-items:flex-start">`
    +`<div id="pvBox" style="flex:1;overflow:auto;max-height:${PV.full?'78vh':'56vh'};border:1px solid #eee;background:#fafafa">${out.svg}</div>`
    +edRailHTML(PV)+`</div>`
    +`<div class="mrow" style="gap:6px;font-size:11px;border-top:1px solid #eee;padding-top:4px">`
    +`<b style="color:#555">Koordináták (mm)</b><button id="pvListT" style="font-size:11px">${PV.list?'elrejt':'mutat'}</button>`
    +`<span style="color:#999">X/Y a helyiség bal-felső sarkától; a magasság a padlótól mért érték</span></div>`
    +(PV.list?`<div id="pvList" style="overflow:auto;max-height:${PV.full?'20vh':'24vh'};border:1px solid #eee">${pvListHTML(d)}</div>`:'')
    +`<div class="mbtns"><button id="pvPng">🖼 PNG</button><button id="pvPrint">🖨 Print/PDF</button>`
    +`<span style="flex:1"></span><button id="pvClose">✕ Elvetés</button><button id="pvSave" class="on">💾 Mentés</button></div>`;
  modalBg.style.display='flex';
  $('pvClose').onclick=()=>wvCloseEditor(false);
  $('pvSave').onclick=()=>wvCloseEditor(true);
  $('pvUndoB').onclick=wvUndo;$('pvRedoB').onclick=wvRedo;
  $('pvFull').onclick=()=>{PV.full=!PV.full;renderPlaneView();};
  $('pvFloor').onclick=()=>{PV.kind='floor';PV.warp=null;pvFinishPath();renderPlaneView();};
  $('pvCeil').onclick=()=>{PV.kind='ceiling';PV.warp=null;pvFinishPath();renderPlaneView();};
  $('pvDrop').onclick=()=>{PV.kind='drop';PV.warp=null;pvFinishPath();renderPlaneView();};
  $('pvTol').onchange=e=>{PV.tol=Math.max(10,+e.target.value||PLANE_TOL);renderPlaneView();};
  $('pvDims').onchange=e=>{PV.dims=e.target.checked;renderPlaneView();};
  $('pvMirror').onclick=()=>{PV.mirror=!PV.mirror;renderPlaneView();};
  ['pvLInst:installed','pvLCuts:cuts','pvLLbl:cutLabels','pvLCtx:context','pvLWall:walls','pvLNotes:notes'].forEach(k=>{
    const [id,key]=k.split(':');$(id).onchange=e=>{PV.layers[key]=e.target.checked;renderPlaneView();};});
  $('pvListT').onclick=()=>{PV.list=!PV.list;renderPlaneView();};
  if($('pvNoteSurf'))$('pvNoteSurf').onchange=()=>{wvPush();noteSurfaceToggle(d.key);renderPlaneView();draw();};
  if($('pvWarpOff'))$('pvWarpOff').onclick=()=>{PV.warp=null;renderPlaneView();};
  if($('pvDrawEnd'))$('pvDrawEnd').onclick=()=>pvFinishPath();
  $('pvPng').onclick=()=>svgToPng(out.svg,out.w,out.h,({ceiling:'mennyezet',drop:'almennyezet',floor:'padlo'}[PV.kind]||'padlo')+'_nezet.png');
  $('pvPrint').onclick=()=>printSVG(out.svg,'Sík nézet');
  if($('pvList')){const rows=pvListRows(d);
    $('pvList').querySelectorAll('.pvcell').forEach(inp=>{inp.onchange=()=>{const v=+inp.value;if(isNaN(v))return;
      pvListApply(d,rows,inp.dataset.k,inp.dataset.f,v);renderPlaneView();draw();};});
    $('pvList').querySelectorAll('.pvdel').forEach(b=>{b.onclick=()=>{pvListDelete(rows,b.dataset.k);renderPlaneView();draw();};});}

  // ---- one shared surface layer; this projection describes a top-down plane ----
  edRailBind(PV);
  const box=$('pvBox'),svgEl=box&&box.querySelector('svg');if(!svgEl)return;
  edBindSurface(PV,svgEl,{
    kind:'plane',
    local:ev=>{const rc=svgEl.getBoundingClientRect(),f=fineXY(ev.clientX,ev.clientY);
      const px=(f[0]-rc.left)/rc.width*out.w,py=(f[1]-rc.top)/rc.height*out.h;
      return {u:(out.mir?(d.bb.x1-(px-out.M)/out.sc):(d.bb.x0+(px-out.M)/out.sc)),
              v:d.bb.y0+(py-out.M)/out.sc};},
    data:()=>planeViewData(PV.room,PV.level,PV.kind,PV.tol),
    nodeUV:n=>({u:n.x,v:n.y}),
    setDev:(di,u,v)=>pvSetDevice(di,u,v),
    setNode:(pi,ni,u,v)=>pvSetNode(pi,ni,u,v),
    setNote:(i,u,v)=>pvSetNote(i,u,v),
    addNode:(u,v)=>pvAddPathNode(u,v),
    badge:false,                                    // a top view has no height to read out
    soft:el=>{const dd=planeViewData(PV.room,PV.level,PV.kind,PV.tol);PV.data=dd;
      el.innerHTML=edInner(planeViewSVG(dd,PV.dims).svg);},
    full:()=>renderPlaneView(),
    menu:(ev,u,v)=>{const dd=PV.data||planeViewData(PV.room,PV.level,PV.kind,PV.tol);
      const ghosts=PV.layers.context?(dd.ghosts||[]):[];
      const hd=edHitDevice({devs:(dd.devs||[]).concat(ghosts)},u,v);if(hd){wvDeviceMenu(ev,hd.di);return;}
      const hs=edHitSection(dd,u,v);if(hs){wvSectionMenu(ev,hs);return;}
      PV.railU=u;PV.railH=v;PV.sel=null;pvCreateMenu(ev,u,v);}});}

function openRoomUnfold(room,level){const ws=roomWalls(room.poly,level);
  if(!ws.length){alert('Nem találtam határoló falat ehhez a helyiséghez.');return;}
  let far=false,dims=true;
  function build(){const parts=ws.map(w=>{const d=wallElevationData(w.r,level);const o=wallElevationSVG(d,far,dims);return {side:w.side,o};});
    const W=Math.max(...parts.map(p=>p.o.w))+20,GAPY=34;let H=24,y=24,body='';
    parts.forEach(p=>{H+=p.o.h+GAPY;});
    parts.forEach(p=>{const inner=p.o.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
      body+=`<text x="10" y="${y-6}" font-size="12" font-weight="700" fill="#111">${(room.name||'Helyiség')} — ${p.side} fal (${Math.round(p.o.len)}×${Math.round(p.o.H)} mm)</text>`
        +`<g transform="translate(10,${y})">${inner}</g>`;y+=p.o.h+GAPY;});
    return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI,Arial"><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`,w:W,h:H};}
  function show(){const out=build();modalEl.style.maxWidth='96vw';
    modalEl.innerHTML=`<h4>Helyiség kiterítve — ${esc(room.name||'Helyiség')} (${ws.length} fal)</h4>`
      +`<div class="mrow"><label><input type="checkbox" id="ufFar" ${far?'checked':''}> Túloldal is</label><label><input type="checkbox" id="ufDim" ${dims?'checked':''}> Méretlánc</label></div>`
      +`<div style="overflow:auto;max-height:60vh;border:1px solid #eee;background:#fafafa">${out.svg}</div>`
      +`<div class="mbtns"><button id="ufPng">🖼 PNG</button><button id="ufPrint">🖨 Print/PDF</button><button id="ufClose">Bezár</button></div>`;
    modalBg.style.display='flex';
    $('ufClose').onclick=closeModal;$('ufFar').onchange=e=>{far=e.target.checked;show();};$('ufDim').onchange=e=>{dims=e.target.checked;show();};
    $('ufPng').onclick=()=>svgToPng(out.svg,out.w,out.h,'helyiseg_kiteritve.png');
    $('ufPrint').onclick=()=>printSVG(out.svg,'Helyiség kiterítve');}
  show();}


