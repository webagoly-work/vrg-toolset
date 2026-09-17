// ==========================================================================
// 11-boot.js — startup
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// go ////////////////////
function resetView(){state.zoom=.5;state.panX=(1-.5)*W/2;state.panY=(1-.5)*Hh/2;setTransform();}
// ---------------- camera memory: 2D and 3D each remember their own view ----------------
function camSnap(){return {pitch:state.pitch,rot:state.rot,zoom:state.zoom,panX:state.panX,panY:state.panY};}
function camApply(c){state.rot=c.rot;state.zoom=c.zoom;state.panX=c.panX;state.panY=c.panY;
  $('rot').value=state.rot;$('rotVal').textContent=state.rot+'°';
  document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('on',+b.dataset.deg===state.rot));
  setTransform();}
function switchBuilding(o){loadBuilding(o);state.levels={basement:true,ground:true,upper:true};
  $('lvBase').checked=$('lvGround').checked=$('lvUpper').checked=true;resetView();setRot(state.rot);}
$('bHouse').onclick=()=>switchBuilding(HOUSE);
$('bGarage').onclick=()=>switchBuilding(GARAGE);
$('bCreateRoom').onclick=()=>openCreateRoom();
$('saveLayout').onclick=()=>download((B.name||'layout').replace(/\s+/g,'_')+'.json',JSON.stringify(B,null,2));
$('loadRef').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const o=JSON.parse(r.result);addRefBuilding(o.building||o);}catch(err){alert('Bad layout file');}};r.readAsText(f);e.target.value='';};
$('loadLayout').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{switchBuilding(JSON.parse(r.result));}catch(err){alert('Bad layout file');}};r.readAsText(f);};

// ---- object library UI ----
function renderObjList(){const el=$('objList');if(!el)return;const q=(($('objSearch')||{}).value||'').toLowerCase();
  let h='';OBJLIB.forEach(g=>{const its=g.items.filter(it=>!q||it.n.toLowerCase().includes(q)||g.cat.toLowerCase().includes(q));
    if(!its.length)return;h+=`<div style="padding:3px 7px;background:#f3f0e9;font-size:10.5px;font-weight:700;color:#8a8478;position:sticky;top:0">${g.cat}</div>`;
    its.forEach(it=>{const on=objPick&&objPick.n===it.n;
      h+=`<div class="objitem" data-on="${esc(it.n)}" style="padding:4px 8px;font-size:12px;cursor:pointer;border-bottom:1px solid #f4f1ea;${on?'background:#2c2c2c;color:#fff':''}">${esc(it.n)}`
       +(it.custom?'':`<span style="float:right;opacity:.6;font-size:10.5px">${it.w}×${it.d}</span>`)+`</div>`;});});
  el.innerHTML=h||'<div style="padding:8px;color:#999;font-size:12px">nincs találat</div>';
  el.querySelectorAll('.objitem').forEach(d=>d.onclick=()=>{
    for(const g of OBJLIB)for(const it of g.items)if(it.n===d.dataset.on)objPick=it;
    renderObjList();setMode('object');});}

// ================= UNIVERSAL MANIPULATOR (KSP-style) =================
// A "piece" is any selectable element. pieceRef(h) -> live object; the accessors
// below read/write centre (cx,cy), footprint (w,d), rotation (ang), base z and
// height (ht) uniformly across walls / floors / openings / stairs / roofs /
// objects / devices, so one gizmo can grab-offset-rotate-resize them all.
function clonePiece(h){if(!h)return null;
  if(h.t==='wall'){const a=WALLS[h.level],c=JSON.parse(JSON.stringify(a[a.indexOf(h.ref)]));a.push(c);SNAP[h.level]=centerlines(a);return {t:'wall',level:h.level,ref:c};}
  const arr=data[h.t];if(!arr)return null;const c=JSON.parse(JSON.stringify(arr[h.i]));arr.push(c);return {t:h.t,i:arr.length-1};}
function pieceRef(h){if(!h)return null;
  if(h.t==='wall')return h.ref;
  const arr=data[h.t];return arr?arr[h.i]:null;}
function pieceLevel(h){const o=pieceRef(h);if(!o)return state.active;
  if(h.t==='wall')return h.level; if(h.t==='measures')return o[0].level||state.active; return o.level||state.active;}
// centre in plan coords
function pGetC(h){const o=pieceRef(h);if(!o)return[0,0];
  if(h.t==='wall'||h.t==='roofs')return[(o.x0+o.x1)/2,(o.y0+o.y1)/2];
  if(h.t==='floors'){let cx=0,cy=0;o.poly.forEach(p=>{cx+=p[0];cy+=p[1];});return[cx/o.poly.length,cy/o.poly.length];}
  if(h.t==='measures')return[(o[0].x+o[1].x)/2,(o[0].y+o[1].y)/2];
  return[o.x,o.y];}
function pSetC(h,nx,ny){const o=pieceRef(h);if(!o)return;const [cx,cy]=pGetC(h),dx=nx-cx,dy=ny-cy;
  if(h.t==='wall'||h.t==='roofs'){o.x0+=dx;o.x1+=dx;o.y0+=dy;o.y1+=dy;if(h.t==='wall')SNAP[h.level]=centerlines(WALLS[h.level]);}
  else if(h.t==='floors'){o.poly=o.poly.map(p=>[p[0]+dx,p[1]+dy]);}
  else if(h.t==='measures'){o[0].x+=dx;o[0].y+=dy;o[1].x+=dx;o[1].y+=dy;}
  else{o.x=nx;o.y=ny;}}
// footprint size {w,d} and setter
function pGetWD(h){const o=pieceRef(h);if(!o)return[0,0];
  if(h.t==='wall'||h.t==='roofs')return[Math.abs(o.x1-o.x0),Math.abs(o.y1-o.y0)];
  if(h.t==='floors'){const b=polyBBox(o.poly);return[b.x1-b.x0,b.y1-b.y0];}
  if(h.t==='objects')return[o.w||600,o.d||600];
  if(h.t==='openings')return[o.w||(o.type==='window'?WIN_W:DOOR_W),o.h||(o.type==='window'?WIN_H:DOOR_H)];
  if(h.t==='measures')return[Math.hypot(o[1].x-o[0].x,o[1].y-o[0].y),40];
  return[300,300];}
