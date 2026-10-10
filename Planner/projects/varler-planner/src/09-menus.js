// ==========================================================================
// 08-menus.js — hit-test, context menus, modals, room + wall + opening actions
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// hit-test + context menu ////////////////////
// ---- what can be touched (round 2026-10-10, WP-U1) ----
// The hit side of what 04-render draws: a level that is off, a layer or sub-layer that is hidden, a solo room that
// excludes it, a generated object while those are switched off — none of it can be clicked, hovered, boxed or
// menu'd. Before this only the LOCK was checked here, so a socket on a hidden layer still stole the click.
// Snapping is deliberately not gated (Q-U01=A): drawing onto a wall layer hidden on purpose is common.
function hitOk(item,cat,level){const L=level||(item&&item.level)||state.active;
  if(!state.levels[L]||!layerShows(item,cat))return false;
  if(cat==='note')return !(item&&item.hidden);                 // notes draw outside a solo room too (ntVisible)
  if(cat==='object'&&isGenObject(item)&&!genObjectsVisible())return false;
  if(item&&item.x!=null&&!soloOk(item.x,item.y,L))return false;
  return true;}
// a wall rect has no x/y (soloWallOk instead), and Nézet → Falak "rejtett" removes walls from the normal view only —
// the white-out, blueprint and preview views draw them whatever the wall mode says
function hitOkWall(r,level){const L=level||state.active;
  if(!state.levels[L]||!layerShows(r,'wall')||!soloWallOk(r,L))return false;
  return !(state.wallMode==='hidden'&&state.style!=='whiteout'&&state.style!=='blueprint'&&!prevOn());}
// a record of a collection, by collection key (box select); a floor also obeys the solo room like 04 drawNormalGeom
function hitOkRec(t,o,i){
  if(t==='floors')return hitOk(o,'build')&&!(state.soloRoom&&!soloRoomIs({src:'F',i,level:o.level}));
  return hitOk(o,{objects:'object',devices:'device',openings:'build',roofs:'build',notes:'note',paths:'path',cables:'cable'}[t]||t);}
// ---- what a click picks (round 2026-10-10, WP-U3) ----
// Every piece under the pointer becomes a candidate in a tier: 0 = a point piece (opening, device, note, measure,
// cable) — nearest centre wins; 1 = an object, hit anywhere inside its DRAWN box (distance to the projected
// silhouette, 0 inside), or a roof by its centre handle — ties go to the smaller one; 2 = the wall under the pointer;
// 3 = the floor polygon. A lower tier always wins, so a socket inside a cabinet's box is still the socket. This
// replaced one pass in which an object claimed half its size around its centre and then reset the distance every
// later piece had to beat — the big piece near the cursor won. Lock checks stay where a piece WOULD hit (lyrLockHit
// records the name it reports when nothing else was found).
function hitHull(P){P=P.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];for(const p of P){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
  return lo.slice(0,-1).concat(up.slice(0,-1));}
