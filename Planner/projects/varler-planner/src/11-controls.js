// ==========================================================================
// 10-controls.js — sidebar controls, projects, panels, persistence
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// controls ////////////////////
function setRot(deg){deg=((Math.round(deg)%360)+360)%360;state.rot=deg;$('rot').value=deg;$('rotVal').textContent=deg+'°';
  document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('on',+b.dataset.deg===deg));draw();}
$('rot').oninput=e=>setRot(+e.target.value);$('rotL').onclick=()=>setRot(state.rot-15);$('rotR').onclick=()=>setRot(state.rot+15);
document.querySelectorAll('.preset').forEach(b=>b.onclick=()=>setRot(+b.dataset.deg));
$('style').onchange=e=>{state.style=e.target.value;bpUI();
  if($('styleToggle'))$('styleToggle').classList.toggle('on',state.style==='blueprint');
  if(state.style==='blueprint'&&state.pitch<88){state.pitch=90;state.flat=true;$('view3d').textContent='3D';resetView();
    $('hud').textContent='Blueprint nézet — 2D felülnézetre váltottam.';}
  draw();};
$('wallMode').onchange=e=>{state.wallMode=e.target.value;draw();};
$('explode').onchange=e=>{state.exploded=e.target.checked;draw();};
$('grid').onchange=e=>state.grid=e.target.checked;$('gridSize').onchange=e=>state.gridSize=+e.target.value;
$('isoGrid').onchange=e=>{state.isoGrid=e.target.checked;draw();};
$('gizSnap').onchange=e=>{state.gizmoSnap=e.target.checked;};
$('objWallSnap').onchange=e=>{state.objWallSnap=e.target.checked;draw();};
$('multiSel').onchange=e=>{state.multiSelect=e.target.checked;};
if($('circHoverInfo'))$('circHoverInfo').onchange=e=>{state.circHoverInfo=e.target.checked;draw();};
if($('devScale'))$('devScale').oninput=e=>{state.devScale=+e.target.value;draw();};
if($('pathScale'))$('pathScale').oninput=e=>{state.pathScale=+e.target.value;draw();};
if($('pathColor'))$('pathColor').oninput=e=>{state.pathColor=e.target.value;draw();};
if($('pathColorReset'))$('pathColorReset').onclick=()=>{state.pathColor=null;draw();};
$('hDisp').onchange=e=>{state.hDisp=e.target.value;draw();};
$('bpDims').onchange=e=>{state.bp.dims=e.target.checked;draw();};
$('bpTitle').onchange=e=>{state.bp.title=e.target.checked;draw();};
$('bpEdit').onclick=()=>openModal('Címblokk',
  `<div class="mrow">Megnevezés <input id="tpP" value="${esc(state.bp.proj||'')}" style="width:220px"></div>`
 +`<div class="mrow">Cím <input id="tpA" value="${esc(state.bp.addr||'')}" style="width:220px"></div>`
 +`<div class="mrow">Készítette <input id="tpB" value="${esc(state.bp.by||'Varler Group')}" style="width:220px"></div>`,
  ()=>{state.bp.proj=$('tpP').value;state.bp.addr=$('tpA').value;state.bp.by=$('tpB').value;draw();});
function bpUI(){const on=state.style==='blueprint';$('bpOpts').style.display=on?'flex':'none';
  $('bpDims').checked=state.bp.dims;$('bpTitle').checked=state.bp.title;}
$('bNumber').onclick=()=>autoNumber();$('bCableList').onclick=()=>showCableList();$('bSched').onclick=()=>showSchedule();$('bWireList').onclick=()=>showWireList();
if($('bSwitchRep'))$('bSwitchRep').onclick=()=>showSwitchReport();
$('showRefs').onchange=e=>{state.showRefs=e.target.checked;draw();};
$('lvBase').onchange=e=>{state.levels.basement=e.target.checked;draw();};
$('lvGround').onchange=e=>{state.levels.ground=e.target.checked;draw();};
$('lvUpper').onchange=e=>{state.levels.upper=e.target.checked;draw();};
$('hBase').onchange=e=>{LH.basement=+e.target.value;draw();};
function dcSync(){const l=$('dcLevel').value;$('dcVal').value=DROPC[l]||0;
  const info=$('dcInfo');if(!info)return;
  info.textContent=(DROPC[l]>0)?('Plénum '+plenumMm(l,null)+' mm a födém alatt · a „Álmennyezet" rajzmagasság ide ugrik.')
    :'Nincs álmennyezet ezen a szinten — a rajzmagasság a födém alatt '+DROP_PLENUM+' mm-t feltételez.';}
