// ==========================================================================
// 08-interaction.js — pointer and keyboard handling, gizmo, format painter, touch
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// interaction ////////////////////
const $=id=>document.getElementById(id);
const HINTS={select:'Select — drag pan, wheel zoom. Click cable/device to delete. Right-click object/wall for menu.',
 path:'Path — draw the empty pathway (snaps to wall & height, Ctrl flips side, ↑/↓ height, ←/→ rotate). Right-click a section for build/circuit/kötődoboz/parallel. Enter finish.',
 cable:'Cable — snaps along the locked wall; Ctrl flips to the other side (sticky). ↑/↓ height line · ←/→ rotate · Space kötődoboz · Enter finish · Esc cancel.',
 device:'Device — click to drop the selected symbol on the active level.',
 wall:'Wall — click two points to draw a wall on the active level (axis-aligned). Tick radír to erase by clicking. Right-click a wall to delete.',
 build:'Build — click a wall to place the selected object; it snaps & aligns. Right-click it to Rotate/Delete.',
 format:'Formátummásoló — 1) jelölj ki egy forráselemet (Select vagy kattints rá itt), 2) kattints egy AZONOS TÍPUSÚ elemre, hogy átvegye a forma-jellemzőit (méret, típus, magasság). Ajtó→ajtó, ablak→ablak, objektum→objektum, stb.',
 grab:'Move (KSP-mód) — kattints bármely elemre (fal, padló, ajtó, ablak, lépcső, tető, objektum). Nyilak: eltolás · kék gyűrű: forgatás · lila: emelés · sárga sarok: átméretezés. Billentyű: WASD tol, Q/E forgat, ↑/↓ emel, Del töröl, Ctrl+D másol.',
 object:'Object — pick an item in the Objects panel, then click to place. Select it to move with WASD, rotate Q/E, lift ↑/↓; right-click for size.',
 roof:'Roof — click two points to span a roof over that area, then pick type (lapos/félnyereg/nyereg/konty), eave + ridge height and overhang. Right-click it to edit.',
 floor:'Floor — click two points to drop a floor section on the active level. Draw walls on it to make a room. Backspace cancels.',
 measure:'Measure — click two points for the distance.',note:'Note — click a spot, then type text. Tip: hold LEFT+RIGHT mouse to pan while drawing; Backspace = undo last click.'};