function hitFootD(pts,bx,by){if(pointInPoly(bx,by,pts))return 0;let d=1e18;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++)d=Math.min(d,nearestOnSegPlain(bx,by,pts[j][0],pts[j][1],pts[i][0],pts[i][1]).d);return d;}
function hitCands(e,bx,by){const Z=state.zoom,hd=(state.mobile?26:12)/Z,C=[],add=(h,d,tier,area)=>{C.push({h,d,tier,area:area||0});};
  (data.roofs||[]).forEach((rf,i)=>{if(!hitOk(rf,'build'))return;const b=planToBase((rf.x0+rf.x1)/2,(rf.y0+rf.y1)/2,dz(rf.level,(rf.eave+rf.ridge)/2));
    const d=Math.hypot(bx-b[0],by-b[1]);if(d<Math.max(hd,18/Z)&&!lyrLockHit(rf))add({t:'roofs',i},d,1,Math.abs((rf.x1-rf.x0)*(rf.y1-rf.y0)));});
  data.objects.forEach((o,i)=>{if(!hitOk(o,'object'))return;
    const d=hitFootD(hitHull(objCorners(o).map(p=>planToBase(p[0],p[1],p[2]))),bx,by);
    const b=planToBase(o.x,o.y,dz(o.level,(o.z||0)+(o.ht||0)/2)),dc=Math.hypot(bx-b[0],by-b[1]);   // a tiny object keeps the old 14 px reach
    if((d<=4/Z||dc<14/Z)&&!lyrLockHit(o))add({t:'objects',i},d,1,(o.w||600)*(o.d||600));});
  data.openings.forEach((o,i)=>{if(!hitOk(o,'build'))return;const b=planToBase(o.x,o.y,dz(o.level,0));let d=Math.hypot(bx-b[0],by-b[1]);
    const F=opnWide()?opnFootprint(o):null;if(F){const z=dz(o.level,0);d=Math.min(d,hitFootD(F.corners.map(p=>planToBase(p[0],p[1],z)),bx,by));}   // G1: the whole footprint
    if(d<hd&&!lyrLockHit(o))add({t:'openings',i},d,0);});
  data.devices.forEach((o,i)=>{if(!hitOk(o,'device'))return;const b=planToBase(o.x,o.y,dz(o.level,o.h||0)),d=Math.hypot(bx-b[0],by-b[1]);if(d<hd&&!lyrLockHit(o))add({t:'devices',i},d,0);});
  data.notes.forEach((o,i)=>{if(!hitOk(o,'note'))return;const b=planToBase(o.x,o.y,dz(o.level,0)),d=Math.hypot(bx-b[0],by-b[1]);if(d<hd&&!lyrLockHit(o))add({t:'notes',i},d,0);});
  data.measures.forEach((m,i)=>{if(!m||m.length<2)return;if(!state.levels[m[0].level])return;
    const a=planToBase(m[0].x,m[0].y,dz(m[0].level,0)),b=planToBase(m[1].x,m[1].y,dz(m[1].level,0));
    const r=nearestOnSegPlain(bx,by,a[0],a[1],b[0],b[1]);if(r.d<hd&&r.d<14/Z)add({t:'measures',i},r.d,0);});
  data.cables.forEach((cb,ci)=>{if(!circOn[cb.type])return;let d=1e18;
    cb.nodes.forEach(n=>{if(!hitOk(cb,'cable',n.level))return;const b=planToBase(n.x,n.y,dz(n.level,n.h));d=Math.min(d,Math.hypot(bx-b[0],by-b[1]));});
    if(d<hd&&!lyrLockHit(cb))add({t:'cables',i:ci},d,0);});
  {const r=wallHitRect(e);if(r&&!lyrLockHit(r))add({t:'wall',level:state.active,ref:r},0,2,Math.abs((r.x1-r.x0)*(r.y1-r.y0)));}
  {const [px,py]=baseToPlan(bx,by,dz(state.active,0));   // the topmost floor under the pointer
    for(let i=data.floors.length-1;i>=0;i--){const fl=data.floors[i];if(!hitOkRec('floors',fl,i))continue;
      if(fl.poly&&pointInPoly(px,py,fl.poly)&&!lyrLockHit(fl)){add({t:'floors',i},0,3,polyAreaMM(fl.poly));break;}}}
  return C.sort((a,b)=>a.tier-b.tier||a.d-b.d||a.area-b.area);}   // stable: equal distances keep collection order