$('dcLevel').onchange=dcSync;
$('dcVal').onchange=e=>{const l=$('dcLevel').value,v=Math.max(0,+e.target.value||0);
  DROPC[l]=(v>0&&v<wallH(l))?v:0;if(v>=wallH(l))alert('Az álmennyezet nem lehet magasabb a szint belmagasságánál ('+wallH(l)+' mm).');
  dcSync();renderGuides();draw();};
$('dcShow').onchange=e=>{state.showDropCeil=e.target.checked;draw();};
$('dcCol').onchange=e=>{state.dropCol=e.target.value;draw();};
$('dcOp').onchange=e=>{state.dropOp=Math.max(0,Math.min(100,+e.target.value||0));draw();};
dcSync();
$('hGround').onchange=e=>{LH.ground=+e.target.value;draw();};
$('hUpper').onchange=e=>{LH.upper=+e.target.value;draw();};
document.querySelectorAll('input[name=al]').forEach(r=>r.onchange=()=>{if(r.checked)state.active=r.value;});
$('cableType').onchange=e=>{state.cableType=e.target.value;if(draft)draft.type=e.target.value;draw();};
$('pathType').onchange=e=>{state.pathType=e.target.value;if(pathDraft)pathDraft.ptype=e.target.value;};
$('gap').oninput=e=>{GAP=+e.target.value;$('gapV').textContent=(GAP/1000).toFixed(1)+' m';draw();};
$('hideL').onclick=()=>{const el=document.querySelector('.side:not(.r)');el.classList.toggle('hide');$('hideL').textContent=el.classList.contains('hide')?'▶':'◀';};
$('hideR').onclick=()=>{const el=document.querySelector('.side.r');el.classList.toggle('hide');$('hideR').textContent=el.classList.contains('hide')?'◀':'▶';};
$('bPanels').onclick=()=>{const any=document.querySelector('.side:not(.hide)');document.querySelectorAll('.side').forEach(el=>el.classList.toggle('hide',!!any));$('bPanels').textContent=any?'⤡ Panels':'⤢ Full view';};
$('drawH').onchange=e=>{state.freeHeight=false;state.drawHKey=e.target.value;syncHeightUI();if(typeof renderGuides==='function')renderGuides();};
$('devType').onchange=e=>{};$('buildType').onchange=e=>state.buildType=e.target.value;
$('lblShow').onchange=e=>{state.showLabels=e.target.checked;draw();};
$('lblSize').oninput=e=>{state.labelSize=+e.target.value;draw();};
$('lblRot').oninput=e=>{state.labelRot=+e.target.value;$('lblRotV').textContent=state.labelRot+'°';draw();};
$('waste').onchange=e=>{state.waste=+e.target.value||0;renderBOM();};
$('wallThick').onchange=e=>state.wallThick=+e.target.value||100;
$('wallErase').onchange=e=>{state.wallErase=e.target.checked;};
$('wallLock').onchange=e=>{state.wallLock=e.target.checked;lock=null;};
if($('fineBtn'))$('fineBtn').onclick=fineToggle;
$('midFree').onchange=e=>{state.midFree=e.target.checked;lock=null;
  $('hud').textContent=e.target.checked?'Köztes magasságokban szabad rajzolás — a falhoz kötés csak Padló/Mennyezet szinten él.':'Falhoz kötés a köztes magasságokban visszakapcsolva.';draw();};