function setMode(m){state.mode=m;draft=null;pathDraft=null;measureDraft=null;wallStart=null;floorStart=null;roofStart=null;dragItem=null;objGhost=null;buildGhost=null;gizDrag=null;lock=null;state.hoverR=null;if(m!=='format')fmtSource=null;else if(selected){pickFormatSource(selected);if(fmtSource)$('hud').textContent='Forrás: '+fmtSource.label+' — kattints egy azonos típusú elemre.';}if(m!=='grab'&&m!=='select'&&m!=='format')selected=null;if(m!=='grab'&&m!=='select')clearMulti();hideCtx();
  document.querySelectorAll('.tool[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  const wo=$('wallOpts');if(wo)wo.style.display=(m==='wall')?'flex':'none';
  $('modeHint').textContent=HINTS[m];$('modeTip').textContent=HINTS[m];if(window.__dashReady)applyToolLayout(m);
  // 2.0-a: tell a connected phone the tool changed. Self-suppressing —
  // returns immediately if nothing changed or no phone asked for state.
  if(window.PLANNER_LINK)window.PLANNER_LINK.pushState(false);
  if(window.NOTES)window.NOTES.onMode(m);   // 10b-notes.js: open the note panel with the tool
  draw();}
document.querySelectorAll('.tool[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));

let dragging=false,last=null,moved=false,selected=null,pendingRoute=null,camDrag=null,ctxSuppress=false,autoLayout=true,gizDrag=null;
let selMulti=[];   // array of hit-handles {t,i} or {t:'wall',level,ref} — the multi-selection
let selBox=null;   // {x0,y0,x1,y1} in client px while drag-box selecting
let ctrlToggle=null; // pending ctrl+click that may become a ctrl+drag clone
function hEq(a,b){if(!a||!b)return false;if(a.t!==b.t)return false;
  if(a.t==='wall')return a.ref===b.ref; return a.i===b.i;}
function inMulti(h){return selMulti.some(x=>hEq(x,h));}
function addMulti(h){if(!h)return;if(!inMulti(h))selMulti.push(h);}
function toggleMulti(h){if(!h)return;const i=selMulti.findIndex(x=>hEq(x,h));if(i>=0)selMulti.splice(i,1);else selMulti.push(h);}
function clearMulti(){selMulti=[];}
// all currently-selected handles (single `selected` folded in)
function selList(){const out=selMulti.slice();if(selected&&!inMulti(selected))out.unshift(selected);return out;}
// centroid of a set of handles (plan coords)
function groupCentroid(list){let sx=0,sy=0,n=0;list.forEach(h=>{const c=pGetC(h);if(c){sx+=c[0];sy+=c[1];n++;}});return n?[sx/n,sy/n]:[0,0];}
// move the whole group by dx,dy (plan)
function moveGroup(list,dx,dy){list.forEach(h=>{const c=pGetC(h);pSetC(h,c[0]+dx,c[1]+dy);});
  const lv=new Set(list.filter(h=>h.t==='wall').map(h=>h.level));lv.forEach(l=>SNAP[l]=centerlines(WALLS[l]));}
// rotate the whole group by angle (rad) about a pivot (plan)
function rotateGroup(list,ang,piv){const cs=Math.cos(ang),sn=Math.sin(ang);
  list.forEach(h=>{const c=pGetC(h);const dx=c[0]-piv[0],dy=c[1]-piv[1];
    pSetC(h,piv[0]+dx*cs-dy*sn,piv[1]+dx*sn+dy*cs);
    // also spin each piece about its own centre so it stays oriented with the group
    if(h.t==='objects'||h.t==='openings')pRot(h,ang);});
  const lv=new Set(list.filter(h=>h.t==='wall').map(h=>h.level));lv.forEach(l=>SNAP[l]=centerlines(WALLS[l]));}
function cloneMulti(list){const out=[];list.forEach(h=>{const nh=clonePiece(h);if(nh)out.push(nh);});return out;}
stage.addEventListener('pointerdown',e=>{lampHoverHide();hideCtx();
  if((e.buttons&3)===3){camDrag={m:'pitch',moved:false};last=[e.clientX,e.clientY];try{stage.setPointerCapture(e.pointerId);}catch(_){}return;}
  if(e.button===2){camDrag={m:'yaw',moved:false};last=[e.clientX,e.clientY];try{stage.setPointerCapture(e.pointerId);}catch(_){}return;}
  if(e.button!==0)return;
  if(state.lockTouch){ // building locked — left-drag pans, no piece selection/drawing
    dragging=true;bothPan=true;moved=false;last=[e.clientX,e.clientY];selected=null;clearMulti();
    try{stage.setPointerCapture(e.pointerId);}catch(_){}return;}
  if(state.mode==='format'){
    const h=hitTest(e);
    if(!h){ $('hud').textContent=fmtSource?'Kattints egy azonos típusú elemre a másoláshoz.':'Kattints egy forráselemre (objektum, ajtó, ablak, fal…).'; return; }
    if(!fmtSource){ pickFormatSource(h); selected=h; draw();
      $('hud').textContent='Forrás: '+fmtSource.label+' — most kattints egy AZONOS típusú elemre.'; return; }
    // second click: apply to the target (if same type)
    applyFormat(h); draw(); return;}
  if(state.mode==='grab'){
    const g=e.target&&e.target.closest?e.target.closest('.giz'):null;
    if(g&&(selected||selList().length)){pushUndo();gizDrag={ax:g.dataset.ax,rd:g.dataset.rd||'',sg:+(g.dataset.sg||0),cx:+(g.dataset.cx||0),cy:+(g.dataset.cy||0),
      last:[e.clientX,e.clientY],startC:selected?pGetC(selected):groupCentroid(selList()),startWD:selected?pGetWD(selected):[0,0],startZ:selected?pGetZ(selected):0,
      group:selList().length>1?selList():null,piv:groupCentroid(selList())};
      try{stage.setPointerCapture(e.pointerId);}catch(_){}return;}
    const h=hitTest(e);
    // Ctrl+click toggles a piece in the multi-selection (unless it turns into a drag → clone below)
    if(h&&e.ctrlKey){selected=h;moved=false;last=[e.clientX,e.clientY];dragging=false;ctrlToggle={h,client:[e.clientX,e.clientY]};
      try{stage.setPointerCapture(e.pointerId);}catch(_){}return;}
    if(h){
      // clicking a piece already in a multi-set → drag the whole group; else select just this one
      if(inMulti(h)&&selList().length>1){gizDrag={ax:'move',last:[e.clientX,e.clientY],startC:groupCentroid(selList()),
        grab:baseToPlan(...clientToBase(e),dz(pieceLevel(h),pGetZ(h))),group:selList()};selected=h;
        try{stage.setPointerCapture(e.pointerId);}catch(_){}draw();return;}
      clearMulti();selected=h;draw();try{stage.setPointerCapture(e.pointerId);}catch(_){}
      gizDrag={ax:'move',last:[e.clientX,e.clientY],startC:pGetC(h),grab:baseToPlan(...clientToBase(e),dz(pieceLevel(h),pGetZ(h)))};return;}
    // empty click → start a drag-box selection (or clear)
    if(!e.ctrlKey){selected=null;clearMulti();}
    selBox={x0:e.clientX,y0:e.clientY,x1:e.clientX,y1:e.clientY};dragging=true;moved=false;last=[e.clientX,e.clientY];
    try{stage.setPointerCapture(e.pointerId);}catch(_){}return;}
  if(state.mode==='select'){const h=hitTest(e);
    if(switchPick&&h&&h.t==='devices'){const D=data.devices[switchPick.di];D.swMap=D.swMap||{};D.swMap[switchPick.term]=devIdOf(h.i);
      const di=switchPick.di;switchPick=null;$('modeHint').textContent=HINTS.select;draw();editSwitchType(di);return;}
    if(pendingRoute&&h&&h.t==='devices'){routeDevice(pendingRoute.dev,'pick',data.devices[h.i]);pendingRoute=null;$('modeHint').textContent=HINTS.select;return;}
    if(h&&e.ctrlKey){ // Ctrl: toggle multi on click, or clone on drag — decide on move
      selected=h;last=[e.clientX,e.clientY];moved=false;ctrlToggle={h,client:[e.clientX,e.clientY]};dragItem=null;
      try{stage.setPointerCapture(e.pointerId);}catch(_){}draw();return;}
    if(h){
      if(inMulti(h)&&selList().length>1){dragItem={h,pushed:false,group:selList(),grab:baseToPlan(...clientToBase(e),dz(pieceLevel(h),pGetZ(h)))};selected=h;}
      else{clearMulti();dragItem={h,pushed:false};selected=h;}
      moved=false;last=[e.clientX,e.clientY];try{stage.setPointerCapture(e.pointerId);}catch(_){}return;}
    selected=null;clearMulti();
    if(state.multiSelect){selBox={x0:e.clientX,y0:e.clientY,x1:e.clientX,y1:e.clientY};dragging=true;}
    else{dragging=true;} // multi-select off → empty drag pans the view
    moved=false;last=[e.clientX,e.clientY];try{stage.setPointerCapture(e.pointerId);}catch(_){}return;}
  if(state.mode==='cable'){const p=cableSnap(e);if(!draft){pushUndo();draft={type:state.cableType,nodes:[],layer:curLayer()};}draft.nodes.push({level:p.level,x:p.x,y:p.y,h:p.h});draw();}
  else if(state.mode==='path'){const p=cableSnap(e);if(!pathDraft){pushUndo();pathDraft={ptype:state.pathType,nodes:[],sections:[],layer:curLayer()};}
    if(pathDraft.nodes.length)pathDraft.sections.push({build:'sull_gege',circuit:null});
    pathDraft.nodes.push({level:p.level,x:p.x,y:p.y,h:p.h});draw();}
  else if(state.mode==='device'){const p=cableSnap(e);const ty=$('devType').value;pushUndo();
    const dev={type:ty,level:p.level,x:p.x,y:p.y,h:p.h,layer:curLayer(),ref:nextRef(ty)};
    if(p.wall){dev.side=state.side?1:0;}   // remember which wall side (like path sections)
    data.devices.push(dev);draw();}
  else if(state.mode==='wall'){
    if(state.wallErase){const r=wallHitRect(e);if(r){pushUndo();const a=WALLS[state.active];a.splice(a.indexOf(r),1);SNAP[state.active]=centerlines(a);draw();}return;}
    const p=wallPointSnap(e,wallStart);
    if(!wallStart){wallStart=p;$('hud').textContent='Fal: kattints a második pontra (Esc/Backspace = mégse)';}
    else{const len=Math.hypot(p[0]-wallStart[0],p[1]-wallStart[1]);
      if(len<120){$('hud').textContent='A két pont túl közel van — kattints távolabb.';draw();return;}
      pushUndo();addWall(wallStart,p);wallStart=null;$('hud').textContent='Fal létrehozva.';}
    draw();}
  else if(state.mode==='object'){placeObject(e);}
  else if(state.mode==='floor'){const p=wallPointSnap(e);if(!floorStart)floorStart=p;else{pushUndo();addFloor(floorStart,p);floorStart=null;}draw();}
  else if(state.mode==='roof'){const p=wallPointSnap(e);if(!roofStart)roofStart=p;else{addRoof(roofStart,p);roofStart=null;}draw();}
  else if(state.mode==='build'){const w=snapWall(e,state.active,0);if(w){pushUndo();const o={type:state.buildType,level:state.active,x:w.x,y:w.y,ang:w.ang,variant:0,layer:curLayer()};if(state.buildType==='stairs')Object.assign(o,state.stairDef);data.openings.push(o);draw();}}
  else if(state.mode==='note'){const p=snap(e,state.active);const t=prompt('Note:');if(t){pushUndo();data.notes.push({level:p.level,x:p.x,y:p.y,text:t,layer:curLayer()});}draw();}
  else if(state.mode==='measure'){const p=snap(e,state.active);if(!measureDraft)measureDraft=[{level:p.level,x:p.x,y:p.y}];
    else{measureDraft.push({level:p.level,x:p.x,y:p.y});pushUndo();data.measures.push(measureDraft);measureDraft=null;}draw();}});
stage.addEventListener('pointermove',e=>{lastPtr=[e.clientX,e.clientY];
  if(state.mode==='select'||state.mode==='grab'){const li=lampAt(e.clientX,e.clientY);
    if(li!=null)lampHoverShow(data.devices[li],e.clientX,e.clientY);else lampHoverHide();}
  else lampHoverHide();
  const bts=e.buttons&3;
  if(bts===3||bts===2){ // 3 = both -> pitch, 2 = right only -> yaw
    if(!camDrag){camDrag={m:bts===3?'pitch':'yaw',moved:false,pivotCursor:pivotAtCursor(e)};last=[e.clientX,e.clientY];return;}
    camDrag.m=(bts===3)?'both':'yaw';
    const dx=e.clientX-last[0],dy=e.clientY-last[1];
    if(Math.abs(dx)+Math.abs(dy)>2){camDrag.moved=true;ctxSuppress=true;}
    if(Math.abs(dx)>0.5&&!camDrag.pivotCursor)recentrePivot();
    if(camDrag.m==='yaw'){setRot(state.rot+dx*0.45);}
    else{if(!camDrag.pivotCursor)recentrePivot();setRot(state.rot+dx*0.45);setPitch(state.pitch-dy*0.35);}
    if(camDrag.pivotCursor){const now=planToBase(CXv,CYv,dz(state.active,0));state.panX=W/2-now[0]*state.zoom;state.panY=Hh/2-now[1]*state.zoom;setTransform();}
    last=[e.clientX,e.clientY];return;}
  if(camDrag)camDrag=null;
  // Ctrl held on a piece: a small drag turns the ctrl-click into a clone (Ctrl+drag = copy)
  if(ctrlToggle){const mv=Math.abs(e.clientX-ctrlToggle.client[0])+Math.abs(e.clientY-ctrlToggle.client[1]);
    if(mv>4){const h=ctrlToggle.h;ctrlToggle=null;pushUndo();
      const nh=clonePiece(h);if(nh){selected=nh;clearMulti();dragItem={h:nh,pushed:true};}
      last=[e.clientX,e.clientY];moved=true;return;}
  }
  if(dragItem&&dragItem.group&&dragItem.group.length>1){moved=true;if(!dragItem.pushed){pushUndo();dragItem.pushed=true;}
    const p=baseToPlan(...clientToBase(e),dz(pieceLevel(dragItem.h),pGetZ(dragItem.h)));
    if(!dragItem.gc)dragItem.gc=groupCentroid(dragItem.group);
    if(!dragItem.goff)dragItem.goff=[p[0]-dragItem.gc[0],p[1]-dragItem.gc[1]];
    let ncx=p[0]-dragItem.goff[0],ncy=p[1]-dragItem.goff[1];const g=state.grid?state.gridSize:50;
    ncx=Math.round(ncx/g)*g;ncy=Math.round(ncy/g)*g;
    const cur=groupCentroid(dragItem.group);moveGroup(dragItem.group,ncx-cur[0],ncy-cur[1]);drawSoon();return;}
  if(selBox){selBox.x1=e.clientX;selBox.y1=e.clientY;moved=true;drawSoon();return;}
  if(gizDrag){const h=selected;if(!h){gizDrag=null;return;}
    const lvl2=pieceLevel(h),z2=dz(lvl2,pGetZ(h));
    if(gizDrag.group&&gizDrag.group.length>1){
      if(gizDrag.ax==='move'){const p=baseToPlan(...clientToBase(e),z2);
        let cx=gizDrag.startC[0]+(p[0]-gizDrag.grab[0]),cy=gizDrag.startC[1]+(p[1]-gizDrag.grab[1]);
        if(state.gizmoSnap){const g=state.grid?state.gridSize:100;cx=Math.round(cx/g)*g;cy=Math.round(cy/g)*g;}
        const cur=groupCentroid(gizDrag.group);moveGroup(gizDrag.group,cx-cur[0],cy-cur[1]);drawSoon();return;}
      if(gizDrag.ax==='rot'){const dx=e.clientX-gizDrag.last[0];gizDrag.last=[e.clientX,e.clientY];
        rotateGroup(gizDrag.group,dx*0.02,gizDrag.piv||groupCentroid(gizDrag.group));drawSoon();return;}
    }
    if(gizDrag.ax==='move'){const p=baseToPlan(...clientToBase(e),z2);
      let nx=gizDrag.startC[0]+(p[0]-gizDrag.grab[0]),ny=gizDrag.startC[1]+(p[1]-gizDrag.grab[1]);
      // OBJECT re-snap: if the object is draggable onto a wall, snap it against the wall face + align
      if(h.t==='objects'&&state.objWallSnap&&!isFreeHeight()){
        const o=pieceRef(h),lvl=pieceLevel(h),walls=WALLS[lvl]||[];
        const bp=planToBase(nx,ny,dz(lvl,o.z||0));let best=null;
        walls.forEach(r=>{const dd=wallDist(r,bp[0],bp[1],dz(lvl,o.z||0));if(!best||dd.d<best.d)best=dd;});
        if(best&&best.d<48/state.zoom){const wi=best.wi,t=Math.max(0,Math.min(1,best.t));
          const cxp=wi.seg[0][0]+t*(wi.seg[1][0]-wi.seg[0][0]),cyp=wi.seg[0][1]+t*(wi.seg[1][1]-wi.seg[0][1]);
          const dep=o.d||600,off=(state.side?1:-1)*(wi.thick/2+dep/2);
          nx=cxp+wi.perp[0]*off;ny=cyp+wi.perp[1]*off;o.ang=wi.horiz?0:Math.PI/2;o.onWall=true;
          $('hud').textContent='Falhoz illesztve (Ctrl = másik oldal)';
          pSetC(h,nx,ny);drawSoon();return;}
        else if(o.onWall){o.onWall=false;}
      }
      if(state.gizmoSnap){const g=state.grid?state.gridSize:100;nx=Math.round(nx/g)*g;ny=Math.round(ny/g)*g;}
      pSetC(h,nx,ny);drawSoon();return;}
    const dx=e.clientX-gizDrag.last[0],dy=e.clientY-gizDrag.last[1];gizDrag.last=[e.clientX,e.clientY];
    if(gizDrag.ax==='x'||gizDrag.ax==='y'){const p=baseToPlan(...clientToBase(e),z2),c=pGetC(h);
      if(gizDrag.ax==='x'){let nx=p[0];if(state.gizmoSnap){const g=state.grid?state.gridSize:100;nx=Math.round(nx/g)*g;}pSetC(h,nx,c[1]);}
      else{let ny=p[1];if(state.gizmoSnap){const g=state.grid?state.gridSize:100;ny=Math.round(ny/g)*g;}pSetC(h,c[0],ny);}
      drawSoon();return;}
    if(gizDrag.ax==='rot'){pRot(h,dx*0.02);drawSoon();return;}
    if(gizDrag.ax==='z'){
      let nz=pGetZ(h)-dy*10;
      const st=fineStep(10);nz=Math.round(nz/st)*st;
      if(state.gizmoSnap&&!fineAnchor&&(h.t==='devices'||h.t==='objects')){   // land on a visible height line if close
        GUIDES.forEach(g=>{if(g.vis===false)return;const mm=resolveMm(g,pieceLevel(h));
          if(Math.abs(mm-nz)<40)nz=mm;});}
      pSetZ(h,Math.max(0,nz));
      $('hud').textContent=pZLabel(h)+': '+Math.round(pGetZ(h))+' mm'+(fineAnchor?'   🔍 finom (1 mm)':'');
      drawSoon();return;}
    if(gizDrag.ax==='rs'){const p=baseToPlan(...clientToBase(e),z2),c=pGetC(h);
      const cur=pGetWD(h);let nw=cur[0],nd=cur[1];
      const g=state.gizmoSnap?(state.grid?state.gridSize:50):1;
      if(gizDrag.rd!=='d')nw=Math.max(g,Math.round(Math.abs(p[0]-c[0])*2/g)*g);   // width handle
      if(gizDrag.rd!=='w')nd=Math.max(g,Math.round(Math.abs(p[1]-c[1])*2/g)*g);   // depth handle
      pSetWD(h,nw,nd);
      $('hud').textContent='Méret: '+Math.round(nw)+' × '+Math.round(nd)+' mm';
      drawSoon();return;}
    return;}
  if(dragItem){moved=true;if(!dragItem.pushed){pushUndo();dragItem.pushed=true;}const h=dragItem.h;
    if(h.t==='openings'){const o=data.openings[h.i],w=snapWall(e,o.level,0);
      if(w){const c=openingOnCentreline(w,o.level);o.x=c.x;o.y=c.y;o.ang=w.ang;}}
    else if(h.t==='devices'){const o=data.devices[h.i],p=cableSnap(e);o.x=p.x;o.y=p.y;o.h=p.h;}
    else if(h.t==='notes'){const o=data.notes[h.i],p=snap(e,o.level);o.x=p.x;o.y=p.y;}
    else if(h.t==='objects'){const o=data.objects[h.i],p=objSnap(e);o.x=p.x;o.y=p.y;}
    else if(h.t==='roofs'){const o=data.roofs[h.i],p=baseToPlan(...clientToBase(e),dz(o.level,0));if(!dragItem.off)dragItem.off=[p[0]-(o.x0+o.x1)/2,p[1]-(o.y0+o.y1)/2];const w2=o.x1-o.x0,d2=o.y1-o.y0;o.x0=p[0]-dragItem.off[0]-w2/2;o.x1=o.x0+w2;o.y0=p[1]-dragItem.off[1]-d2/2;o.y1=o.y0+d2;}
    else if(h.t==='wall'){const r=h.ref,p=baseToPlan(...clientToBase(e),dz(h.level,0));
      if(!dragItem.off)dragItem.off=[p[0]-(r.x0+r.x1)/2,p[1]-(r.y0+r.y1)/2];
      const w2=r.x1-r.x0,d2=r.y1-r.y0,gx=state.grid?state.gridSize:50;
      let cx=Math.round((p[0]-dragItem.off[0])/gx)*gx,cy=Math.round((p[1]-dragItem.off[1])/gx)*gx;
      r.x0=cx-w2/2;r.x1=cx+w2/2;r.y0=cy-d2/2;r.y1=cy+d2/2;SNAP[h.level]=centerlines(WALLS[h.level]);}
    drawSoon();return;}
  if(dragging){const dx=e.clientX-last[0],dy=e.clientY-last[1];if(Math.abs(dx)+Math.abs(dy)>2)moved=true;
    state.panX+=dx;state.panY+=dy;last=[e.clientX,e.clientY];setTransform();return;}
  if(state.mode==='cable'||state.mode==='path'||state.mode==='device'){const p=cableSnap(e);cursor=p;state.hoverR=p.wall||null;state.hoverL=state.active;
    const dr=state.mode==='path'?pathDraft:draft;
    let msg=`x ${(p.x/1000).toFixed(2)} · y ${(p.y/1000).toFixed(2)} m · ${p.snap} · h ${(p.h/1000).toFixed(2)} m`;
    if(dr&&dr.nodes.length){const t={nodes:dr.nodes.concat([{level:p.level,x:p.x,y:p.y,h:p.h}])};msg+=`\nrun: ${cableLen(t).toFixed(2)} m`;}
    $('hud').textContent=msg;drawSoon();}
  else if(state.mode==='measure'){const p=snap(e,state.active);cursor=p;
    if(measureDraft&&measureDraft.length){const a=measureDraft[0];const dist=Math.hypot(p.x-a.x,p.y-a.y);
      $('hud').textContent=`táv: ${(dist/1000).toFixed(3)} m · x ${(p.x/1000).toFixed(2)} · y ${(p.y/1000).toFixed(2)}`;drawSoon();}
    else $('hud').textContent=`x ${(p.x/1000).toFixed(2)} · y ${(p.y/1000).toFixed(2)} m`;}
  else if(state.mode==='wall'){const p=wallPointSnap(e,wallStart);cursor={x:p[0],y:p[1],level:state.active,h:0};
    state.hoverR=state.wallErase?wallHitRect(e):null;state.hoverL=state.active;drawSoon();}
  else if(state.mode==='object'){const p=objSnap(e);objGhost={level:p.level,x:p.x,y:p.y,z:p.z||0,gang:(p.ang!=null?p.ang:null),wall:p.wall};drawSoon();}
  else if(state.mode==='build'){const w=snapWall(e,state.active,0);
    buildGhost=w?Object.assign({type:state.buildType,level:state.active,x:w.x,y:w.y,ang:w.ang,variant:0},
      (state.buildType==='stairs'?(state.stairDef||{}):{})):null;
    cursor=w?{x:w.x,y:w.y,level:state.active,h:0}:null;drawSoon();}
  else if(state.mode==='select'&&!dragItem&&!gizDrag){/* hover only */}
  else if(state.mode==='floor'||state.mode==='roof'){const p=wallPointSnap(e);cursor={x:p[0],y:p[1],level:state.active,h:0};drawSoon();}
  else if(state.mode==='select'){const r=wallHitRect(e);if(r!==state.hoverR){state.hoverR=r;state.hoverL=state.active;drawSoon();}}});
stage.addEventListener('pointerup',()=>{
  if(ctrlToggle){ // a ctrl+click that did NOT turn into a drag-clone → toggle multi-selection
    toggleMulti(ctrlToggle.h);selected=inMulti(ctrlToggle.h)?ctrlToggle.h:(selMulti[selMulti.length-1]||null);
    if(selMulti.length)$('hud').textContent=selList().length+' elem kijelölve.';ctrlToggle=null;draw();}
  if(selBox){finishSelBox();selBox=null;}
  dragging=false;bothPan=false;dragItem=null;camDrag=null;gizDrag=null;});
function finishSelBox(){if(!selBox)return;const x0=Math.min(selBox.x0,selBox.x1),x1=Math.max(selBox.x0,selBox.x1),
  y0=Math.min(selBox.y0,selBox.y1),y1=Math.max(selBox.y0,selBox.y1);
  if(Math.abs(x1-x0)<5&&Math.abs(y1-y0)<5)return; // a click, not a box
  // a piece is inside if its centre projects within the box
  const test=(h)=>{const c=pGetC(h);if(!c)return false;const b=planToBase(c[0],c[1],dz(pieceLevel(h),pGetZ(h)));
    const sx=b[0]*state.zoom+state.panX, sy=b[1]*state.zoom+state.panY;return sx>=x0&&sx<=x1&&sy>=y0&&sy<=y1;};
  const hits=[];
  ['objects','devices','openings','roofs','floors','notes'].forEach(t=>{(data[t]||[]).forEach((o,i)=>{
    if(o.level&&!state.levels[o.level])return;const h={t,i};if(test(h))hits.push(h);});});
  (WALLS[state.active]||[]).forEach(r=>{const h={t:'wall',level:state.active,ref:r};if(test(h))hits.push(h);});
  hits.forEach(addMulti);
  if(selMulti.length){selected=selMulti[0];$('hud').textContent=selMulti.length+' elem kijelölve (mozgatás/forgatás együtt).';}
  draw();}
stage.addEventListener('dblclick',()=>{if(state.mode==='cable')finishCable();else if(state.mode==='path')finishPath();});
const TOOLKEYS=['select','grab','device','cable','wall','build','object','floor','roof','format'];
// ---- FORMAT PAINTER (Formátummásoló) ----
// copies the "form" of a source piece onto a same-type target. Which props = form:
function formProps(t){return {
  openings:['type','w','h','sill','variant'],           // door↔door, window↔window (type must match)
  objects :['w','d','ht','name'],                        // size + kind
  devices :['type','h','side'],                          // kind + mount height + wall side
  wall    :['h'],                                        // wall height override + thickness
  floors  :['mat','fill'],                               // material/finish
  roofs   :['rtype','eave','ridge','ovh','dir'],
  stairs  :['w','riser','going','th']
}[t]||[];}
function pieceFormType(h){if(!h)return null;
  if(h.t==='openings'){const o=pieceRef(h);return o?('openings:'+o.type):'openings';} // door vs window vs stairs distinct
  return h.t;}
let fmtSource=null; // {h, type, snapshot}
function pickFormatSource(h){const o=pieceRef(h);if(!o){fmtSource=null;return;}
  const t=h.t;const keys=formProps(t==='openings'&&o.type==='stairs'?'stairs':t);
  const snap={};keys.forEach(k=>{if(o[k]!==undefined)snap[k]=o[k];});
  // walls: also copy thickness (derived from rect) — store as target-applied resize
  if(t==='wall'){const [w,dd]=pGetWD(h);snap.__thick=Math.min(w,dd);}
  fmtSource={ft:pieceFormType(h),t,snap,label:pLabel(h)};}
function applyFormat(h){if(!fmtSource){return false;}
  if(pieceFormType(h)!==fmtSource.ft){$('hud').textContent='Nem egyező típus — '+fmtSource.label+' → csak azonos típusra másolható.';return false;}
  const o=pieceRef(h);if(!o)return false;pushUndo();
  Object.keys(fmtSource.snap).forEach(k=>{if(k.startsWith('__'))return;o[k]=fmtSource.snap[k];});
  // wall thickness: apply by resizing footprint's short axis, keeping length + centre
  if(fmtSource.t==='wall'&&fmtSource.snap.__thick){const [w,dd]=pGetWD(h),long=Math.max(w,dd),th=fmtSource.snap.__thick;
    pSetWD(h, w>=dd?long:th, w>=dd?th:long);SNAP[h.level]=centerlines(WALLS[h.level]);}
  draw();$('hud').textContent='Formátum másolva ('+fmtSource.label+').';return true;}
function setPitch(v){state.pitch=Math.max(5,Math.min(90,v));state.flat=state.pitch>=88;
  $('view3d').textContent=state.pitch>=88?'3D':'2D';$('hud').textContent='Kameradőlés: '+Math.round(state.pitch)+'°';draw();}
function panBy(dx,dy){state.panX+=dx;state.panY+=dy;setTransform();}
function zoomBy(f){state.zoom=Math.max(0.15,Math.min(5,state.zoom*f));setTransform();}
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){draft=null;pathDraft=null;measureDraft=null;wallStart=null;floorStart=null;roofStart=null;lock=null;state.hoverR=null;dragItem=null;selected=null;pendingRoute=null;clearMulti();selBox=null;hideCtx();closeModal();if(state.mode!=='select')setMode('select');draw();return;}
  const tag=(e.target&&e.target.tagName)||'';if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return; // don't hijack while typing
  if(state.lockTouch){ // locked: allow camera keys (WASD/QE/arrows) + undo/redo, block edits (Delete, Ctrl+D, tool keys already harmless)
    const k=e.key.toLowerCase();
    if(e.key==='Delete'||e.key==='Backspace'||(e.ctrlKey&&k==='d')){e.preventDefault();return;}
  }
  if(e.key>='1'&&e.key<='9'&&!e.ctrlKey&&!e.altKey){const t=TOOLKEYS[+e.key-1];if(t){e.preventDefault();setMode(t);return;}}
  if(state.mode==='grab'&&selected){const k=e.key.toLowerCase(),st=e.shiftKey?10:100;const c=pGetC(selected);let used=true;
    const rr=state.rot*Math.PI/180,cs=Math.cos(rr),sn=Math.sin(rr);
    const mv=(dx,dy)=>{pSetC(selected,c[0]+dx*cs+dy*sn,c[1]-dx*sn+dy*cs);};
    if(!e.ctrlKey&&k==='w')mv(0,-st);else if(!e.ctrlKey&&k==='s')mv(0,st);else if(!e.ctrlKey&&k==='a')mv(-st,0);else if(!e.ctrlKey&&k==='d'){mv(st,0);}
    else if(k==='q')pRot(selected,-Math.PI/12);else if(k==='e')pRot(selected,Math.PI/12);
    else if(e.key==='ArrowUp'&&pLiftable(selected))pSetZ(selected,pGetZ(selected)+(e.shiftKey?10:50));
    else if(e.key==='ArrowDown'&&pLiftable(selected))pSetZ(selected,Math.max(0,pGetZ(selected)-(e.shiftKey?10:50)));
    else if(e.key==='Delete'){pushUndo();const gl=selList();
      if(gl.length>1){ // remove all — sort so index-based removals don't shift each other
        const byArr={};gl.forEach(h=>{if(h.t==='wall'){const a=WALLS[h.level];const idx=a.indexOf(h.ref);if(idx>=0){a.splice(idx,1);}}else{(byArr[h.t]=byArr[h.t]||[]).push(h.i);}});
        Object.keys(byArr).forEach(t=>{byArr[t].sort((a,b)=>b-a).forEach(i=>data[t].splice(i,1));});
        new Set(gl.filter(h=>h.t==='wall').map(h=>h.level)).forEach(l=>SNAP[l]=centerlines(WALLS[l]));
        clearMulti();selected=null;draw();return;}
      removeHit(selected);selected=null;draw();return;}
    else if(e.ctrlKey&&k==='d'){pushUndo();const gl=selList();
      if(gl.length>1){const clones=cloneMulti(gl);clones.forEach(h=>{const c=pGetC(h);pSetC(h,c[0]+300,c[1]+300);});clearMulti();clones.forEach(addMulti);selected=clones[0]||null;draw();return;}
      const nh=clonePiece(selected);if(nh){selected=nh;pSetC(nh,pGetC(nh)[0]+300,pGetC(nh)[1]+300);}draw();return;}
    else used=false;
    if(used){e.preventDefault();pushUndo();draw();$('hud').textContent=pLabel(selected);return;}}
  if(state.mode==='object'&&objGhost&&!(selected&&selected.t==='objects')){const k=e.key.toLowerCase();
    if(k==='q'){e.preventDefault();state.objAng=(state.objAng||0)-Math.PI/12;draw();return;}
    if(k==='e'){e.preventDefault();state.objAng=(state.objAng||0)+Math.PI/12;draw();return;}}
  const selObj=(state.mode==='select'&&selected&&selected.t==='objects')?data.objects[selected.i]:null;
  if(selObj){const k=e.key.toLowerCase(),st=e.shiftKey?10:100;let used=true;
    const c=Math.cos(state.rot*Math.PI/180),sn=Math.sin(state.rot*Math.PI/180);
    const mv=(dx,dy)=>{selObj.x+=dx*c+dy*sn;selObj.y+=-dx*sn+dy*c;};
    if(k==='w')mv(0,-st);else if(k==='s')mv(0,st);else if(k==='a')mv(-st,0);else if(k==='d')mv(st,0);
    else if(k==='q')selObj.ang=(selObj.ang||0)-Math.PI/12;else if(k==='e')selObj.ang=(selObj.ang||0)+Math.PI/12;
    else if(e.key==='ArrowUp')selObj.z=(selObj.z||0)+(e.shiftKey?10:50);
    else if(e.key==='ArrowDown')selObj.z=Math.max(0,(selObj.z||0)-(e.shiftKey?10:50));
    else used=false;
    if(used){e.preventDefault();draw();$('hud').textContent=`${selObj.name||'Objektum'} — ${Math.round(selObj.w)}×${Math.round(selObj.d)}×${Math.round(selObj.ht)} mm · padlótól ${Math.round(selObj.z||0)} · ${Math.round((selObj.ang||0)*180/Math.PI)}°`;return;}}
  const K=e.key.toLowerCase(),STEP=42;
  if(K==='w'){e.preventDefault();panBy(0,STEP);return;} if(K==='s'){e.preventDefault();panBy(0,-STEP);return;}
  if(K==='a'){e.preventDefault();panBy(STEP,0);return;}  if(K==='d'){e.preventDefault();panBy(-STEP,0);return;}
  if(K==='q'){e.preventDefault();zoomBy(1.12);return;}   if(K==='e'){e.preventDefault();zoomBy(1/1.12);return;}
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
    const dir=e.key==='ArrowRight'?1:-1;
    if(state.mode==='path'||state.mode==='cable'){e.preventDefault();cyclePlace(dir);return;}   // Space-palette
    if(state.mode==='device'){e.preventDefault();let i=DEVORDER.indexOf($('devType').value);i=(i+dir+DEVORDER.length)%DEVORDER.length;
      $('devType').value=DEVORDER[i];$('hud').textContent='Készülék → '+$('devType').selectedOptions[0].text;draw();return;}
    if(state.mode==='build'){e.preventDefault();let i=BUILDORDER.indexOf(state.buildType);i=(i+dir+BUILDORDER.length)%BUILDORDER.length;
      state.buildType=BUILDORDER[i];$('buildType').value=BUILDORDER[i];$('hud').textContent='Beépített → '+$('buildType').selectedOptions[0].text;draw();return;}
    e.preventDefault();recentrePivot();setRot(state.rot+dir*15);return;} // else rotate around screen centre
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){
    const stepping=(state.mode==='cable'||state.mode==='path'||state.mode==='device'||(state.mode==='object'&&state.objWallSnap))&&!e.shiftKey;
    if(stepping){e.preventDefault();stepHeight(e.key==='ArrowUp'?1:-1);return;}
    e.preventDefault();setPitch(state.pitch+(e.key==='ArrowUp'?5:-5));return;}
  if(e.key==='Enter'){if(state.mode==='cable')finishCable();else if(state.mode==='path')finishPath();return;}
  if(e.key==='Backspace'){
    if(state.mode==='path'&&pathDraft&&pathDraft.nodes.length){e.preventDefault();pathDraft.nodes.pop();if(pathDraft.sections.length)pathDraft.sections.pop();draw();return;}
    if(state.mode==='cable'&&draft&&draft.nodes.length){e.preventDefault();draft.nodes.pop();draw();return;}
    if(state.mode==='wall'&&wallStart){e.preventDefault();wallStart=null;draw();return;}
    if(state.mode==='floor'&&floorStart){e.preventDefault();floorStart=null;draw();return;}
    if(state.mode==='roof'&&roofStart){e.preventDefault();roofStart=null;draw();return;}}
  if(e.key==='Delete'&&state.mode==='select'&&selected){e.preventDefault();pushUndo();removeHit(selected);selected=null;draw();return;}
  if(state.mode==='grab'&&selected&&selected.t==='objects'&&e.key==='Control'){
    if(e.repeat)return;const o=pieceRef(selected);if(o&&o.onWall){e.preventDefault();state.side^=1;
      const lvl=pieceLevel(selected),walls=WALLS[lvl]||[],c=pGetC(selected),bp=planToBase(c[0],c[1],dz(lvl,o.z||0));
      let best=null;walls.forEach(r=>{const dd=wallDist(r,bp[0],bp[1],dz(lvl,o.z||0));if(!best||dd.d<best.d)best=dd;});
      if(best){const wi=best.wi,t=Math.max(0,Math.min(1,best.t));
        const cxp=wi.seg[0][0]+t*(wi.seg[1][0]-wi.seg[0][0]),cyp=wi.seg[0][1]+t*(wi.seg[1][1]-wi.seg[0][1]);
        const dep=o.d||600,off=(state.side?1:-1)*(wi.thick/2+dep/2);
        pSetC(selected,cxp+wi.perp[0]*off,cyp+wi.perp[1]*off);draw();$('hud').textContent='Fal oldala váltva';}
      return;}}
  if(state.mode==='cable'||state.mode==='path'||state.mode==='device'||state.mode==='object'){
    if(e.key==='Alt'){/* handled globally */}
    if(e.key==='Control'){if(e.repeat)return;state.side^=1;draw();$('hud').textContent='Fal oldala: '+(state.side?'túloldal':'közeli oldal');return;}
    if(e.key===' '&&cursor){e.preventDefault();placeAtCursor();return;}
  }});