// The selected piece keeps a click on — or right next to — its own centre (the gizmo's blue dot) even when another
// piece's centre is nearer. That holds for a POINT piece only: a room's or a cabinet's centre is an abstract spot
// with sockets around it, and a selected floor must not swallow them (its Move-mode dot is a .giz handle anyway).
// A big piece (wall / object / floor / roof) instead keeps clicks inside its own box against a piece of its own size
// class — never against a smaller piece sitting in it.
function hitPreferSel(hit,bx,by){const s=selected;if(!s||!hit||hEq(s,hit))return hit;
  const o=pieceRef(s);if(!o)return hit;
  if(s.t==='wall'?!hitOkWall(o,s.level):!hitOkRec(s.t,o,s.i))return hit;
  if(layerById((s.t==='measures'?null:o.layer)||'L0').lock)return hit;
  const big=t=>t==='wall'||t==='objects'||t==='floors'||t==='roofs',L=pieceLevel(s);
  if(!big(s.t)){const c=pGetC(s),b=planToBase(c[0],c[1],dz(L,pGetZ(s)));return Math.hypot(bx-b[0],by-b[1])<14/state.zoom?s:hit;}
  if(!big(hit.t))return hit;
  if(s.t==='objects')return hitFootD(hitHull(objCorners(o).map(p=>planToBase(p[0],p[1],p[2]))),bx,by)===0?s:hit;
  const z=s.t==='wall'?(o.z0||0):s.t==='floors'?(o.z||0):(o.eave||0),[px,py]=baseToPlan(bx,by,dz(L,z));
  const inside=s.t==='floors'?pointInPoly(px,py,o.poly):(px>=Math.min(o.x0,o.x1)&&px<=Math.max(o.x0,o.x1)&&py>=Math.min(o.y0,o.y1)&&py<=Math.max(o.y0,o.y1));
  return inside?s:hit;}
function hitTest(e){lyrLockName=null;const [bx,by]=clientToBase(e);const C=hitCands(e,bx,by);let hit=C.length?C[0].h:null;
  // Alt+click — "something is in the way": the next piece under the pointer after the current selection, round and round
  if(e&&e.altKey&&e.type==='pointerdown'&&e.button===0&&C.length>1){const k=(C.findIndex(c=>hEq(c.h,selected))+1)%C.length;hit=C[k].h;
    $('hud').textContent='Átfedő elemek: '+(k+1)+' / '+C.length+' — Alt+kattintás: következő';}
  else hit=hitPreferSel(hit,bx,by);
  return lyrLockReport(hit);}
function removeHit(h){
  if(h&&h.t==='devices'){const dv=data.devices[h.i];
    if(dv&&dv.genId){const ix=data.objects.findIndex(o=>o.genId===dv.genId);if(ix>=0)data.objects.splice(ix,1);}}if(h.t==='wall'){const a=WALLS[h.level]||[];const idx=a.indexOf(h.ref);if(idx>=0){a.splice(idx,1);SNAP[h.level]=centerlines(a);}return;}
  if(data[h.t])data[h.t].splice(h.i,1);}
const ctx=$('ctx');
// ---- modal ----
const modalBg=$('modalBg'),modalEl=$('modal');
function closeModal(){modalBg.style.display='none';modalEl.innerHTML='';modalEl.style.maxWidth='';modalEl.style.width='';modalEl.classList.remove('full');}
// Enter (or leaving a field) releases the keyboard back to the drawing — otherwise ↑/↓ keep
// stepping the number box instead of the drawing height.
function releaseInputs(root){(root||document).querySelectorAll('input[type=number]').forEach(inp=>{
  if(inp.__rel)return;inp.__rel=1;
  inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();inp.blur();}});
  inp.addEventListener('change',()=>{setTimeout(()=>{try{inp.blur();}catch(_){}},0);});});}
function openModal(title,bodyHtml,onOk,okLabel){modalEl.innerHTML=`<h4>${title}</h4>${bodyHtml}<div class="mbtns"><button id="mCancel">Mégse</button><button id="mOk" class="on">${okLabel||"OK"}</button></div>`;
  modalBg.style.display='flex';releaseInputs(modalEl);$('mCancel').onclick=closeModal;$('mOk').onclick=()=>{if(onOk()!==false)closeModal();};}