$('view3d').onclick=()=>{const was2d=state.pitch>=88;
  if(was2d){                                   // 2D → 3D: park the 2D camera, restore the last 3D one
    state.cam2d=camSnap();
    const c=state.cam3d;state.pitch=(c&&c.pitch!=null&&c.pitch<88)?c.pitch:(state.lastPitch||30);state.flat=false;
    if(c)camApply(c);else resetView();
  } else {                                     // 3D → 2D: park the 3D camera, restore the last 2D one
    state.cam3d=camSnap();state.lastPitch=state.pitch;
    const c=state.cam2d;state.pitch=90;state.flat=true;
    if(c)camApply(c);else resetView();}
  $('view3d').textContent=state.pitch>=88?'3D':'2D';draw();
  $('hud').textContent=(state.pitch>=88?'2D felülnézet':'3D nézet')+' — a másik nézet kamerája megmaradt.';};
$('styleToggle').onclick=()=>{const toBlueprint=state.style!=='blueprint';
  state.style=toBlueprint?'blueprint':'normal';$('style').value=state.style;bpUI();
  $('styleToggle').classList.toggle('on',toBlueprint);
  if(toBlueprint&&state.pitch<88){state.pitch=90;state.flat=true;$('view3d').textContent='3D';resetView();
    $('hud').textContent='Hivatalos (blueprint) nézet — 2D felülnézetre váltottam.';}
  else $('hud').textContent=toBlueprint?'Hivatalos (blueprint) nézet.':'Normál nézet.';
  draw();};
$('bRiserUp').onclick=()=>riser(1);$('bRiserDn').onclick=()=>riser(-1);
function riser(dir){let i=ORD.indexOf(state.active)+dir;if(i<0||i>2)return;state.active=ORD[i];
  document.querySelector(`input[name=al][value=${ORD[i]}]`).checked=true;$('hud').textContent='Active level → '+ORD[i]+' (riser continues here).';}
const UKEYS=['cables','paths','devices','notes','measures','openings','floors','objects','roofs','wallNotes'];
// per-surface note visibility travels with the project but is a map, not a list
function noteHideSnap(){return JSON.parse(JSON.stringify(data.noteHide||{}));}
// A snapshot may be SCOPED to the collections a command actually touches. Moving a
// device no longer deep-clones every lamp thumbnail in the project; the entry records
// its own scope so applySnap restores exactly what it captured.
function snap_(scope){ensureIds(data);                  // nothing is snapshotted without an id
  const keys=(scope&&scope.length)?scope.filter(k=>UKEYS.indexOf(k)>=0):UKEYS;
  const o=keys.reduce((o,k)=>(o[k]=data[k],o),{});
  o.__scope=(scope&&scope.length)?keys.slice():null;
  if(!scope||scope.indexOf('__walls')>=0||!scope.length){o.__walls={};for(const l of ORD)o.__walls[l]=WALLS[l]||[];}
  o.__noteHide=data.noteHide||{};o.__seq=data.seq||0;o.__v=data.v||SCHEMA_VERSION;
  return JSON.parse(JSON.stringify(o));}
function snapBytes(sn){try{return JSON.stringify(sn).length;}catch(_){return 0;}}
function applySnap(sn){
  const keys=sn.__scope||UKEYS;                          // a scoped entry restores only what it holds
  keys.forEach(k=>{if(sn[k])data[k]=sn[k];});
  if(sn.__noteHide)data.noteHide=sn.__noteHide;
  data.seq=Math.max(+sn.__seq||0,data.seq||0);data.v=sn.__v||SCHEMA_VERSION;   // ids must never be reissued
  pruneLinks();
  if(sn.__walls){for(const l of ORD){WALLS[l]=(sn.__walls[l]||[]).map(wr);SNAP[l]=centerlines(WALLS[l]);}}
  reselectAfterSnap();}
// applySnap rebuilds every wall object, so anything holding a wall REFERENCE — the
// selection, a gizmo drag — would silently keep editing an orphan. Re-resolve by
// geometry, and drop selections whose piece no longer exists.
function reselectAfterSnap(){
  if(typeof selected==='undefined'||!selected)return;
  if(selected.t==='wall'){const l=selected.level||state.active,r=selected.ref;
    const hit=(WALLS[l]||[]).find(w=>w&&r&&((r.id&&w.id===r.id)||
      (!r.id&&w.x0===r.x0&&w.y0===r.y0&&w.x1===r.x1&&w.y1===r.y1)));
    if(hit)selected.ref=hit;else selected=null;return;}
  const arr=data[selected.t];
  if(Array.isArray(arr)){if(selected.i==null||selected.i>=arr.length)selected=null;}}