// Alt held = fine mode; released = back to 1:1 (also cleared if focus is lost mid-drag)
document.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName)||'';if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  if(e.key==='Alt'||e.key==='f'||e.key==='F'){
    e.preventDefault();                       // stops Alt from focusing the browser menu bar mid-drag
    if(!e.repeat)fineOn(lastPtr[0],lastPtr[1]);}},true);
document.addEventListener('pointermove',e=>{lastPtr=[e.clientX,e.clientY];},true);
document.addEventListener('keyup',e=>{if((e.key==='Alt'||e.key==='f'||e.key==='F')&&!state.fineLock)fineOff();},true);
// global undo/redo — the editors handle their own first (edKeyFn runs in the capture phase)
document.addEventListener('keydown',e=>{
  if(edCur())return;                                   // an editor is open: its own history wins
  const tg=(e.target&&e.target.tagName)||'';if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;
  if(!(e.ctrlKey||e.metaKey))return;
  const k=(e.key||'').toLowerCase();
  if(k==='z'){e.preventDefault();if(e.shiftKey)doRedo();else doUndo();}
  else if(k==='y'){e.preventDefault();doRedo();}});
window.addEventListener('blur',()=>fineOff());
function finishCable(){if(draft&&draft.nodes.length>=2)data.cables.push(draft);draft=null;lock=null;state.hoverR=null;draw();}
function computeStackOffset(np){
  // for each segment of the new path, find existing path segments that overlap in plan AND sit at the same nominal height band; stack 30mm under the deepest.
  let maxStack=0;const TOLXY=120; // mm plan tolerance for "same place"
  for(let i=1;i<np.nodes.length;i++){const a=np.nodes[i-1],b=np.nodes[i];
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nomZ=a.h; // node height (mm) of the new segment
    let stackHere=0;
    data.paths.forEach(pa=>{if(pa===np)return;
      for(let j=1;j<pa.nodes.length;j++){const c=pa.nodes[j-1],d=pa.nodes[j];
        if(c.level!==a.level)continue;
        // does the existing segment pass near this midpoint at the same nominal height?
        const r=nearestOnSegPlain(mx,my,c.x,c.y,d.x,d.y);
        const existNomZ=(c.h+d.h)/2 - (pa.zoff||0); // its ORIGINAL nominal height before its own offset
        if(r.d<TOLXY && Math.abs(existNomZ-nomZ)<40){ // same place, same height band
          const depth=Math.round((pa.zoff||0)/-30)+1; stackHere=Math.max(stackHere,depth);}}});
    maxStack=Math.max(maxStack,stackHere);}
  return maxStack*-30; // mm, negative = below
}
function nearestOnSegPlain(px,py,x0,y0,x1,y1){const dx=x1-x0,dy=y1-y0,L2=dx*dx+dy*dy||1;
  let t=((px-x0)*dx+(py-y0)*dy)/L2;t=Math.max(0,Math.min(1,t));const cx=x0+t*dx,cy=y0+t*dy;
  return {d:Math.hypot(px-cx,py-cy),t};}