modalBg.addEventListener('pointerdown',e=>{if(e.target===modalBg)closeModal();});
function circuitForm(c){c=c||{name:'',num:'',count:3,mm2:1.5,data:''};
  const opts=WIRE_MM2.map(v=>`<option ${v==c.mm2?'selected':''}>${v}</option>`).join('');
  const dopts=['<option value="">— villany —</option>'].concat(DATA_KINDS.map(k=>`<option ${k==c.data?'selected':''}>${k}</option>`)).join('');
  return `<div class="mrow">Áramkör <input id="cName" value="${c.name||''}" style="width:130px"> sorsz. <input id="cNum" value="${c.num||''}" style="width:56px"></div>
   <div class="mrow">Erek <input id="cCount" type="number" value="${c.count||3}" style="width:56px"> db · <select id="cMm2">${opts}</select> mm²</div>
   <div class="mrow">Adat típus <select id="cData">${dopts}</select></div>
   <div class="mrow">Áramkör szín <select id="cCol" style="width:120px">${CIRCUIT_COLORS.map(x=>`<option value="${x.k}" ${x.k===(c.col||'zold')?'selected':''}>${x.l}</option>`).join('')}</select>
     <span id="cColSw" style="display:inline-block;width:16px;height:16px;border-radius:3px;vertical-align:middle;margin-left:6px;border:1px solid #999;background:${circuitColor(c)}"></span></div>
   <div class="mrow" style="font-size:11px;color:#888">Ér-színek: fekete · kék · zöld · barna · szürke (szabvány). Az áramkör szín csak a vizualizációhoz.</div>`;}
function readCircuit(){const count=+$('cCount').value||0,colors=[];for(let i=0;i<count;i++)colors.push(WIRE_COLORS[i%WIRE_COLORS.length]);
  return {name:$('cName').value,num:$('cNum').value,count,mm2:+$('cMm2').value,data:$('cData').value,colors,col:($('cCol')?$('cCol').value:'zold')};}
// ---- hit helpers ----
function pathSectionHit(e){const [bx,by]=clientToBase(e);let best=null,bd=12/state.zoom;
  data.paths.forEach((pa,pi)=>{const lane=pa.lane||0;for(let i=1;i<pa.nodes.length;i++){const a=pa.nodes[i-1],b=pa.nodes[i];
    if(!hitOk(pa,'path',a.level)||!state.levels[b.level])continue;const dx=b.x-a.x,dy=b.y-a.y,ln=Math.hypot(dx,dy)||1;
    const A=planToBase(a.x-dy/ln*lane*PATHW,a.y+dx/ln*lane*PATHW,dz(a.level,a.h)),B=planToBase(b.x-dy/ln*lane*PATHW,b.y+dx/ln*lane*PATHW,dz(b.level,b.h));
    const r=nearestOnSeg(bx,by,A[0],A[1],B[0],B[1]);if(r.d<bd&&!lyrLockHit(pa)){bd=r.d;best={pi,si:i-1,t:r.t};}}});return best;}
function devHitIdx(e){const [bx,by]=clientToBase(e);let best=null,bd=14/state.zoom;
  data.devices.forEach((d,i)=>{if(!hitOk(d,'device'))return;const b=planToBase(d.x,d.y,dz(d.level,d.h||0));const dd=Math.hypot(bx-b[0],by-b[1]);if(dd<bd&&!lyrLockHit(d)){bd=dd;best=i;}});return best;}
function nearestPathNode(pa,x,y){let bi=0,bd=1e18;pa.nodes.forEach((n,i)=>{const d=Math.hypot(n.x-x,n.y-y);if(d<bd){bd=d;bi=i;}});return {i:bi,d:bd};}
function nearestPathToPoint(x,y){let best=null,bd=1e18;data.paths.forEach((pa,pi)=>{const nn=nearestPathNode(pa,x,y);if(nn.d<bd){bd=nn.d;best={pi,ni:nn.i,d:nn.d};}});return best;}
function boxesOnPath(pa){const res=[];data.devices.forEach(d=>{if(d.type!=='junction'&&d.type!=='board')return;const nn=nearestPathNode(pa,d.x,d.y);if(nn.d<400)res.push({ni:nn.i,type:d.type});});return res;}
// ---- actions ----
function setSectionBuild(pi,si){const sec=data.paths[pi].sections[si]||(data.paths[pi].sections[si]={build:'sull_gege',circuit:null});
  openModal('Szakasz kivitele',`<div class="mrow"><select id="bSel" style="width:100%">`+BUILDS.map(b=>`<option value="${b.k}" ${b.k===sec.build?'selected':''}>${b.l}</option>`).join('')+`</select></div>`,
    ()=>{pushUndo();sec.build=$('bSel').value;draw();});}