function pSetWD(h,nw,nd){const o=pieceRef(h);if(!o)return;const [cx,cy]=pGetC(h);
  nw=Math.max(50,nw);nd=Math.max(50,nd);
  if(h.t==='wall'||h.t==='roofs'){o.x0=cx-nw/2;o.x1=cx+nw/2;o.y0=cy-nd/2;o.y1=cy+nd/2;if(h.t==='wall')SNAP[h.level]=centerlines(WALLS[h.level]);}
  else if(h.t==='floors'){o.poly=[[cx-nw/2,cy-nd/2],[cx+nw/2,cy-nd/2],[cx+nw/2,cy+nd/2],[cx-nw/2,cy+nd/2]];}
  else if(h.t==='objects'){o.w=nw;o.d=nd;}
  else if(h.t==='openings'){o.w=nw;o.h=nd;}}
function pGetAng(h){const o=pieceRef(h);if(!o)return 0;
  if(h.t==='objects')return o.ang||0; if(h.t==='openings'||h.t==='stairs')return o.ang||0; return 0;}
function pRot(h,dArad){const o=pieceRef(h);if(!o)return;
  if(h.t==='measures'){const cx=(o[0].x+o[1].x)/2,cy=(o[0].y+o[1].y)/2,cs=Math.cos(dArad),sn=Math.sin(dArad);
    [o[0],o[1]].forEach(p=>{const rx=p.x-cx,ry=p.y-cy;p.x=cx+rx*cs-ry*sn;p.y=cy+rx*sn+ry*cs;});return;}
  if(h.t==='objects'||h.t==='openings')o.ang=(o.ang||0)+dArad;
  else if(h.t==='roofs')o.ang=((o.ang||0)+90)%180; // roofs only ridge-flip
  else if(h.t==='wall'||h.t==='floors'){ // rotate footprint 90° about centre (swap w/d)
    const [w,d]=pGetWD(h);pSetWD(h,d,w);}
}
function pGetZ(h){const o=pieceRef(h);if(!o)return 0;
  if(h.t==='objects')return o.z||0; if(h.t==='devices')return o.h||0; if(h.t==='roofs')return o.eave||0;
  if(h.t==='wall')return o.z0||0;                      // wall base above the floor (pengefal / lebegő fal)
  if(h.t==='floors')return o.z||0;                     // raised slab / podium / step
  if(h.t==='openings')return o.sill||0;                // window sill or door threshold
  return 0;}
function pSetZ(h,z){const o=pieceRef(h);if(!o)return;z=Math.max(0,Math.round(z));
  if(h.t==='objects')o.z=z; else if(h.t==='devices')o.h=z;
  else if(h.t==='roofs'){const d=z-(o.eave||0);o.eave=z;o.ridge=(o.ridge||0)+d;}
  else if(h.t==='wall'){if(z>0)o.z0=z;else delete o.z0;SNAP[pieceLevel(h)]=centerlines(WALLS[pieceLevel(h)]);}
  else if(h.t==='floors'){if(z>0)o.z=z;else delete o.z;}
  else if(h.t==='openings'){if(o.type==='stairs')return;if(z>0)o.sill=z;else delete o.sill;}}
// what the purple handle means for this piece — shown live while dragging
function pZLabel(h){return {objects:'Magasság a padlótól',devices:'Szerelési magasság',roofs:'Ereszmagasság',
  wall:'Fal indulása a padlótól',floors:'Padlósík emelése',openings:'Parapet / küszöb'}[h&&h.t]||'Magasság';}
function pLabel(h){const o=pieceRef(h);if(!o)return'';const [w,d]=pGetWD(h);
  if(h.t==='measures'){return 'Méret · '+(Math.hypot(o[1].x-o[0].x,o[1].y-o[0].y)/1000).toFixed(2)+' m';}
  const nm={wall:'Fal',floors:'Padló',openings:(o.type==='window'?'Ablak':o.type==='door'?'Ajtó':'Nyílás'),stairs:'Lépcső',roofs:'Tető',objects:o.name||'Objektum',devices:DEV[o.type]||'Eszköz'}[h.t]||h.t;
  return `${nm} · ${Math.round(w)}×${Math.round(d)}`;}
function pResizable(h){return h && (h.t==='wall'||h.t==='floors'||h.t==='objects'||h.t==='openings'||h.t==='roofs');}
function pLiftable(h){return h && (h.t==='objects'||h.t==='devices'||h.t==='roofs'
  ||h.t==='wall'||h.t==='floors'||(h.t==='openings'&&pieceRef(h)&&pieceRef(h).type!=='stairs'));}

// ---- gizmo rendering: hovering arrows anchored to the piece centre ----
function gizmoSvgAt(C,count){ // simplified move+rotate gizmo at base-coord C for a group
  const ex=[C[0]+1,C[1]],nrm=v=>{const m=Math.hypot(v[0],v[1])||1;return[v[0]/m,v[1]/m];};
  // screen axes: derive plan +X/+Y directions at this point
  const pc=baseToPlan(C[0],C[1],dz(state.active,0));
  const bx=planToBase(pc[0]+1000,pc[1],dz(state.active,0)),by=planToBase(pc[0],pc[1]+1000,dz(state.active,0));
  const ux=nrm([bx[0]-C[0],bx[1]-C[1]]),uy=nrm([by[0]-C[0],by[1]-C[1]]);
  const L=state.mobile?60:48,head=state.mobile?12:8;
  function arrow(dir,col){const ex2=C[0]+dir[0]*L,ey2=C[1]+dir[1]*L,perp=[-dir[1],dir[0]];
    return `<g class="giz" data-ax="move" style="cursor:move"><line x1="${C[0]}" y1="${C[1]}" x2="${ex2}" y2="${ey2}" stroke="${col}" stroke-width="3"/>`
      +`<polygon points="${ex2+dir[0]*head},${ey2+dir[1]*head} ${ex2-perp[0]*head*0.6},${ey2-perp[1]*head*0.6} ${ex2+perp[0]*head*0.6},${ey2+perp[1]*head*0.6}" fill="${col}"/></g>`;}
  let g=`<g class="gizmo">`;
  g+=arrow(ux,'#e2483a')+arrow([-ux[0],-ux[1]],'#e2483a')+arrow(uy,'#3fae55')+arrow([-uy[0],-uy[1]],'#3fae55');
  g+=`<circle class="giz" data-ax="rot" cx="${C[0]}" cy="${C[1]-62}" r="7" fill="#fff" stroke="#2f6fb0" stroke-width="2.4" style="cursor:grab"/>`
    +`<path d="M ${C[0]-7} ${C[1]-62} A 7 7 0 1 1 ${C[0]} ${C[1]-55}" fill="none" stroke="#2f6fb0" stroke-width="2"/>`;
  g+=`<circle cx="${C[0]}" cy="${C[1]}" r="4" fill="#2f6fb0"/></g>`;
  g+=`<text x="${C[0]}" y="${C[1]+46}" font-size="10.5" text-anchor="middle" fill="#111" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="3">${count} elem együtt</text>`;
  return g;}