function finishPath(){if(pathDraft&&pathDraft.nodes.length>=2){pathDraft.id='p'+Date.now().toString(36);pathDraft.lane=0;
    const off=computeStackOffset(pathDraft);
    if(off!==0){pathDraft.zoff=off;   // push every node down by |off| mm so it renders under the existing path
      pathDraft.nodes.forEach(n=>{n.h=Math.max(0,(n.h||0)+off);});
      $('hud').textContent=`Pálya ${-off} mm-rel a meglévő alá helyezve.`;}
    data.paths.push(pathDraft);}pathDraft=null;lock=null;state.hoverR=null;draw();}
// ============ MOBILE TOUCH GESTURES ============
// 1 finger: acts as the current tool (pointer events already handle draw/select/drag).
// 2 fingers: pinch = zoom, twist = rotate (yaw), drag = pan; vertical spread while
//            fingers are roughly stacked = pitch. Long-press = right-click / context menu.
let touchG=null,longPressT=null,lpStart=null,suppressTapUntil=0;
function tDist(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
function tAng(a,b){return Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX);}
function tMid(a,b){return [(a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2];}
stage.addEventListener('touchstart',e=>{
  if(e.touches.length===1){
    const t=e.touches[0];lpStart=[t.clientX,t.clientY,Date.now()];
    clearTimeout(longPressT);
    longPressT=setTimeout(()=>{ // long-press → context menu (right-click equivalent)
      if(!lpStart)return;const ev={clientX:lpStart[0],clientY:lpStart[1],preventDefault(){},button:2};
      suppressTapUntil=Date.now()+600;openCtxAt(ev);
    },480);
  } else if(e.touches.length===2){
    clearTimeout(longPressT);lpStart=null;
    e.preventDefault();
    const [a,b]=e.touches;recentrePivot();
    touchG={d0:tDist(a,b),a0:tAng(a,b),m0:tMid(a,b),rot0:state.rot,zoom0:state.zoom,pitch0:state.pitch,
      panX0:state.panX,panY0:state.panY,mid0:tMid(a,b)};
  }
},{passive:false});
stage.addEventListener('touchmove',e=>{
  if(e.touches.length===2&&touchG){e.preventDefault();
    const [a,b]=e.touches;const d=tDist(a,b),ang=tAng(a,b),m=tMid(a,b);
    // pan by mid-point movement (always active — this is the primary two-finger action)
    state.panX=touchG.panX0+(m[0]-touchG.m0[0]);state.panY=touchG.panY0+(m[1]-touchG.m0[1]);
    // pinch zoom — only past a spread threshold so a straight drag doesn't creep-zoom
    if(touchG.d0>10&&Math.abs(d-touchG.d0)>14){state.zoom=Math.max(0.15,Math.min(5,touchG.zoom0*(d/touchG.d0)));}
    // twist rotate (yaw) — dead-zone so a straight pan doesn't spin the view
    let dA=(ang-touchG.a0)*180/Math.PI;while(dA>180)dA-=360;while(dA<-180)dA+=360;
    if(Math.abs(dA)>7)setRotSilent(touchG.rot0+dA);
    setTransform();draw();
    if(lpStart){clearTimeout(longPressT);lpStart=null;}
    return;}
  if(e.touches.length===1&&lpStart){const t=e.touches[0];
    if(Math.hypot(t.clientX-lpStart[0],t.clientY-lpStart[1])>12){clearTimeout(longPressT);lpStart=null;}}
},{passive:false});
stage.addEventListener('touchend',e=>{clearTimeout(longPressT);
  if(e.touches.length<2)touchG=null;
  if(e.touches.length===0)lpStart=null;},{passive:false});
function setRotSilent(deg){deg=((Math.round(deg)%360)+360)%360;state.rot=deg;const r=$('rot');if(r){r.value=deg;$('rotVal').textContent=deg+'°';}}
// two-finger vertical pitch pad (mobile): a dedicated on-screen control instead of ambiguous gesture
function openCtxAt(ev){ // reuse the contextmenu pipeline via a synthetic event
  const evt=new MouseEvent('contextmenu',{clientX:ev.clientX,clientY:ev.clientY,bubbles:true,cancelable:true});
  stage.dispatchEvent(evt);}
stage.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY<0?1.12:1/1.12,before=state.zoom;
  state.zoom=Math.max(0.15,Math.min(5,state.zoom*f));const p=stage.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
  const u=p.matrixTransform(stage.getScreenCTM().inverse());
  state.panX=u.x-(u.x-state.panX)*(state.zoom/before);state.panY=u.y-(u.y-state.panY)*(state.zoom/before);setTransform();},{passive:false});