function doUndo(){if(!undo.length){$('hud').textContent='Nincs mit visszavonni.';return;}
  const sn=undo.pop();redo.push(snap_(sn.__scope));applySnap(sn);draw();
  $('hud').textContent='Visszavonva ('+undo.length+' lépés maradt).';}
function doRedo(){if(!redo.length){$('hud').textContent='Nincs mit újra végrehajtani.';return;}
  const sn=redo.pop();undo.push(snap_(sn.__scope));applySnap(sn);draw();}
function historyBytes(){let n=0;undo.forEach(s=>n+=snapBytes(s));redo.forEach(s=>n+=snapBytes(s));return n;}
$('bUndo').onclick=doUndo;
$('bRedo').onclick=doRedo;
function pushUndo(scope){undo.push(snap_(scope));if(undo.length>80)undo.shift();redo.length=0;}
// the most common edits touch one collection; naming it keeps the history small
const UNDO_SCOPE={dev:['devices'],path:['paths'],devPath:['devices','paths'],note:['wallNotes'],
          obj:['objects'],open:['openings'],floor:['floors']};
$('bReset').onclick=()=>{state.zoom=.5;state.panX=(1-.5)*W/2;state.panY=(1-.5)*Hh/2;setTransform();};

// height guide editor
function renderGuides(){const box=$('guideBox');if(!box)return;const level=state.active;
  box.innerHTML=GUIDES.map(gd=>{const mm=resolveMm(gd,level);const active=(!state.freeHeight&&state.drawHKey===gd.k);
    return `<div class="grow" data-g="${gd.k}" style="display:flex;align-items:center;gap:4px;padding:2px 3px;border-radius:5px;${active?'background:#f0ede4':''}">`
      +`<button class="gvis" data-g="${gd.k}" title="vonal láthatóság" style="font-size:12px;padding:1px 3px">${gd.vis?'👁':'🚫'}</button>`
      +`<button class="gjump" data-g="${gd.k}" title="↑/↓ ide ugorjon" style="font-size:11px;padding:1px 3px;opacity:${gd.jump!==false?1:0.35}">⭱</button>`
      +`<span class="swatch" style="background:${gd.c};width:11px;height:11px;border-radius:2px;flex:none"></span>`
      +`<span class="gname" data-g="${gd.k}" title="dupla-katt átnevez" style="flex:1;font-size:11.5px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(gd.l)}</span>`
      +`<span style="font-size:10px;color:#999;min-width:42px;text-align:right">${mm} mm</span>`
      +`<button class="gpick" data-g="${gd.k}" title="rajz erre a magasságra" style="font-size:10.5px;padding:1px 4px">${active?'●':'○'}</button>`
      +`<button class="greset" data-g="${gd.k}" title="eredeti magasság" style="font-size:10px;padding:1px 3px">↺</button>`
      +(gd.sys?'':`<button class="gdel" data-g="${gd.k}" title="törlés" style="font-size:10px;padding:1px 3px;color:#b33">✕</button>`)
      +`</div>`;}).join('');
  box.querySelectorAll('.gvis').forEach(b=>b.onclick=()=>{const g=guideByKey(b.dataset.g);g.vis=!g.vis;renderGuides();draw();});
  box.querySelectorAll('.gjump').forEach(b=>b.onclick=()=>{const g=guideByKey(b.dataset.g);g.jump=(g.jump===false);renderGuides();});
  box.querySelectorAll('.gpick').forEach(b=>b.onclick=()=>{state.freeHeight=false;state.drawHKey=b.dataset.g;syncHeightUI();renderGuides();draw();});
  box.querySelectorAll('.greset').forEach(b=>b.onclick=()=>{const d0=GUIDES_DEFAULT.find(x=>x.k===b.dataset.g);const g=guideByKey(b.dataset.g);
    if(d0){g.mm=d0.mm;g.l=d0.l;}else{openModal('Magasság (mm)',`<div class="mrow"><input id="ghmm" type="number" value="${typeof g.mm==='number'?g.mm:0}" style="width:90px"> mm</div>`,()=>{g.mm=+$('ghmm').value||0;renderGuides();draw();});return;}
    renderGuides();draw();});
  box.querySelectorAll('.gdel').forEach(b=>b.onclick=()=>{GUIDES=GUIDES.filter(x=>x.k!==b.dataset.g);if(state.drawHKey===b.dataset.g)state.drawHKey='s1100';rebuildDrawH();renderGuides();draw();});
  box.querySelectorAll('.gname').forEach(sp=>sp.ondblclick=()=>{const g=guideByKey(sp.dataset.g);
    openModal('Átnevezés + magasság',`<div class="mrow">Név <input id="grn" value="${esc(g.l)}" style="width:100%"></div>`
      +(g.sys?'':`<div class="mrow">Magasság <input id="grmm" type="number" value="${typeof g.mm==='number'?g.mm:0}" style="width:90px"> mm</div>`)
      +`<div class="mrow">Szín <input id="grc" type="color" value="${g.c}" style="width:44px;height:24px"></div>`,
      ()=>{g.l=$('grn').value||g.l;if(!g.sys&&$('grmm'))g.mm=+$('grmm').value||0;g.c=$('grc').value;rebuildDrawH();renderGuides();draw();});});}