function gizmoSvg(h){if(!h)return'';const o=pieceRef(h);if(!o)return'';
  const [cx,cy]=pGetC(h),z=dz(pieceLevel(h),pGetZ(h)+ (h.t==='objects'?(o.ht||0)/2:0));
  const C=planToBase(cx,cy,z);
  // screen-space directions of plan +X and +Y (so arrows follow camera)
  const ex=planToBase(cx+1000,cy,z),ey=planToBase(cx,cy+1000,z);
  const ux=[ex[0]-C[0],ex[1]-C[1]],uy=[ey[0]-C[0],ey[1]-C[1]];
  const nrm=v=>{const m=Math.hypot(v[0],v[1])||1;return[v[0]/m,v[1]/m];};
  const nx=nrm(ux),ny=nrm(uy);const L=state.mobile?60:46,head=state.mobile?12:8;
  function arrow(dir,col,axis,sign){const ex2=C[0]+dir[0]*L,ey2=C[1]+dir[1]*L;
    const perp=[-dir[1],dir[0]];
    return `<g class="giz" data-ax="${axis}" data-sg="${sign}" style="cursor:pointer">`
      +`<line x1="${C[0]}" y1="${C[1]}" x2="${ex2}" y2="${ey2}" stroke="${col}" stroke-width="3"/>`
      +`<polygon points="${ex2+dir[0]*head},${ey2+dir[1]*head} ${ex2-perp[0]*head*0.6+dir[0]*0},${ey2-perp[1]*head*0.6} ${ex2+perp[0]*head*0.6},${ey2+perp[1]*head*0.6}" fill="${col}"/></g>`;}
  let g=`<g class="gizmo">`;
  g+=arrow(nx,'#e2483a','x',1)+arrow([-nx[0],-nx[1]],'#e2483a','x',-1);
  g+=arrow(ny,'#3fae55','y',1)+arrow([-ny[0],-ny[1]],'#3fae55','y',-1);
  // rotate ring handle (screen up)
  g+=`<circle class="giz" data-ax="rot" cx="${C[0]}" cy="${C[1]-62}" r="7" fill="#fff" stroke="#2f6fb0" stroke-width="2.4" style="cursor:grab"/>`
    +`<path d="M ${C[0]-7} ${C[1]-62} A 7 7 0 1 1 ${C[0]} ${C[1]-55}" fill="none" stroke="#2f6fb0" stroke-width="2"/>`;
  // lift handle (only for liftable)
  if(pLiftable(h)){g+=`<rect class="giz" data-ax="z" x="${C[0]-6}" y="${C[1]-92}" width="12" height="12" rx="2" fill="#fff" stroke="#8e44ad" stroke-width="2.2" style="cursor:ns-resize"/><line x1="${C[0]}" y1="${C[1]-62}" x2="${C[0]}" y2="${C[1]-80}" stroke="#8e44ad" stroke-width="1.5" stroke-dasharray="2 2"/>`;
    g+=`<text x="${C[0]+11}" y="${C[1]-83}" font-size="9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">${Math.round(pGetZ(h))} mm</text>`
      +`<text x="${C[0]+11}" y="${C[1]-83}" font-size="9" fill="#8e44ad">${Math.round(pGetZ(h))} mm</text>`;}
  // resize handles at footprint corners (only resizable)
  if(pResizable(h)){const [w,d]=pGetWD(h),hw=w/2,hd=d/2;
    // edge-midpoint handles: the two on the X edges change WIDTH only, the two on the Y edges change DEPTH only
    [[-1,0,'w'],[1,0,'w'],[0,-1,'d'],[0,1,'d']].forEach(c=>{const b=planToBase(cx+c[0]*hw,cy+c[1]*hd,z);
      const col=c[2]==='w'?'#e2483a':'#3fae55';
      g+=`<rect class="giz" data-ax="rs" data-rd="${c[2]}" data-cx="${c[0]}" data-cy="${c[1]}" x="${b[0]-5}" y="${b[1]-5}" width="10" height="10" rx="2" fill="#fff" stroke="${col}" stroke-width="2" style="cursor:${c[2]==='w'?'ew':'ns'}-resize"/>`;});}
  // centre dot
  g+=`<circle cx="${C[0]}" cy="${C[1]}" r="3.5" fill="#2f6fb0"/></g>`;
  // label
  g+=`<text x="${C[0]}" y="${C[1]+44}" font-size="10.5" text-anchor="middle" fill="#111" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(pLabel(h))}</text>`;
  return g;}

function objSnap(e){const lvl=state.active;const [bx,by]=clientToBase(e);
  const walls=WALLS[lvl]||[];
  // WALL SNAP: if enabled and cursor is near a wall, mount the object against the wall face
  if(state.objWallSnap && walls.length && !isFreeHeight()){
    const zz=dz(lvl,drawHmm(lvl));
    let best=null;walls.forEach(r=>{const dd=wallDist(r,bx,by,zz);if(!best||dd.d<best.d)best=dd;});
    // only snap when actually close to the wall (fixed screen distance), else fall through to floor
    const snapPx=42; // px on screen
    if(best && best.d < snapPx/state.zoom){
      const wi=best.wi,t=Math.max(0,Math.min(1,best.t));
      const cxp=wi.seg[0][0]+t*(wi.seg[1][0]-wi.seg[0][0]), cyp=wi.seg[0][1]+t*(wi.seg[1][1]-wi.seg[0][1]);
      const dep=(objPick&&objPick.d)?objPick.d:600;   // object depth
      // push the object off the wall centreline by half wall thickness + half its own depth, on the chosen side
      const off=(state.side?1:-1)*(wi.thick/2 + dep/2);
      const ang=wi.horiz?0:Math.PI/2;                 // align object to the wall
      return {level:lvl,x:cxp+wi.perp[0]*off,y:cyp+wi.perp[1]*off,z:drawHmm(lvl),ang,wall:true,snap:'fal'};
    }
  }
  // FLOOR: project to floor plane, grid-snap
  let p=baseToPlan(bx,by,dz(lvl,0));let x=p[0],y=p[1];
  if(state.grid){x=Math.round(x/state.gridSize)*state.gridSize;y=Math.round(y/state.gridSize)*state.gridSize;}
  return {level:lvl,x,y,z:0,ang:null,wall:false,snap:state.grid?'grid':'szabad'};}