stage.addEventListener('click',e=>{if(state.mode!=='select')return;moved=false;});

// ==========================================================================
// PLANNER_CAM — camera adapter for 07b-phone-camera.js
//
// APPEND THIS TO THE END OF src/08-interaction.js
//
// Why it lives here: every helper it needs (setRotSilent, setPitch,
// recentrePivot, pivotAtCursor, planToBase, CXv/CYv, W/Hh, setTransform,
// panBy, zoomBy) is defined in this module or earlier, and modules share one
// scope. Nothing needs renumbering and build.js needs no change.
//
// BEFORE BUILDING, grep for collisions — single shared scope:
//     findstr /s /n "camSetPitch camSetYaw camPivotAt camIsOverUI camReset" src\*.js
// Hits should appear ONLY in this block.
//
// WHY NOT REUSE setPitch()/setRot() DIRECTLY: both end in a synchronous
// draw(). That is right for a keypress. A phone gyro streams ~60 updates a
// second, which would queue 60 full repaints. So the hot path below clamps
// exactly as setPitch does, then calls drawSoon() — the rAF-coalesced redraw
// Phase 4 added for pointermove, which is the same shape of input.
// The mouse and keyboard paths are untouched.
// ==========================================================================

// rAF-coalesced redraw, falling back to draw() if drawSoon isn't present
function camDraw(){ (typeof drawSoon==='function'?drawSoon:draw)(); }