function setSectionCircuit(pi,si){const sec=data.paths[pi].sections[si]||(data.paths[pi].sections[si]={build:'sull_gege',circuit:null});
  openModal('Áramkör a szakaszon',circuitForm(sec.circuit),()=>{pushUndo();sec.circuit=readCircuit();draw();});
  setTimeout(()=>{const sel=$('cCol'),sw=$('cColSw');if(sel&&sw)sel.onchange=()=>{const f=CIRCUIT_COLORS.find(x=>x.k===sel.value);sw.style.background=f?f.c:'#1f9d55';};},30);}
function addBoxOnPath(pi,si,t){const pa=data.paths[pi],a=pa.nodes[si],b=pa.nodes[si+1];
  pushUndo();data.devices.push({type:'junction',level:a.level,x:(a.x+b.x*(t||0.5))/(1+(t||0.5))*0+ (a.x+b.x)/2,y:(a.y+b.y)/2});draw();}
function addParallelPath(pi){const src=data.paths[pi];const clone=copyRecord('paths',src);(clone.nodes||[]).forEach(n=>{delete n.id;});   // fresh path AND node ids from data.seq
  clone.lane=(src.lane||0)+1;clone.sections=clone.sections.map(s=>({build:s.build,circuit:null}));
  pushUndo();data.paths.push(clone);ensureIds(data);draw();}
function placeBoardAt(e){const h=BOARD_DEFAULT_Z,w=snapWall(e,state.active,h);let x,y;if(w){x=w.x;y=w.y;}else{const p=baseToPlan(...clientToBase(e),dz(state.active,h));x=p[0];y=p[1];}
  pushUndo();const b={type:'board',level:state.active,x,y,h,z:h,rw:BOARD_RW,rd:BOARD_RD,ang:(w&&w.ang)||0,layer:curLayer(),autoObj:true};
  data.devices.push(b);ensureBoardObject(b);draw();}
function advancedBoardAt(e,wallR){const h=BOARD_DEFAULT_Z,w=snapWall(e,state.active,h);let x,y;if(w){x=w.x;y=w.y;}else{const p=baseToPlan(...clientToBase(e),dz(state.active,h));x=p[0];y=p[1];}
  openModal('Elosztószekrény — haladó elhelyezés',
    `<div class="mrow">X <input id="bpx" type="number" value="${Math.round(x)}" style="width:80px"> mm · Y <input id="bpy" type="number" value="${Math.round(y)}" style="width:80px"> mm</div>`
    +`<div class="mrow">Z (magasság a padlótól) <input id="bpz" type="number" value="${BOARD_DEFAULT_Z}" style="width:80px"> mm</div>`
    +`<div class="mrow">Csatlakozó téglalap: szélesség <input id="bprw" type="number" value="${BOARD_RW}" style="width:70px"> × mélység <input id="bprd" type="number" value="${BOARD_RD}" style="width:70px"> mm</div>`
    +`<div class="mrow">Forgatás <input id="bpang" type="number" value="${Math.round(((w&&w.ang)||0)*180/Math.PI)}" style="width:60px"> °</div>`
    +`<div class="mrow"><label><input type="checkbox" id="bpobj" checked> Elosztószekrény objektum automatikus elhelyezése a közepére</label></div>`
    +`<div class="mrow" style="font-size:11px;color:#777">A téglalap egyetlen nagy csatlakozási pont: a hozzá érő pálya bármelyik pontján (bármelyik faloldalról) bekötődik.</div>`,
    ()=>{pushUndo();const b={type:'board',level:state.active,x:+$('bpx').value||x,y:+$('bpy').value||y,
      h:+$('bpz').value||BOARD_DEFAULT_Z,z:+$('bpz').value||BOARD_DEFAULT_Z,
      rw:+$('bprw').value||BOARD_RW,rd:+$('bprd').value||BOARD_RD,ang:((+$('bpang').value||0)*Math.PI/180),
      layer:curLayer(),autoObj:$('bpobj').checked};
      data.devices.push(b);ensureBoardObject(b);draw();$('hud').textContent='Elosztószekrény elhelyezve (haladó).';},'Elhelyez');}