function placeObject(e){const p=objSnap(e),it=objPick||{n:'Objektum',w:600,d:600,h:600};
  const ang=(p.ang!=null?p.ang:0)+(state.objAng||0);
  if(it.custom){objDimModal('Egyedi objektum',{n:'Egyedi',w:1000,d:600,ht:800,z:p.z||0},v=>{pushUndo();
      const a2=(p.ang!=null?p.ang:0)+(state.objAng||0);
      data.objects.push({level:p.level,x:p.x,y:p.y,z:v.z,w:v.w,d:v.d,ht:v.ht,ang:a2,name:v.n,layer:curLayer(),onWall:p.wall||false});draw();});return;}
  pushUndo();data.objects.push({level:p.level,x:p.x,y:p.y,z:p.z||0,w:it.w,d:it.d,ht:it.h,ang,name:it.n,layer:curLayer(),onWall:p.wall||false});draw();}
function objDimModal(title,cur,ok){openModal(title,
   `<div class="mrow">Név <input id="odN" value="${esc(cur.n||'')}" style="width:170px"></div>`
  +`<div class="mrow">Szélesség <input id="odW" type="number" value="${cur.w}" style="width:80px"> mm</div>`
  +`<div class="mrow">Mélység <input id="odD" type="number" value="${cur.d}" style="width:80px"> mm</div>`
  +`<div class="mrow">Magasság <input id="odH" type="number" value="${cur.ht}" style="width:80px"> mm</div>`
  +`<div class="mrow">Padlótól <input id="odZ" type="number" value="${cur.z||0}" style="width:80px"> mm</div>`,
  ()=>ok({n:$('odN').value,w:+$('odW').value||600,d:+$('odD').value||600,ht:+$('odH').value||600,z:+$('odZ').value||0}));}
// ---- layers UI ----
function renderLayers(){const el=$('layerList');if(!el)return;const cats=['path','device','cable','wall','build','object'];
  el.innerHTML=layers.map(L=>{const cs=cats.map(c=>`<button data-lc="${L.id}:${c}" class="lcat ${L.cats[c]!==false?'on':''}" title="${c}">${c[0].toUpperCase()}</button>`).join('');
    return `<div class="lblock ${L.id===state.activeLayer?'lactive':''}"><div class="lrow"><input type="radio" name="alayer" ${L.id===state.activeLayer?'checked':''} data-la="${L.id}" title="aktív">`
     +`<button data-lv="${L.id}" title="show/hide">${L.visible?'👁':'🚫'}</button>`
     +`<input class="lname" data-ln="${L.id}" value="${L.name.replace(/"/g,'')}">`
     +(L.id!=='L0'?`<button data-lx="${L.id}" title="törlés">✕</button>`:'')+`</div>`
     +`<div class="lcats">${cs}</div></div>`;}).join('');
  el.querySelectorAll('[data-la]').forEach(r=>r.onchange=()=>{state.activeLayer=r.dataset.la;});
  el.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{const L=layerById(b.dataset.lv);L.visible=!L.visible;renderLayers();draw();});
  el.querySelectorAll('[data-ln]').forEach(i=>i.onchange=()=>{layerById(i.dataset.ln).name=i.value;});
  el.querySelectorAll('[data-lc]').forEach(b=>b.onclick=()=>{const p=b.dataset.lc.split(':'),L=layerById(p[0]);L.cats[p[1]]=(L.cats[p[1]]===false);renderLayers();draw();});
  el.querySelectorAll('[data-lx]').forEach(b=>b.onclick=()=>{const id=b.dataset.lx;layers=layers.filter(l=>l.id!==id);if(state.activeLayer===id)state.activeLayer='L0';renderLayers();draw();});}
$('addLayer').onclick=()=>{const id='L'+Date.now().toString(36);layers.push({id,name:'Réteg '+(layers.length+1),visible:true,cats:{path:true,device:true,cable:true,wall:true,build:true,object:true}});state.activeLayer=id;renderLayers();};
// ---- project library (named save slots) ----
const PROJ_KEY='villanyterv_projects_v1';   // {id:{name,ts,data}}
const CURRENT_KEY='villanyterv_current_v1';  // id of last-open project (for autosave)
function loadProjIndex(){try{return JSON.parse(localStorage.getItem(PROJ_KEY))||{};}catch(_){return {};}}
function saveProjIndex(ix){try{localStorage.setItem(PROJ_KEY,JSON.stringify(ix));}catch(e){alert('Nem sikerült menteni (tár megtelt?).');}}
let currentProjId=null;
function projSnapshot(name){const o=sessionObj();return {name:name||(B.name||'Terv'),ts:Date.now(),data:o};}
function saveProject(name,id){const ix=loadProjIndex();id=id||('p'+Date.now().toString(36));
  const snap=projSnapshot(name);ix[id]=snap;saveProjIndex(ix);currentProjId=id;
  try{localStorage.setItem(CURRENT_KEY,id);}catch(_){}
  renderProjects();$('hud').textContent='Mentve: '+snap.name;return id;}