// pitch — same clamp and flat/2D-3D handling as setPitch(), minus the HUD
// write and the synchronous draw
function camSetPitch(v){
  state.pitch=Math.max(5,Math.min(90,v));
  state.flat=state.pitch>=88;
  const b=$('view3d'); if(b)b.textContent=state.flat?'3D':'2D';
  camDraw();
}

// yaw — setRotSilent already normalises to 0..359 and syncs the rot slider
function camSetYaw(deg){ setRotSilent(deg); camDraw(); }

// anchor the pivot at a screen point, then recentre the pan on it.
// This is the same two steps the right-drag path does at lines 133 and 140.
function camPivotAt(x,y){
  const ok=pivotAtCursor({clientX:x,clientY:y,preventDefault(){}});
  if(!ok) return false;
  const now=planToBase(CXv,CYv,dz(state.active,0));
  state.panX=W/2-now[0]*state.zoom;
  state.panY=Hh/2-now[1]*state.zoom;
  setTransform();
  return true;
}

// is this screen point over the interface rather than the drawing?
// The stage owns the drawing; anything not inside it is chrome.
function camIsOverUI(x,y){
  const el=document.elementFromPoint(x,y);
  if(!el) return false;
  if(typeof stage!=='undefined' && stage && stage.contains && stage.contains(el)) return false;
  return true;
}