const BOARD_DEFAULT_Z=2000, BOARD_RW=600, BOARD_RD=150;
function boardZ(){return (state&&state.boardZ)||BOARD_DEFAULT_Z;} // board node rectangle: footprint of the 600×150 Elosztószekrény, mounted ~2000mm
// keep a visual Elosztószekrény object centred on the board node rectangle (bonus: auto-visualise)
function ensureBoardObject(b){if(!b.autoObj)return;
  // remove any prior auto object tied to this board, then (re)create one at the board centre
  data.objects=data.objects.filter(o=>o.boardFor!==b);
  data.objects.push({level:b.level,x:b.x,y:b.y,z:Math.max(0,(b.z||BOARD_DEFAULT_Z)-400),w:b.rw||BOARD_RW,d:b.rd||BOARD_RD,ht:800,ang:b.ang||0,name:'Elosztószekrény',color:'#d9c48a',layer:b.layer,boardFor:b,onWall:true});}
// the set of plan corners of a board's connection rectangle (for hit-testing a node "inside" it)
function boardRectPoly(b){const w=(b.rw||BOARD_RW)/2,d=(b.rd||BOARD_RD)/2,a=b.ang||0,ca=Math.cos(a),sa=Math.sin(a);
  return [[-w,-d],[w,-d],[w,d],[-w,d]].map(p=>[b.x+p[0]*ca-p[1]*sa, b.y+p[0]*sa+p[1]*ca]);}
// does a plan point fall within a board's connection rectangle (+tol)? one big connection point along the whole board
function pointInBoard(b,x,y,tol){const w=(b.rw||BOARD_RW)/2+(tol||0),d=(b.rd||BOARD_RD)/2+(tol||0),a=b.ang||0,ca=Math.cos(-a),sa=Math.sin(-a);
  const lx=(x-b.x)*ca-(y-b.y)*sa, ly=(x-b.x)*sa+(y-b.y)*ca;return Math.abs(lx)<=w&&Math.abs(ly)<=d;}
function editStairs(i){const o=data.openings[i];const g=v=>o[v]!=null?o[v]:state.stairDef[v];
  openModal('Lépcső méretek (mm)',
   `<div class="mrow">Szélesség <input id="sW" type="number" value="${g('w')}" style="width:80px"></div>`+
   `<div class="mrow">Fellépő (riser) <input id="sR" type="number" value="${g('riser')}" style="width:80px"></div>`+
   `<div class="mrow">Járólap (going) <input id="sG" type="number" value="${g('going')}" style="width:80px"></div>`+
   `<div class="mrow">Vastagság <input id="sT" type="number" value="${g('th')}" style="width:80px"></div>`,
   ()=>{pushUndo();o.w=+$('sW').value||1000;o.riser=+$('sR').value||180;o.going=+$('sG').value||250;o.th=+$('sT').value||300;
     state.stairDef={w:o.w,riser:o.riser,going:o.going,th:o.th};draw();});}
function doorTypeDialog(oi){const o=data.openings[oi];if(!o)return;const cur=doorKind(o);
  const opts=Object.keys(DOORTYPE).map(k=>`<option value="${k}" ${k===cur?'selected':''}>${esc(DOORTYPE[k].n)}</option>`).join('');
  openModal('Ajtó típusa',
     `<div class="mrow"><select id="dtSel" style="width:100%">${opts}</select></div>`
    +`<div class="mrow"><label><input type="checkbox" id="dtSize" checked> a típus alapméretét is állítsd be</label></div>`
    +`<div class="mrow" style="font-size:11px;color:#777">A 2D hivatalos (blueprint) nézetben mindegyik a saját jelkulcsával rajzolódik: nyíló = szárny + negyedkör, kétszárnyú = két negyedkör, toló = fal előtti szárny + nyíl, falba futó = szaggatott szárny, harmonika = cikcakk, garázskapu = szaggatott szekció + GK, tűzgátló = EI felirat, falnyílás = csak káva.</div>`,
    ()=>{pushUndo();const k=$('dtSel').value;o.dtype=k;
      if($('dtSize').checked){o.w=DOORTYPE[k].w;o.h=DOORTYPE[k].h;}
      draw();$('hud').textContent='Ajtó → '+DOORTYPE[k].n;},'Alkalmaz');}