function rebuildDrawH(){const sel=$('drawH');if(!sel)return;sel.innerHTML=GUIDES.map(g=>`<option value="${g.k}">${esc(g.l)}</option>`).join('');sel.value=state.drawHKey;}
(function initGuides(){renderGuides();rebuildDrawH();})();
$('addG').onclick=()=>{const v=+$('custG').value;if(v>0){const nm=$('custGName').value.trim()||('Egyéni '+v);
  const k='g'+Date.now();GUIDES.push({k,mm:v,l:nm,c:'#7a5cc0',vis:false,jump:true});
  $('custG').value='';$('custGName').value='';rebuildDrawH();renderGuides();draw();}};
if($('freeHeightChk'))$('freeHeightChk').onchange=e=>{state.freeHeight=e.target.checked;if(state.freeHeight&&!state.freeMm)state.freeMm=drawHmm(state.active);syncHeightUI();renderGuides();draw();};
if($('freeMmUp'))$('freeMmUp').onclick=()=>stepHeight(1);
if($('freeMmDn'))$('freeMmDn').onclick=()=>stepHeight(-1);
// circuit visibility
(function(){/* built into totals swatches; add quick toggles under Cable? keep simple: all on */})();

// BOM / save / load / export
$('bBOM').onclick=()=>{const t=bomText();navigator.clipboard.writeText(t).then(()=>alert('BOM copied.'),()=>alert(t));};
$('bBOMcsv').onclick=()=>download('bom.csv',bomCSV());
$('bBOMj').onclick=()=>download('bom.json',JSON.stringify(bomJSON(),null,2));
$('bSave').onclick=()=>{for(const l of ORD)B.walls[l]=(WALLS[l]||[]).map(rectArr);
  download('villanyterv.json',JSON.stringify({state,LH,DROPC,GAP,guides:GUIDES,data,building:B,layers,panelLoc},null,2));};
$('bLoad').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);
  Object.assign(state,o.state);Object.assign(LH,o.LH||{});Object.assign(DROPC,o.DROPC||{});if(typeof o.GAP==='number')GAP=o.GAP;if(o.guides&&Array.isArray(o.guides)){GUIDES=o.guides;}else if(o.guideOn){GUIDES.forEach(g=>{if(o.guideOn[g.k]!=null)g.vis=!!o.guideOn[g.k];});(o.customG||[]).forEach(v=>GUIDES.push({k:'g'+Math.random().toString(36).slice(2),mm:v,l:'Egyéni '+v,c:'#7a5cc0',vis:true,jump:true}));}if(typeof renderGuides==='function')renderGuides();if(typeof rebuildDrawH==='function')rebuildDrawH();
  if(o.layers)layers=o.layers;if(o.panelLoc)panelLoc=o.panelLoc;if(o.building)loadBuilding(o.building,true);
  UKEYS.forEach(k=>data[k]=(o.data&&o.data[k])||[]);syncUI();renderLayers();if(typeof renderDashboard==='function')renderDashboard();draw();}catch(err){alert('Bad file');}};r.readAsText(f);};