function applyProjectData(o){ // o = a sessionObj payload
  Object.assign(state,o.state||{});Object.assign(LH,o.LH||{});Object.assign(DROPC,o.DROPC||{});if(typeof o.GAP==='number')GAP=o.GAP;
  if(o.guides&&Array.isArray(o.guides)){GUIDES=o.guides;}else if(o.guideOn){GUIDES.forEach(g=>{if(o.guideOn[g.k]!=null)g.vis=!!o.guideOn[g.k];});(o.customG||[]).forEach(v=>GUIDES.push({k:'g'+Math.random().toString(36).slice(2),mm:v,l:'Egyéni '+v,c:'#7a5cc0',vis:true,jump:true}));}if(typeof renderGuides==='function')renderGuides();if(typeof rebuildDrawH==='function')rebuildDrawH();
  layers=o.layers||[{id:'L0',name:'Alap',visible:true,cats:{path:true,device:true,cable:true,wall:true,build:true,object:true}}];
  if(o.panelLoc)panelLoc=o.panelLoc;refB=o.refB||[];
  loadBuilding(o.building||blankBuilding(),true);
  UKEYS.forEach(k=>data[k]=(o.data&&o.data[k])?JSON.parse(JSON.stringify(o.data[k])):[]);
  data.noteHide=(o.data&&o.data.noteHide)?JSON.parse(JSON.stringify(o.data.noteHide)):{};
  data.seq=(o.data&&+o.data.seq)||0;data.v=(o.data&&+o.data.v)||0;
  migrate(data);                                        // an older file still opens
  selected=null;undo.length=0;redo.length=0;
  draft=null;pathDraft=null;measureDraft=null;cursor=null;dragItem=null;objGhost=null;buildGhost=null;
  if(typeof WV!=='undefined'&&WV){if(WV.keyFn)document.removeEventListener('keydown',WV.keyFn,true);WV=null;}
  if(typeof PV!=='undefined'&&PV){if(PV.keyFn)document.removeEventListener('keydown',PV.keyFn,true);PV=null;}
  syncUI();renderLayers();renderRefList();if(typeof renderDashboard==='function')renderDashboard();resetView();draw();}
function loadProject(id){const ix=loadProjIndex();const p=ix[id];if(!p)return;
  hardResetWorkspace();
  applyProjectData(p.data);currentProjId=id;try{localStorage.setItem(CURRENT_KEY,id);}catch(_){}
  renderProjects();$('hud').textContent='Betöltve: '+p.name;}
function deleteProject(id){const ix=loadProjIndex();if(!ix[id])return;
  if(!confirm('Törlöd ezt a tervet: "'+ix[id].name+'"? Nem visszavonható.'))return;
  delete ix[id];saveProjIndex(ix);if(currentProjId===id)currentProjId=null;renderProjects();}
function renameProject(id){const ix=loadProjIndex();if(!ix[id])return;
  const nm=prompt('Terv neve:',ix[id].name);if(nm==null)return;ix[id].name=nm.trim()||ix[id].name;saveProjIndex(ix);
  if(currentProjId===id)B.name=ix[id].name;renderProjects();draw();}
// Everything that can hold a fragment of the previous project. Anything added later that survives
// a project switch MUST be cleared here — that is how old paths kept turning up in the wall view.
function hardResetWorkspace(){
  if(typeof WV!=='undefined'&&WV){if(WV.keyFn)document.removeEventListener('keydown',WV.keyFn,true);WV=null;}
  if(typeof PV!=='undefined'&&PV){if(PV.keyFn)document.removeEventListener('keydown',PV.keyFn,true);PV=null;}
  try{closeModal();}catch(_){}
  UKEYS.forEach(k=>{data[k].length=0;});                       // in place: other code holds references
  data.noteHide={};
  for(const l of ORD){WALLS[l]=[];SLAB[l]=null;GHOST[l]=null;ROOMSB[l]=[];ROOFS[l]=[];SNAP[l]=centerlines([]);}
  DROPC.basement=0;DROPC.ground=0;DROPC.upper=0;
  undo.length=0;redo.length=0;                                 // no stepping back into another project
  selected=null;clearMulti&&clearMulti();
  draft=null;pathDraft=null;measureDraft=null;cursor=null;lock=null;
  wallStart=null;floorStart=null;roofStart=null;dragItem=null;objGhost=null;buildGhost=null;
  state.soloRoom=null;state.bg=null;state.warp=null;refB=[];
  try{lampHoverHide();}catch(_){}
  try{hideCtx();}catch(_){}}
function newBlankProject(){
  hardResetWorkspace();
  applyProjectData({building:blankBuilding(),state:{},data:{}});
  hardResetWorkspace();                                        // applyProjectData reloads a building; clear again
  applyProjectData({building:blankBuilding(),state:{},data:{}});
  currentProjId=null;
  try{localStorage.removeItem(CURRENT_KEY);localStorage.removeItem(LS_KEY);}catch(_){}
  saveSession();                                               // the autosave must describe the EMPTY workspace
  state.mode='select';setMode('select');renderProjects();draw();
  $('hud').textContent='Üres munkaterület — minden réteg, pálya, jegyzet és visszavonási lépés törölve.';}
function downloadProject(id){const ix=loadProjIndex();const p=id?ix[id]:projSnapshot(B.name);
  const payload={format:'varler-planner',version:1,name:p.name,saved:new Date(p.ts||Date.now()).toISOString(),project:p.data};
  download((p.name||'terv').replace(/[^\w\-]+/g,'_')+'.vplan.json',JSON.stringify(payload,null,2));}
function importProjectFile(file){const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);
  const payload=o.project?o.project:(o.data?o:{building:o.building||o,data:o.data||{}});
  const name=o.name||(payload.building&&payload.building.name)||'Importált terv';
  const id=saveProject(name);const ix=loadProjIndex();ix[id].data=payload;saveProjIndex(ix);
  loadProject(id);}catch(err){alert('Nem olvasható terv-fájl.');}};r.readAsText(file);}
function renderProjects(){const el=$('projList');if(!el)return;const ix=loadProjIndex();
  const ids=Object.keys(ix).sort((a,b)=>(ix[b].ts||0)-(ix[a].ts||0));
  el.innerHTML=ids.length?ids.map(id=>{const p=ix[id],cur=id===currentProjId,d=new Date(p.ts||0);
    const dd=d.toLocaleDateString('hu-HU')+' '+d.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'});
    return `<div class="prow" style="display:flex;align-items:center;gap:4px;padding:5px 6px;border-bottom:1px solid #f0ece3;${cur?'background:#eef4ff':''}">`
      +`<div style="flex:1;min-width:0"><div style="font-weight:${cur?700:600};font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cur?'● ':''}${esc(p.name)}</div>`
      +`<div style="font-size:10px;color:#999">${dd}</div></div>`
      +`<button data-pl="${id}" title="Betöltés">📂</button><button data-pr="${id}" title="Átnevezés">✎</button>`
      +`<button data-pd="${id}" title="Letöltés fájlba">⬇</button><button data-px="${id}" title="Törlés">✕</button></div>`;}).join('')
    :'<div style="padding:10px;color:#999;font-size:12px">Nincs mentett terv. „💾 Mentés mint…” a kezdéshez.</div>';
  el.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>loadProject(b.dataset.pl));
  el.querySelectorAll('[data-pr]').forEach(b=>b.onclick=()=>renameProject(b.dataset.pr));
  el.querySelectorAll('[data-pd]').forEach(b=>b.onclick=()=>downloadProject(b.dataset.pd));
  el.querySelectorAll('[data-px]').forEach(b=>b.onclick=()=>deleteProject(b.dataset.px));}