// back to the state defaults from 02-state.js (rot 90, pitch 30, zoom .5,
// pan 250/180). setPitch is used here deliberately — a reset is a one-off,
// so the HUD readout and a synchronous draw are wanted.
function camReset(){
  setRotSilent(90);
  state.zoom=0.5; state.panX=250; state.panY=180;
  setTransform();
  setPitch(30);
  const h=$('hud'); if(h) h.textContent='Nézet visszaállítva.';
}
// Undo/redo dispatch a synthetic Ctrl+Z / Ctrl+Y rather than calling
// doUndo()/doRedo() directly. The keyboard handler bails out when edCur()
// reports an open editor, because the editors keep separate histories and
// their capture-phase handler already dealt with it. A direct call from the
// phone would skip that check and undo the wrong history.
function camKey(key, opts){
  const e = new KeyboardEvent('keydown', Object.assign({
    key: key, bubbles: true, cancelable: true
  }, opts || {}));
  document.dispatchEvent(e);
}

function camUndo(){ camKey('z', {ctrlKey:true}); }
function camRedo(){ camKey('y', {ctrlKey:true}); }

// TOOLKEYS (line ~262) is the same table the 1-9 shortcuts use, so both
// paths land on the identical setMode() call.
function camSelectTool(index, key){
  let name = null;
  if (typeof index === 'number' && index >= 0 && index < TOOLKEYS.length) name = TOOLKEYS[index];
  else if (key != null) {
    const n = parseInt(String(key), 10);
    if (n >= 1 && n <= TOOLKEYS.length) name = TOOLKEYS[n - 1];
  }
  if (!name) return false;
  setMode(name);
  return true;
}
// The object 07b-phone-camera.js looks for. Both accessor and method forms
// are provided so the naming in that module can't be a mismatch.
window.PLANNER_CAM={
  get pitch(){ return state.pitch; },
  set pitch(v){ camSetPitch(v); },
  get yaw(){ return state.rot; },
  set yaw(v){ camSetYaw(v); },

  getPitch(){ return state.pitch; },
  setPitch(v){ camSetPitch(v); },
  getYaw(){ return state.rot; },
  setYaw(v){ camSetYaw(v); },

  zoomBy(f){ zoomBy(f); },
  panBy(dx,dy){ panBy(dx,dy); },
  pivotAt(x,y){ return camPivotAt(x,y); },
  pivotCenter(){ recentrePivot(); },
  isOverUI(x,y){ return camIsOverUI(x,y); },

  resetView(){ camReset(); },
  undo(){ camUndo(); },
  redo(){ camRedo(); },
  selectTool(index,key){ return camSelectTool(index,key); },

  // read-only snapshot, handy for debugging from the console
  read(){ return {yaw:state.rot,pitch:state.pitch,zoom:state.zoom,
                  panX:state.panX,panY:state.panY,flat:state.flat}; }
};