function syncUI(){setRot(state.rot);$('style').value=state.style;$('wallMode').value=state.wallMode;$('explode').checked=state.exploded;
  if($('styleToggle'))$('styleToggle').classList.toggle('on',state.style==='blueprint');
  $('lvBase').checked=state.levels.basement;$('lvGround').checked=state.levels.ground;$('lvUpper').checked=state.levels.upper;
  $('hBase').value=LH.basement;$('hGround').value=LH.ground;$('hUpper').value=LH.upper;if(typeof dcSync==='function')dcSync();
  document.querySelector(`input[name=al][value=${state.active}]`).checked=true;$('cableType').value=state.cableType;$('drawH').value=state.drawHKey;
  $('lblShow').checked=state.showLabels;$('lblSize').value=state.labelSize;$('lblRot').value=state.labelRot;$('lblRotV').textContent=state.labelRot+'°';
  $('waste').value=state.waste;$('wallLock').checked=state.wallLock;if($('midFree'))$('midFree').checked=!!state.midFree;if($('dcShow'))$('dcShow').checked=state.showDropCeil!==false;
  if($('dcCol'))$('dcCol').value=state.dropCol||'#cfd8dc';
  if($('dcOp'))$('dcOp').value=(state.dropOp!=null?state.dropOp:50);
  if(typeof dcSync==='function')dcSync();if(state.pitch==null)state.pitch=30;$('view3d').textContent=state.pitch>=88?'3D':'2D';
  $('pathType').value=state.pathType;$('gap').value=GAP;$('gapV').textContent=(GAP/1000).toFixed(1)+' m';
  $('guideBox').querySelectorAll('input').forEach(c=>c.checked=!!guideOn[c.dataset.g]);
  if($('isoGrid'))$('isoGrid').checked=state.isoGrid;if(typeof bpUI==='function'){if(!state.bp)state.bp={dims:true,title:true,proj:'',addr:'',by:''};bpUI();}if($('showRefs'))$('showRefs').checked=state.showRefs;if($('hDisp'))$('hDisp').value=state.hDisp||'hover';if($('gizSnap'))$('gizSnap').checked=state.gizmoSnap!==false;if($('objWallSnap'))$('objWallSnap').checked=state.objWallSnap!==false;if($('multiSel'))$('multiSel').checked=!!state.multiSelect;if($('autoLayout'))$('autoLayout').classList.toggle('on',autoLayout);if(typeof renderLayers==='function')renderLayers();}
function download(n,t){const b=new Blob([t],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u);}
function exportPNG(grey){const clone=stage.cloneNode(true);clone.setAttribute('width',1754);clone.setAttribute('height',1240);
  const xml=new XMLSerializer().serializeToString(clone);const img=new Image();
  img.onload=()=>{const cv=document.createElement('canvas');cv.width=1754;cv.height=1240;const cx=cv.getContext('2d');
    cx.fillStyle='#fff';cx.fillRect(0,0,1754,1240);if(grey)cx.filter='grayscale(1) contrast(1.05)';cx.drawImage(img,0,0,1754,1240);
    cv.toBlob(bl=>{const u=URL.createObjectURL(bl);const a=document.createElement('a');a.href=u;a.download=grey?'terv_A4_grey.png':'terv_A4.png';a.click();URL.revokeObjectURL(u);});};
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);}
$('bPNG').onclick=()=>exportPNG(false);$('bPNGg').onclick=()=>exportPNG(true);$('bPrint').onclick=()=>window.print();


// test hooks
window.reselectAfterSnap=reselectAfterSnap;window.snapBytes=snapBytes;window.edDragScopeRef=()=>UNDO_SCOPE;window.historyBytes=historyBytes;window.UNDO_SCOPE=UNDO_SCOPE;