// ---- autosave (localStorage) ----
const LS_KEY='villanyterv_autosave_v1';let saveTimer=null;
function sessionObj(){ensureIds(data);data.v=SCHEMA_VERSION;
  for(const l of ORD){B.walls[l]=(WALLS[l]||[]).map(rectArr);
  B.rooms=B.rooms||{};B.rooms[l]=ROOMSB[l]||[];}   // room-sheet edits on building rooms persist too
  return {v:1,state,LH,DROPC,GAP,guides:GUIDES,data,building:B,layers,panelLoc,refB};}
function saveSession(){try{if(currentProjId){const ix=loadProjIndex();if(ix[currentProjId]){ix[currentProjId].data=sessionObj();ix[currentProjId].ts=Date.now();saveProjIndex(ix);}}else{localStorage.setItem(LS_KEY,JSON.stringify(sessionObj()));}}catch(_){}}
function scheduleSave(){try{clearTimeout(saveTimer);saveTimer=setTimeout(saveSession,1200);}catch(_){}}
function restoreSession(){try{const raw=localStorage.getItem(LS_KEY);if(!raw)return false;const o=JSON.parse(raw);
  Object.assign(state,o.state||{});Object.assign(LH,o.LH||{});Object.assign(DROPC,o.DROPC||{});if(typeof o.GAP==='number')GAP=o.GAP;
  if(o.guides&&Array.isArray(o.guides)){GUIDES=o.guides;}else if(o.guideOn){GUIDES.forEach(g=>{if(o.guideOn[g.k]!=null)g.vis=!!o.guideOn[g.k];});(o.customG||[]).forEach(v=>GUIDES.push({k:'g'+Math.random().toString(36).slice(2),mm:v,l:'Egyéni '+v,c:'#7a5cc0',vis:true,jump:true}));}if(typeof renderGuides==='function')renderGuides();if(typeof rebuildDrawH==='function')rebuildDrawH();
  if(o.layers)layers=o.layers;if(o.panelLoc)panelLoc=o.panelLoc;if(o.refB)refB=o.refB;if(o.building)loadBuilding(o.building,true);
  UKEYS.forEach(k=>data[k]=(o.data&&o.data[k])||[]);
  data.noteHide=(o.data&&o.data.noteHide)||{};data.seq=(o.data&&+o.data.seq)||0;data.v=(o.data&&+o.data.v)||0;
  migrate(data);
  syncUI();renderLayers();renderRefList();if(typeof renderDashboard==='function')renderDashboard();draw();
  $('hud').textContent='Munkamenet visszaállítva.';return true;}catch(_){return false;}}
$('bNew').onclick=()=>{if(!confirm('Üres munkaterület? A nem mentett változások elvesznek.'))return;newBlankProject();};
$('pjSave').onclick=()=>{if(currentProjId){saveProject(loadProjIndex()[currentProjId].name,currentProjId);}else{const nm=prompt('Terv neve:',B.name||'Új terv');if(nm==null)return;saveProject(nm.trim()||'Új terv');}};
$('pjSaveAs').onclick=()=>{const nm=prompt('Új terv neve:',(B.name||'Terv')+' másolat');if(nm==null)return;saveProject(nm.trim()||'Terv');};
$('pjNew').onclick=()=>{if(!confirm('Üres munkaterület? A nem mentett változások elvesznek.'))return;newBlankProject();};
$('pjExport').onclick=()=>downloadProject(currentProjId);
$('pjImport').onchange=e=>{const f=e.target.files[0];if(f)importProjectFile(f);e.target.value='';};
// ---- mobile mode wiring ----
function setMobile(on){state.mobile=on;document.body.classList.toggle('mobile',on);
  const b=$('mobileBtn');if(b)b.classList.toggle('on',on);
  if(!on)document.body.classList.remove('sheet-open');
  // widen touch targets on the gizmo etc. handled in CSS; force a redraw + relayout
  scheduleSave&&scheduleSave();draw();}
$('mobileBtn').onclick=()=>{setMobile(!state.mobile);try{localStorage.setItem('villanyterv_mobile',state.mobile?'1':'0');}catch(_){}};
function setLockTouch(on){state.lockTouch=on;const b=$('lockBtn');if(b){b.classList.toggle('on',on);b.textContent=on?'🔒 Zárolva':'🔓 Zár';}
  if(on){selected=null;clearMulti();hideCtx();$('hud').textContent='Építmény zárolva — húzással mozgatható, jobb gombbal forgatható; kijelölés/rajzolás letiltva.';}
  else $('hud').textContent='Építmény feloldva.';draw();}
if($('lockBtn'))$('lockBtn').onclick=()=>{setLockTouch(!state.lockTouch);try{localStorage.setItem('villanyterv_lock',state.lockTouch?'1':'0');}catch(_){}};
// panel bottom-sheet handle
$('mobileHandle').onclick=()=>{const sheetOpen=document.body.classList.toggle('sheet-open');
  document.querySelectorAll('.side').forEach(sd=>sd.classList.toggle('open',sheetOpen));
  $('mobileHandle').textContent=sheetOpen?'▼ Bezár':'▲ Panelek';};
$('mbTools').onclick=()=>$('mobileHandle').click();
// control-bar actions
$('mbUndo').onclick=()=>$('bUndo').click();
$('mbRedo').onclick=()=>$('bRedo').click();
$('mbDel').onclick=()=>{if(selected){pushUndo();removeHit(selected);selected=null;draw();}};
$('mbTop').onclick=()=>$('view3d').click();
(function bindPad(){const pad=$('mbPad');if(!pad)return;let hold=null;
  const act=n=>{if(n==='rotL'){recentrePivot();setRot(state.rot-15);}
    else if(n==='rotR'){recentrePivot();setRot(state.rot+15);}
    else if(n==='up')setPitch(state.pitch+6);else if(n==='down')setPitch(state.pitch-6);
    else if(n==='zin')zoomBy(1.15);else if(n==='zout')zoomBy(1/1.15);};
  pad.querySelectorAll('button').forEach(btn=>{
    const n=btn.dataset.nudge;
    btn.addEventListener('touchstart',e=>{e.preventDefault();act(n);hold=setInterval(()=>act(n),140);},{passive:false});
    btn.addEventListener('mousedown',e=>{act(n);hold=setInterval(()=>act(n),140);});
    const stop=()=>{clearInterval(hold);hold=null;};
    ['touchend','touchcancel','mouseup','mouseleave'].forEach(ev=>btn.addEventListener(ev,stop));});
})();
// auto-enable mobile on small touch screens (first load only)
(function autoMobile(){try{const forced=localStorage.getItem('villanyterv_mobile');
  if(forced==='1'){setMobile(true);return;}if(forced==='0')return;
  const touch=('ontouchstart'in window)||navigator.maxTouchPoints>0;
  if(touch&&Math.min(screen.width,screen.height)<820){setMobile(true);}
}catch(_){}})();
(function restoreLock(){try{if(localStorage.getItem('villanyterv_lock')==='1')setLockTouch(true);}catch(_){}})();
window.__proj={save:saveProject,load:loadProject,list:loadProjIndex,del:deleteProject,blank:newBlankProject,importFile:importProjectFile,snap:projSnapshot};

