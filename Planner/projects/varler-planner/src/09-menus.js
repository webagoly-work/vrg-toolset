// ==========================================================================
// 08-menus.js — hit-test, context menus, modals, room + wall + opening actions
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// hit-test + context menu ////////////////////
function hitTest(e){const [bx,by]=clientToBase(e);let hit=null,hd=(state.mobile?26:12)/state.zoom;
  (data.roofs||[]).forEach((rf,i)=>{if(!state.levels[rf.level])return;const b=planToBase((rf.x0+rf.x1)/2,(rf.y0+rf.y1)/2,dz(rf.level,(rf.eave+rf.ridge)/2));
    const d=Math.hypot(bx-b[0],by-b[1]);if(d<Math.max(hd,18/state.zoom)){hd=d;hit={t:'roofs',i};}});
  data.objects.forEach((o,i)=>{if(!state.levels[o.level])return;const b=planToBase(o.x,o.y,dz(o.level,(o.z||0)+(o.ht||0)/2));
    const d=Math.hypot(bx-b[0],by-b[1]);const rad=Math.max(14,Math.min(o.w||600,o.d||600)*0.5*SC*0.9)/state.zoom;
    if(d<Math.max(hd,rad)){hd=d;hit={t:'objects',i};}});
  data.openings.forEach((o,i)=>{const b=planToBase(o.x,o.y,dz(o.level,0));const d=Math.hypot(bx-b[0],by-b[1]);if(d<hd){hd=d;hit={t:'openings',i};}});
  data.devices.forEach((o,i)=>{const b=planToBase(o.x,o.y,dz(o.level,o.h||0));const d=Math.hypot(bx-b[0],by-b[1]);if(d<hd){hd=d;hit={t:'devices',i};}});
  {const wr2=wallHitRect(e);if(wr2){const b=planToBase((wr2.x0+wr2.x1)/2,(wr2.y0+wr2.y1)/2,dz(state.active,(wr2.h||wallH(state.active))/2));
    const dd=Math.hypot(bx-b[0],by-b[1]);if(!hit||dd<hd+40/state.zoom){if(!hit)hit={t:'wall',level:state.active,ref:wr2};}}}
  data.notes.forEach((o,i)=>{const b=planToBase(o.x,o.y,dz(o.level,0));const d=Math.hypot(bx-b[0],by-b[1]);if(d<hd){hd=d;hit={t:'notes',i};}});
  data.measures.forEach((m,i)=>{if(!m||m.length<2)return;if(!state.levels[m[0].level])return;
    const a=planToBase(m[0].x,m[0].y,dz(m[0].level,0)),b=planToBase(m[1].x,m[1].y,dz(m[1].level,0));
    const r=nearestOnSegPlain(bx,by,a[0],a[1],b[0],b[1]);if(r.d<hd&&r.d<14/state.zoom){hd=r.d;hit={t:'measures',i};}});
  // floors: selectable by clicking inside the polygon (only if nothing higher-priority was hit)
  if(!hit){const [px,py]=baseToPlan(bx,by,dz(state.active,0));
    for(let i=data.floors.length-1;i>=0;i--){const fl=data.floors[i];if(!state.levels[fl.level])continue;
      if(fl.poly&&pointInPoly(px,py,fl.poly)){hit={t:'floors',i};break;}}}
  data.cables.forEach((cb,ci)=>cb.nodes.forEach(n=>{const b=planToBase(n.x,n.y,dz(n.level,n.h));const d=Math.hypot(bx-b[0],by-b[1]);if(d<hd){hd=d;hit={t:'cables',i:ci};}}));
  return hit;}
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
    if(!state.levels[a.level]||!state.levels[b.level])continue;const dx=b.x-a.x,dy=b.y-a.y,ln=Math.hypot(dx,dy)||1;
    const A=planToBase(a.x-dy/ln*lane*PATHW,a.y+dx/ln*lane*PATHW,dz(a.level,a.h)),B=planToBase(b.x-dy/ln*lane*PATHW,b.y+dx/ln*lane*PATHW,dz(b.level,b.h));
    const r=nearestOnSeg(bx,by,A[0],A[1],B[0],B[1]);if(r.d<bd){bd=r.d;best={pi,si:i-1,t:r.t};}}});return best;}
function devHitIdx(e){const [bx,by]=clientToBase(e);let best=null,bd=14/state.zoom;
  data.devices.forEach((d,i)=>{if(!state.levels[d.level])return;const b=planToBase(d.x,d.y,dz(d.level,d.h||0));const dd=Math.hypot(bx-b[0],by-b[1]);if(dd<bd){bd=dd;best=i;}});return best;}
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
function addParallelPath(pi){const src=data.paths[pi];const clone=JSON.parse(JSON.stringify(src));
  clone.id='p'+Date.now().toString(36);clone.lane=(src.lane||0)+1;clone.sections=clone.sections.map(s=>({build:s.build,circuit:null}));
  pushUndo();data.paths.push(clone);draw();}
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