window.__H=HOUSE;window.__G=GARAGE;window.__data=data;window.__state=state;window.__getWalls=()=>WALLS;window.__setSel=(h)=>{selected=h;draw();};window.__getSel=()=>selected;window.__panels=()=>PANELS;window.__panelLoc=()=>panelLoc;window.__wallStart=()=>wallStart;window.__objGhost=()=>objGhost;window.__cursor=()=>cursor;window.__cursorSnap=()=>cursor&&cursor.snap;window.__fmtSrc=()=>fmtSource;window.__selCount=()=>selList().length;window.__selMulti=()=>selMulti.map(h=>h.t+(h.i!==undefined?h.i:""));window.__sel=()=>selected;window.__addMulti=(h)=>addMulti(h);window.__centroid=()=>groupCentroid(selList());window.__rotateGroup=(l,a,p)=>rotateGroup(l,a,p);window.__selListArr=()=>selList();window.__clearMulti=()=>{clearMulti();selected=null;};window.hitTestAt=(x,y)=>hitTest({clientX:x,clientY:y});window.__touchG=()=>touchG;window.__WV=()=>WV;window.__PV=()=>PV;window.__setCursor=c=>{cursor=c;};window.__undoLen=()=>undo.length;window.__redoLen=()=>redo.length;window.VERSION=VERSION;window.drawNormalGeom=drawNormalGeom;window.PLACE_ITEMS=PLACE_ITEMS;window.WALL_PRESETS=WALL_PRESETS;window.NOTEKIND=NOTEKIND;window.LAMP_MOUNT=LAMP_MOUNT;window.DROPC=DROPC;window.GUIDES_REF=()=>GUIDES;window.LAMP_FIX=LAMP_FIX;window.ROOM_ENV=ROOM_ENV;window.ROOM_USE=ROOM_USE;window.ROOM_FLOOR=ROOM_FLOOR;window.ROOM_HEAT=ROOM_HEAT;window.__ROOMSB=()=>ROOMSB;window.DOORTYPE=DOORTYPE;window.__snap=(scope)=>snap_(scope);window.__applySnap=sn=>applySnap(sn);window.DEV=DEV;window.REFPRE=REFPRE;window.DEVKIND=DEVKIND;window.BUILDNAME=BUILDNAME;window.__buildGhost=()=>buildGhost;window.__setBuildGhost=g=>{buildGhost=g;};window.__LH=()=>LH;window.__guides=()=>GUIDES;window.__setWV=(k,v)=>{WV[k]=v;};window.__selBox=()=>selBox;window.__setBox=(b)=>{selBox=b;};window.__finishBox=()=>finishSelBox();window.__objPick=()=>objPick;window.loadBuilding=loadBuilding;
function placeTools(loc){const g=$('toolsGrp'),bar=$('toolbarRow'),rs=document.querySelector('.side.r');
  if(loc==='top'){bar.appendChild(g);bar.classList.add('show');$('bToolsLoc').textContent='⧉ Tools: oldalt';}
  else{rs.appendChild(g);bar.classList.remove('show');$('bToolsLoc').textContent='⧉ Tools: fent';}
  state.toolsLoc=loc;}
$('bToolsLoc').onclick=()=>placeTools(state.toolsLoc==='top'?'side':'top');
// default: blank workspace (the example house is available in the Projects list if saved)
function stampVersion(){const el=$('verTag');if(el)el.textContent='v'+VERSION;}
function initWorkspace(){
  const SEED='villanyterv_seeded_v1';let seeded=false,cur=null;
  try{seeded=!!localStorage.getItem(SEED);cur=localStorage.getItem(CURRENT_KEY);}catch(_){}
  if(!seeded){try{
    loadBuilding(HOUSE,false);
    const ix=loadProjIndex();ix['pelda']={name:'Példa ház',ts:Date.now(),data:sessionObj()};saveProjIndex(ix);
    localStorage.setItem(SEED,'1');
  }catch(_){}
    loadBuilding(blankBuilding());currentProjId=null;try{localStorage.removeItem(CURRENT_KEY);}catch(_){}
    setMode('select');setRot(90);renderProjects();return;}
  const ix=loadProjIndex();
  if(cur&&ix[cur]){loadProject(cur);}
  else{loadBuilding(blankBuilding());}
  setMode('select');setRot(90);renderProjects();}
setTimeout(initWorkspace,0);
$('autoLayout').onclick=()=>setAutoLayout(!autoLayout);
$('bClearRoute').onclick=()=>clearRouting();
$('bRecalc').onclick=()=>recomputeRouting();
// resizable sidebars
(function(){let drag=null;
document.querySelectorAll('.resizer').forEach(rz=>rz.addEventListener('pointerdown',e=>{e.preventDefault();
  const which=rz.dataset.r,el=which==='left'?document.querySelector('.side:not(.r)'):document.querySelector('.side.r');
  drag={el,which,x:e.clientX,w:el.getBoundingClientRect().width};try{rz.setPointerCapture(e.pointerId);}catch(_){}}));
window.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;
  let w=drag.which==='left'?drag.w+dx:drag.w-dx;w=Math.max(150,Math.min(460,w));drag.el.style.width=w+'px';});
window.addEventListener('pointerup',()=>{drag=null;});})();
// ---- customisable dashboard: panel pickers on both sidebars ----
const PANELS_DEF=[{m:'Tools',label:'Tools',def:'left'},{m:'Layers',label:'Layers',def:'left'},
 {m:'Active level',label:'Szint',def:'left'},{m:'Path (',label:'Path',def:'left'},{m:'Cable (',label:'Cable',def:'left'},
 {m:'Device',label:'Device',def:'left'},{m:'Routing',label:'Routing',def:'left'},{m:'Áramkörök',label:'Körök',def:'left'},{m:'Dokument',label:'Doksi',def:'left'},
 {m:'Build (',label:'Build',def:'left'},{m:'Building',label:'Épület',def:'left'},{m:'Show levels',label:'Szintek',def:'left'},
 {m:'Height guide',label:'Vonalak',def:'left'},{m:'Floor labels',label:'Feliratok',def:'left'},{m:'View',label:'View',def:'left'},
 {m:'Cable totals',label:'KábelΣ',def:'right'},{m:'Devices (',label:'Eszközök',def:'right'},{m:'Árajánlat',label:'BOM',def:'right'}];
function matchPanel(h3){let best=null;for(const p of PANELS_DEF)if(h3.indexOf(p.m)===0&&(!best||p.m.length>best.m.length))best=p;
  if(!best)for(const p of PANELS_DEF)if(h3.indexOf(p.m)>=0&&(!best||p.m.length>best.m.length))best=p;return best;}
function pslug(t){return t.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,18)||'p';}
let PANELS=[],panelLoc={},panelPool=null,userPanelLoc=null;
const TOOL_LAYOUT={
 select:{left:['projektek','tools','layers','view'],right:['activelevelnewitem','rajnlatbom']},
 grab:{left:['tools','layers','view'],right:['activelevelnewitem']},
 path:  {left:['tools','pathplyaelsdleges','activelevelnewitem','routing'],right:['heightguidelines','rajnlatbom']},
 cable: {left:['tools','cablemsodlagos','activelevelnewitem'],right:['heightguidelines','cabletotalsm']},
 device:{left:['tools','device','activelevelnewitem','dokumentci'],right:['devicesdb','rajnlatbom']},
 wall:  {left:['tools','activelevelnewitem','buildinglayout'],right:['view']},
 build: {left:['tools','buildsnapstowall','activelevelnewitem'],right:['view']},
 object:{left:['tools','objects','activelevelnewitem'],right:['view']},
 floor: {left:['tools','activelevelnewitem','buildinglayout'],right:['view']},
 roof:  {left:['tools','buildinglayout','activelevelnewitem'],right:['view']}};
function pidByLabelKey(k){const p=PANELS.find(x=>x.pid===k);return p?p.pid:null;}
function applyToolLayout(mode){if(!autoLayout)return;const L=TOOL_LAYOUT[mode];if(!L)return;
  if(!userPanelLoc)userPanelLoc=JSON.parse(JSON.stringify(panelLoc));
  const toolsDock=panelLoc['tools'];  // preserve the user's Tools placement (e.g. 'top' = Tools:fent)
  const nl={};PANELS.forEach(p=>nl[p.pid]='off');
  (L.left||[]).forEach(pid=>{if(PANELS.some(p=>p.pid===pid))nl[pid]='left';});
  (L.right||[]).forEach(pid=>{if(PANELS.some(p=>p.pid===pid))nl[pid]='right';});
  if(toolsDock==='top')nl['tools']='top';  // keep Tools on top if the user docked it there
  panelLoc=nl;renderDashboard();}
function setAutoLayout(on){autoLayout=on;const b=$('autoLayout');if(b)b.classList.toggle('on',on);
  if(on){applyToolLayout(state.mode);}else if(userPanelLoc){panelLoc=userPanelLoc;userPanelLoc=null;renderDashboard();}
  scheduleSave&&scheduleSave();}
function buildDashboard(){
  const L=document.querySelector('.side:not(.r)'),R=document.querySelector('.side.r');
  panelPool=document.createElement('div');panelPool.id='panelPool';panelPool.style.display='none';document.body.appendChild(panelPool);
  const grps=[...document.querySelectorAll('.side .grp')];
  PANELS=grps.map(el=>{const h3el=el.querySelector('h3'),h3=h3el?h3el.textContent.trim():'?';const m=matchPanel(h3)||{label:h3.slice(0,7),def:'left'};
    const pid=pslug(h3);el.dataset.pid=pid;el.remove();return {pid,label:m.label,el,def:m.def};});
  [L,R].forEach(side=>{side.innerHTML='';const pk=document.createElement('div');pk.className='picker';side.appendChild(pk);
    const pn=document.createElement('div');pn.className='panels';side.appendChild(pn);});
  if(!Object.keys(panelLoc).length)PANELS.forEach(p=>panelLoc[p.pid]=p.def);
  renderDashboard();}
function renderDashboard(){
  const L=document.querySelector('.side:not(.r)'),R=document.querySelector('.side.r');
  if(!L||!R||!panelPool)return;const lp=L.querySelector('.panels'),rp=R.querySelector('.panels');
  const tb=$('toolbarRow');
  PANELS.forEach(p=>{const loc=panelLoc[p.pid];(loc==='left'?lp:loc==='right'?rp:loc==='top'?tb:panelPool).appendChild(p.el);});
  tb.classList.toggle('show',tb.children.length>0);
  const tp=PANELS.find(p=>p.label==='Tools');if(tp)$('bToolsLoc').textContent=(panelLoc[tp.pid]==='top')?'⧉ Tools: oldalt':'⧉ Tools: fent';
  [['left',L],['right',R]].forEach(a=>{const side=a[0],pk=a[1].querySelector('.picker');
    pk.innerHTML=PANELS.map(p=>`<button class="pbtn ${panelLoc[p.pid]===side?'on':''}" data-pp="${p.pid}" data-ps="${side}">${p.label}</button>`).join('');
    pk.querySelectorAll('.pbtn').forEach(b=>b.onclick=()=>{const pid=b.dataset.pp,sd=b.dataset.ps;panelLoc[pid]=(panelLoc[pid]===sd)?'off':sd;renderDashboard();if(typeof scheduleSave==='function')scheduleSave();});});}
$('bToolsLoc').onclick=()=>{const tp=PANELS.find(p=>p.label==='Tools');if(!tp)return;
  panelLoc[tp.pid]=(panelLoc[tp.pid]==='top')?'left':'top';renderDashboard();scheduleSave();};
$('objSearch').oninput=()=>renderObjList();renderObjList();
buildDashboard();window.__dashReady=true;stampVersion();renderLayers();restoreSession();if(autoLayout)applyToolLayout(state.mode);
